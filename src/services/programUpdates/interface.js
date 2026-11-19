import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags, escapeMarkdown } from 'discord.js';
import { preferences, program, matches, countryName, DIRECTORIES } from './catalog.js';
import { key, get, put, remove, list, sourcesFor, withDb, locked } from './store.js';
import { id, writableChannel, checkGuild, checkSource, reviewChange } from './service.js';
import { safeUrl, fetchPage, extractText, discoverSchools } from './fetch.js';
import { logger } from '../../utils/logger.js';
async function requireLock(...args) {
    const result = await locked(...args);
    if (result?.busy) throw new Error('Another update is already running. Please try again shortly.');
    return result;
}
const clean = (value, limit = 900) => escapeMarkdown(String(value || '')).slice(0,limit);
const admin = interaction => {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required for this action.');
};
function input(interaction) { return preferences(Object.fromEntries(['program','country','region','school','topic','applicant'].map(name => [name, interaction.options.getString(name)]))); }
const summary = filter => `${program(filter.program).name} · ${countryName(filter.country)}${filter.region ? ' · ' + filter.region : ''}${filter.county ? ' · ' + filter.county : ''}\nSchool: ${filter.school || 'All tracked schools'}\nTopics: ${filter.topic || 'All'} · Applicants: ${filter.applicant}`;
async function subscriptionPreview(interaction, filter) {
    const draftId = id();
    await withDb(interaction.client, db => put(db, key(interaction.guildId, 'draft', `${interaction.user.id}:${draftId}`), { ...filter, expiresAt: Date.now() + 3600000 }));
    return { embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('🌍 Your programme update preferences').setDescription(clean(summary(filter), 1600))
        .setFooter({ text: 'Only approved, tracked sources are monitored. You can unsubscribe at any time.' })],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`programupdates:subscribe:${interaction.user.id}:${draftId}`).setLabel('Save subscription').setStyle(ButtonStyle.Primary))], allowedMentions: { parse: [] } };
}
export async function findPrograms(client, guildId, filter, { db = null } = {}) {
    const sources = db ? await sourcesFor(db, guildId) : await withDb(client, connection => sourcesFor(connection, guildId));
    const selected = sources.filter(source => matches(source, filter)).slice(0,3);
    const embeds = [], buttons = [];
    for (const source of selected) {
        const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle(`${program(source.program).name} · ${source.school}`.slice(0,250))
            .setDescription(`${countryName(source.country)}${source.region ? ' · ' + clean(source.region,80) : ''}${source.county ? ' · ' + clean(source.county,80) : ''}\nTopic: ${source.topic} · Applicants: ${source.applicant}`)
            .addFields({ name: 'Official source', value: source.url });
        try {
            const snapshot = extractText(await fetchPage(source.url), source.selector);
            const lines = snapshot.text.split('\n');
            const relevant = lines.filter(line => /prerequi|admiss|deadline|applica|tuition|scholarship|licen|accredit|require|international/i.test(line));
            embed.addFields({ name: 'Source excerpt · checked now', value: clean((relevant.length ? relevant : lines).slice(0,12).join('\n'), 1000) });
            embed.setFooter({ text: 'Monitored source · Confirm intake year, deadlines and applicant eligibility on the official page.' }).setTimestamp();
        } catch (error) { embed.addFields({ name: 'Check unavailable', value: clean(error.message) }).setFooter({ text: 'Could not verify current requirements; use the official source.' }); }
        embeds.push(embed);
    }
    if (!selected.length) {
        const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle('🌍 Find programme requirements').setDescription(clean(summary(filter),1600))
            .addFields({ name: 'Coverage', value: 'No matching official sources are tracked yet. You can save a subscription and request coverage with the Request coverage menu in /programs.' });
        let candidates = [];
        try { candidates = await discoverSchools({ ...filter, program: program(filter.program).name, countryCode: filter.country }); }
        catch (error) { embed.addFields({ name: 'School search', value: clean(error.message) }); }
        if (candidates.length) {
            embed.addFields({ name: 'Directory-listed schools · programme availability not verified', value: candidates.map(candidate => `• ${clean(candidate.title,150)}\n${candidate.url}`).join('\n').slice(0,1024) });
        } else {
            embed.addFields({ name: 'Free school directory', value: 'No matching directory entries found. No search key is needed. Request coverage or explore the official directory links below.' });
        }
        const directories = (DIRECTORIES[filter.program] || []).filter(([country]) => country === filter.country);
        if (directories.length) embed.addFields({ name: 'Official directories · explore schools', value: directories.map(([,name,url]) => `${name}\n${url}`).join('\n') });
        embeds.push(embed);
    }
    return { embeds, components: buttons, allowedMentions: { parse: [] } };
}
export async function openProgramUpdates(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        if (!interaction.guildId) throw new Error('Use /programs inside a server.');
        const { client, guildId, user } = interaction;
        const action = interaction.options.getSubcommand();
        if (action === 'find' || action === 'compare') {
            const filter = input(interaction);
            let result;
            if (action === 'compare') {
                const schools = filter.school.split('|').map(school => school.trim()).filter(Boolean);
                if (schools.length !== 2) throw new Error('For compare, enter two school names separated by | in school.');
                const responses = [];
                for (const school of schools) responses.push(await findPrograms(client, guildId, { ...filter, school }));
                result = { embeds: responses.flatMap(response => response.embeds).slice(0,6), allowedMentions: { parse: [] } };
            } else result = await findPrograms(client, guildId, filter);
            const preview = await subscriptionPreview(interaction, action === 'compare' ? { ...filter, school: '' } : filter);
            result.components = preview.components;
            return await interaction.editReply(result);
        }
        if (action === 'subscribe') return await interaction.editReply(await subscriptionPreview(interaction, input(interaction)));
        if (action === 'subscriptions') {
            const all = await withDb(client, db => list(db, key(guildId, 'subscription', user.id) + ':'));
            const start = ((interaction.options.getInteger('page') || 1) - 1) * 3;
            const rows = all.slice(start, start + 3);
            return await interaction.editReply({ content: rows.length ? rows.map(row => `**${row.value.id}**\n${clean(summary(row.value),600)}`).join('\n\n').slice(0,1900) : 'You have no programme update subscriptions.', allowedMentions: { parse: [] } });
        }
        if (action === 'unsubscribe') {
            await withDb(client, db => remove(db, key(guildId, 'subscription', `${user.id}:${interaction.options.getString('id')}`)));
            return await interaction.editReply('Subscription removed.');
        }
        if (action === 'request') {
            const filter = input(interaction);
            const requestId = id();
            await requireLock(client, key(guildId, 'requests', user.id), async db => {
                const old = await get(db, key(guildId, 'request-user', user.id));
                if (old?.at > Date.now() - 3600000) throw new Error('You can request coverage once per hour.');
                await put(db, key(guildId, 'request', requestId), { ...filter, userId: user.id, at: Date.now() });
                await put(db, key(guildId, 'request-user', user.id), { at: Date.now() });
            });
            const config = await withDb(client, db => get(db, key(guildId, 'config')));
            if (config) {
                try { const channel = await writableChannel(client, config.reviewChannel, guildId); await channel.send({ content: `**Programme coverage request ${requestId}**\n${clean(summary(filter),1600)}`, allowedMentions: { parse: [] } }); }
                catch (error) { logger.warn(`Programme coverage notification: ${error.message}`); }
            }
            return await interaction.editReply(`Coverage request saved: ${requestId}. Monitoring starts only after a moderator adds official sources.`);
        }
        if (action === 'sources') {
            const text = await withDb(client, async db => {
                const sources = await sourcesFor(db, guildId), lines = [];
                const start = ((interaction.options.getInteger('page') || 1) - 1) * 5;
                for (const source of sources.slice(start, start + 5)) {
                    const state = await get(db, key(guildId, 'state', source.id));
                    lines.push(`**${source.id} · ${clean(source.school,80)}**\n${source.country} · ${source.program} · ${state?.lastError ? 'Check failed' : state?.pending ? 'Awaiting review' : state?.checkedAt ? 'Checked ' + new Date(state.checkedAt).toISOString() : 'Not checked yet'}`);
                }
                return lines.join('\n\n') || 'No sources tracked yet. Moderators can add official sources with /programs → Moderator settings → Find and approve an official source.';
            });
            return await interaction.editReply({ content: text.slice(0,1900), allowedMentions: { parse: [] } });
        }
        admin(interaction);
        if (action === 'requests') {
            const rows = await withDb(client, db => list(db, key(guildId, 'request') + ':'));
            const start = ((interaction.options.getInteger('page') || 1) - 1) * 3;
            const text = rows.slice(start, start + 3).map(row => `**${row.key.split(':').at(-1)}**\n${clean(summary(row.value),500)}`).join('\n\n');
            return await interaction.editReply({ content: text || 'No coverage requests on this page.', allowedMentions: { parse: [] } });
        }
        if (action === 'setup') {
            const channel = interaction.options.getChannel('channel'), review = interaction.options.getChannel('review-channel');
            await writableChannel(client, channel.id, guildId); await writableChannel(client, review.id, guildId);
            await withDb(client, db => put(db, key(guildId, 'config'), { channel: channel.id, reviewChannel: review.id }));
            return await interaction.editReply('Programme updates configured. Sources are checked every 12 hours; changed text goes to moderator review before publication.');
        }
        if (action === 'source-add') {
            const filter = input(interaction), rawUrl = interaction.options.getString('url');
            if (!filter.school || !filter.topic || !rawUrl) throw new Error('Supply school (or regulator name), topic, and an official source URL.');
            const url = safeUrl(rawUrl).href, selector = interaction.options.getString('section') || '';
            // Validate network destination, readable content and selector before saving.
            extractText(await fetchPage(url), selector);
            const source = { ...filter, id: id(), url, selector, approvedBy: user.id, approvedAt: Date.now() };
            await requireLock(client, key(guildId, 'source-admin'), async db => {
                if (!await get(db, key(guildId, 'config'))) throw new Error('Run /programs → Moderator settings → Set update and review channels first.');
                const sources = await sourcesFor(db, guildId);
                if (sources.length >= 50) throw new Error('This server supports up to 50 monitored sources.');
                if (sources.some(s => s.url === url && s.program === filter.program && s.topic === filter.topic)) throw new Error('That source is already monitored for this programme and topic.');
                await put(db, key(guildId, 'source', source.id), source);
            });
            await checkSource(client, guildId, source);
            return await interaction.editReply(`Official source added: ${source.id}. Baseline saved; future changes will be sent for review.`);
        }
        if (action === 'source-remove') {
            const sourceId = interaction.options.getString('id');
            await requireLock(client, key(guildId, 'check', sourceId), async db => {
                await remove(db, key(guildId, 'source', sourceId)); await remove(db, key(guildId, 'state', sourceId));
            });
            return await interaction.editReply('Source monitoring removed.');
        }
        if (action === 'check') {
            const result = await requireLock(client, key(guildId, 'manual-check'), async db => {
                const last = await get(db, key(guildId, 'last-manual-check'));
                if (last?.at > Date.now() - 600000) throw new Error('Manual checks can run once every 10 minutes.');
                await put(db, key(guildId, 'last-manual-check'), { at: Date.now() });
                return { started: true };
            });
            if (result.busy) return await interaction.editReply('A check is already running.');
            void checkGuild(client, guildId).catch(error => logger.warn(`Manual programme check: ${error.message}`));
            return await interaction.editReply('Source check started. Changes will appear in the moderator review channel. Use /programs → Moderator settings → View monitored sources for check status.');
        }
    } catch (error) { logger.warn(`Programme updates command: ${error.message}`); await interaction.editReply({ content: error.message, allowedMentions: { parse: [] } }); }
}
export async function handleProgramUpdates(interaction, client, args) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        if (!interaction.guildId) throw new Error('Use programme updates inside a server.');
        const [action, target, token] = args;
        if (action === 'subscribe') {
            if (target !== interaction.user.id) throw new Error('Open your own preferences with /programs.');
            const result = await requireLock(client, key(interaction.guildId, 'subscriptions', target), async db => {
                if (!await get(db, key(interaction.guildId, 'config'))) throw new Error('A moderator needs to run /programs → Moderator settings → Set update and review channels before subscriptions can be saved.');
                const draft = await get(db, key(interaction.guildId, 'draft', `${target}:${token}`));
                if (!draft || draft.expiresAt < Date.now()) throw new Error('This preference preview expired. Open a new subscription.');
                const rows = await list(db, key(interaction.guildId, 'subscription', target) + ':');
                const { expiresAt, ...filter } = draft;
                if (rows.some(row => JSON.stringify(preferences(row.value)) === JSON.stringify(filter))) return 'You already have this subscription.';
                if (rows.length >= 20) throw new Error('You can save up to 20 subscriptions. Remove an old one first.');
                await put(db, key(interaction.guildId, 'subscription', `${target}:${token}`), { ...filter, userId: target, id: token });
                await remove(db, key(interaction.guildId, 'draft', `${target}:${token}`));
                return 'Subscription saved. Matching, moderator-approved updates will appear in the configured updates channel.';
            });
            return await interaction.editReply(typeof result === 'string' ? result : 'A subscription update is already running.');
        }
        if (!['approve','reject'].includes(action)) throw new Error('Unknown programme update action.');
        admin(interaction);
        const result = await reviewChange(client, interaction.guildId, target, token, action === 'approve');
        await interaction.editReply(result.busy ? 'This change is already being reviewed.' : action === 'approve' ? 'Update published.' : 'Change ignored; monitoring continues.');
    } catch (error) { logger.warn(`Programme update interaction: ${error.message}`); await interaction.editReply({ content: error.message, allowedMentions: { parse: [] } }); }
}
