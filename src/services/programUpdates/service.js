import { randomBytes, createHash } from 'node:crypto';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } from 'discord.js';
import { key, get, put, list, sourcesFor, withDb, locked } from './store.js';
import { program, countryName, matches } from './catalog.js';
import { fetchPage, extractText, changes } from './fetch.js';
import { logger } from '../../utils/logger.js';
export const id = () => randomBytes(8).toString('hex');
const clip = (text, max = 900) => escapeMarkdown(String(text)).slice(0, max);
const nonce = (...parts) => createHash('sha256').update(parts.join(':')).digest('hex').slice(0,24);
export function changeMessage(source, pending, review = true) {
    const p = program(source.program);
    const change = changes(pending.before, pending.after);
    const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle(`${p.name} · ${source.school}`.slice(0,250))
        .setDescription(`<:program:${p.emoji}> ${review ? '**Review required: official-source content changed.**' : '**Source change reviewed by a server moderator.**'}\n${countryName(source.country)}${source.region ? ' · ' + clip(source.region, 80) : ''}${source.county ? ' · ' + clip(source.county,80) : ''} · ${source.topic}\nApplicant category: ${source.applicant}\n\nChanges below are excerpts, not a complete requirements list. Confirm intake year, applicability, and deadlines on the official page.`)
        .addFields({ name: 'Added or revised text', value: clip(change.added.join('\n') || 'No new text; see removals.') || '—' },
            { name: 'Removed text', value: clip(change.removed.join('\n') || 'None detected.') || '—' },
            { name: 'Official source', value: source.url })
        .setFooter({ text: `Source ${source.id} · Dates and eligibility apply only when stated by the source` }).setTimestamp(pending.at);
    const components = review ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`programupdates:approve:${source.id}:${pending.id}`).setLabel('Approve update').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`programupdates:reject:${source.id}:${pending.id}`).setLabel('Ignore change').setStyle(ButtonStyle.Secondary),
    )] : [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Official source').setURL(source.url).setStyle(ButtonStyle.Link))];
    return { embeds: [embed], components, allowedMentions: { parse: [] } };
}
export async function writableChannel(client, channelId, guildId) {
    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.guildId !== guildId || !channel.isTextBased() || !channel.send) throw new Error('Choose a text channel in this server that StudyBot can access.');
    return channel;
}
export async function checkSource(client, guildId, source, { pageFetcher = fetchPage, at = Date.now(), db: existingDb = null } = {}) {
    return locked(client, key(guildId, 'check', source.id), async db => {
        if (!await get(db, key(guildId, 'source', source.id))) return { removed: true };
        const stateKey = key(guildId, 'state', source.id);
        const state = await get(db, stateKey) || {};
        const config = await get(db, key(guildId, 'config'));
        if (!config) throw new Error('Configure updates and review channels with /programs → Moderator settings → Set update and review channels.');
        if (state.pending) {
            if (state.pending.notified) return { pending: true };
            const channel = await writableChannel(client, config.reviewChannel, guildId);
            const message = await channel.send({ ...changeMessage(source, state.pending), nonce: nonce(guildId, source.id, state.pending.id, 'review'), enforceNonce: true });
            state.pending.notified = message.id;
            await put(db, stateKey, state);
            return { pending: true };
        }
        const page = await pageFetcher(source.url);
        const snapshot = extractText(page, source.selector);
        if (!state.hash) {
            await put(db, stateKey, { ...snapshot, checkedAt: at, lastError: null });
            return { baseline: true };
        }
        if (state.hash === snapshot.hash) {
            await put(db, stateKey, { ...state, checkedAt: at, lastError: null });
            return { unchanged: true };
        }
        const pending = { id: id(), before: state.text, after: snapshot.text, hash: snapshot.hash, at };
        await put(db, stateKey, { ...state, checkedAt: at, lastError: null, pending });
        const channel = await writableChannel(client, config.reviewChannel, guildId);
        const message = await channel.send({ ...changeMessage(source, pending), nonce: nonce(guildId, source.id, pending.id, 'review'), enforceNonce: true });
        pending.notified = message.id;
        await put(db, stateKey, { ...state, checkedAt: at, lastError: null, pending });
        return { changed: true };
    }, existingDb);
}
export async function reviewChange(client, guildId, sourceId, pendingId, approve) {
    return locked(client, key(guildId, 'check', sourceId), async db => {
        const source = await get(db, key(guildId, 'source', sourceId));
        const stateKey = key(guildId, 'state', sourceId), state = await get(db, stateKey);
        if (!source || state?.pending?.id !== pendingId) throw new Error('This review is no longer pending.');
        const config = await get(db, key(guildId, 'config'));
        if (!config) throw new Error('Configure update channels first.');
        const pending = state.pending;
        if (!approve && pending.publishedMessage) throw new Error('Publication already started. Approve again to finish subscriber notifications.');
        if (approve) {
            const channel = await writableChannel(client, config.channel, guildId);
            if (!pending.recipients) {
                const subscriptions = await list(db, key(guildId, 'subscription') + ':');
                pending.recipients = [...new Set(subscriptions.map(row => row.value).filter(sub => matches(source, sub)).map(sub => sub.userId))];
                await put(db, stateKey, state);
            }
            if (!pending.publishedMessage) {
                const sent = await channel.send({ ...changeMessage(source, pending, false), nonce: nonce(guildId, sourceId, pending.id, 'publish'), enforceNonce: true });
                pending.publishedMessage = sent.id;
                await put(db, stateKey, state);
            }
            for (let offset = pending.notifiedCount || 0; offset < pending.recipients.length; offset += 50) {
                const users = pending.recipients.slice(offset, offset + 50);
                await channel.send({ content: `${users.map(user => `<@${user}>`).join(' ')}\nA matching ${program(source.program).name} update is available: https://discord.com/channels/${guildId}/${config.channel}/${pending.publishedMessage}`,
                    allowedMentions: { parse: [], users }, nonce: nonce(guildId, sourceId, pending.id, String(offset)), enforceNonce: true });
                pending.notifiedCount = offset + users.length;
                await put(db, stateKey, state);
            }
            await put(db, key(guildId, 'published', pending.id), { sourceId, messageId: pending.publishedMessage, at: Date.now() });
        }
        await put(db, stateKey, { text: pending.after, hash: pending.hash, checkedAt: state.checkedAt, lastError: null });
        return { approved: approve };
    });
}
export async function checkGuild(client, guildId) {
    const sources = await withDb(client, db => sourcesFor(db, guildId));
    const results = [];
    for (const source of sources.slice(0,50)) {
        try { results.push({ id: source.id, ...await checkSource(client, guildId, source) }); }
        catch (error) {
            logger.warn(`Program source ${source.id}: ${error.message}`);
            // Retain last successful snapshot, never replace it with an error page.
            await locked(client, key(guildId, 'check', source.id), async db => {
                const stateKey = key(guildId, 'state', source.id), old = await get(db, stateKey) || {};
                await put(db, stateKey, { ...old, lastError: error.message, attemptedAt: Date.now() });
            });
            results.push({ id: source.id, error: error.message });
        }
    }
    return results;
}
let running = false;
export async function runProgramChecks(client) {
    if (running) return;
    running = true;
    try {
        const configs = await withDb(client, db => list(db, 'program-updates:%:config'));
        for (const config of configs.filter(row => /^program-updates:[0-9]+:config$/.test(row.key))) {
            const guildId = config.key.split(':')[1];
            if (!client.guilds.cache.has(guildId)) continue;
            await checkGuild(client, guildId);
        }
    } catch (error) { logger.warn(`Program updates check: ${error.message}`); }
    finally { running = false; }
}
