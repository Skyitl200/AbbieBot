import { randomBytes } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, PermissionFlagsBits, escapeMarkdown } from 'discord.js';
import { totalsFor, sumTotals, duration, tierFor, monthKey, ZONE } from './model.js';
import { recordsForGuild, putResource, getResource, creditActivity } from './store.js';
import { logger } from '../../utils/logger.js';
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const button = (label, id, style = ButtonStyle.Secondary) => new ButtonBuilder().setLabel(label).setCustomId(id).setStyle(style);
const tierLabel = tier => { const next = tierFor(tier.ms).next; return `${tier.name} (${tier.ms / 3600000}${next ? `–${next.ms / 3600000}` : '+'}h)`; };
const periodLabel = (period, at) => period === 'all' ? 'All Time' : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: ZONE }).format(at);
export function rankRecords(rows, period, at) {
    return rows.map(({ userId, record }) => { const totals = totalsFor(record, period, at); return { userId, totals, ms: sumTotals(totals) }; })
        .filter(entry => entry.ms > 0).sort((a, b) => b.ms - a.ms || a.userId.localeCompare(b.userId));
}
export function studyTimeMessage(rows, owner, { period = 'month', view = 'leaderboard', member = owner, page = 0, at = Date.now() } = {}) {
    const ranked = rankRecords(rows, period, at);
    const index = ranked.findIndex(entry => entry.userId === member);
    const entry = ranked[index] || { totals: totalsFor(null, period, at), ms: 0 };
    const embed = new EmbedBuilder().setColor(0x8b5cf6).setTimestamp(at);
    const pages = Math.max(1, Math.ceil(ranked.length / 10));
    page = Math.max(0, Math.min(Number(page) || 0, pages - 1));
    if (view === 'stats') {
        const tier = tierFor(entry.ms);
        embed.setTitle(`☕ Study Statistics (${periodLabel(period, at)})`).setDescription(`<@${member}>`)
            .addFields(
                { name: 'Current study tier', value: `${tierLabel(tier.current)} · ${duration(entry.ms)}`, inline: true },
                { name: 'Next tier', value: tier.next ? `${tierLabel(tier.next)}` : 'Highest tier reached', inline: true },
                { name: 'Study rank', value: index >= 0 ? `#${index + 1} / ${ranked.length}` : 'Not ranked yet', inline: true },
                { name: 'Tier rank', value: `👑 ${tier.rank} / ${tier.count}`, inline: true },
                { name: 'Promotion in', value: tier.next ? duration(Math.max(0, tier.next.ms - entry.ms)) : 'You reached Mythic Mind!', inline: true },
                { name: 'Study-time breakdown', value: `🎙️ Voice: **${duration(entry.totals.voice)}**\n🪱 Microbemon: **${duration(entry.totals.microbemon)}**\n📝 Test questions: **${duration(entry.totals.test)}**\n🎬 Resources: **${duration(entry.totals.links)}**` },
            );
    } else {
        const lines = ranked.slice(page * 10, (page + 1) * 10).map((e, i) => {
            const rank = page * 10 + i + 1;
            return `${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `**${rank}.**`} **${duration(e.ms)}** · <@${e.userId}> · ${tierFor(e.ms).current.name}`;
        });
        embed.setTitle(`☕ Study Leaderboard (${periodLabel(period, at)})`)
            .setDescription(lines.join('\n') || 'No study time recorded yet. Join a voice channel, play Microbemon, or answer a /test question to get started.')
            .addFields({ name: member === owner ? 'Your standing' : 'Selected member', value: index >= 0 ? `#${index + 1} · ${duration(entry.ms)}` : 'Not ranked yet' });
    }
    embed.setFooter({ text: `Estimated study credit · Voice + 30s/game action or answered question + 20s/resource · Monthly reset: Eastern time · Page ${page + 1}/${pages}` });
    const nav = [row(button('This month', `studytime:${owner}:leaderboard:month:0`), button('All time', `studytime:${owner}:leaderboard:all:0`), button('My stats', `studytime:${owner}:stats:${period}:0`, ButtonStyle.Primary))];
    if (view === 'leaderboard' && pages > 1) nav.push(row(
        button('Previous', `studytime:${owner}:leaderboard:${period}:${page - 1}`).setDisabled(page === 0),
        button('Next', `studytime:${owner}:leaderboard:${period}:${page + 1}`).setDisabled(page + 1 >= pages),
    ));
    return { embeds: [embed], components: nav, allowedMentions: { parse: [] } };
}
export function monthlyLevelMessage(record, userId, at = Date.now()) {
    const currentMonth = monthKey(at);
    const [year, month] = currentMonth.split('-').map(Number);
    const previousMonth = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`;
    const ms = sumTotals(totalsFor(record, 'month', at));
    const tier = tierFor(ms);
    const previous = record?.months?.[previousMonth];
    const lastLevel = previous ? tierLabel(tierFor(sumTotals(previous)).current) : 'No study time recorded last month';
    const remaining = tier.next ? Math.ceil(Math.max(0, tier.next.ms - ms) / 360000) / 10 : null;
    const lines = [
        ['Current monthly level', tierLabel(tier.current)],
        ['Last monthly level', lastLevel],
        ['Level rank', `${tier.rank}/${tier.count}`],
        ['Level promotion in', tier.next ? `${remaining.toFixed(1)} hours until ${tier.next.name}` : 'Highest level reached — Mythic Mind!'],
    ];
    // Discord renders ANSI code fences as a boxed, monospace panel. Values and
    // labels use separate colors; the embed deliberately has no accent color.
    const panel = '```ansi\n' + lines.map(([label, value]) =>
        `\u001b[1;34m${label}:\u001b[0m\n\u001b[1;33m${value}\u001b[0m`).join('\n\n') + '\n```';
    const embed = new EmbedBuilder({
        title: `☕ Monthly Level Statistics (${periodLabel('month', at)})`,
        fields: [{ name: 'Monthly levels', value: panel }],
    }).setDescription(`<@${userId}>`).setTimestamp(at)
        .setFooter({ text: 'Monthly levels reset on the first of each month · Eastern time' });
    return { embeds: [embed], allowedMentions: { parse: [] } };
}
export async function openMonthlyLevel(interaction) {
    await interaction.deferReply();
    try {
        if (!interaction.guildId) throw new Error('Use /stats me inside a server.');
        const rows = await recordsForGuild(interaction.client, interaction.guildId);
        const record = rows.find(row => row.userId === interaction.user.id)?.record;
        const message = monthlyLevelMessage(record, interaction.user.id);
        const avatar = interaction.user.displayAvatarURL?.();
        message.embeds[0].setAuthor({ name: interaction.user.globalName || interaction.user.username || 'Your study level', ...(avatar ? { iconURL: avatar } : {}) });
        await interaction.editReply(message);
    } catch (error) {
        logger.warn(`Monthly level command: ${error.message}`);
        await interaction.editReply({ content: error.message, allowedMentions: { parse: [] } });
    }
}
export async function createStudyResourceMessage(client, guildId, title, rawUrl) {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a valid HTTPS resource link.');
    title = String(title).trim();
    if (!title || title.length > 180 || url.href.length > 500) throw new Error('Use a title up to 180 characters and a link up to 500 characters.');
    const id = randomBytes(12).toString('hex');
    await putResource(client, guildId, id, { title, url: url.href });
    return { embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('🎬 Study Resource').setDescription(`${escapeMarkdown(title)}\n\nOpen this resource to add **20 seconds** of study credit, for each Open resource action.`)],
        components: [row(button('Open resource · +20s', `studytime:resource:${id}`, ButtonStyle.Primary))], allowedMentions: { parse: [] } };
}
export async function openStudyTime(interaction) {
    await interaction.deferReply();
    try {
        if (!interaction.guildId) throw new Error('Use study time inside a server.');
        const view = interaction.options?.getString('view') || 'leaderboard';
        const period = interaction.options?.getString('period') || 'month';
        if (view === 'resource') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required to publish a tracked resource.');
            return await interaction.editReply(await createStudyResourceMessage(interaction.client, interaction.guildId,
                interaction.options.getString('title') || '', interaction.options.getString('url') || ''));
        }
        const member = interaction.options?.getUser('member')?.id || interaction.user.id;
        const rows = await recordsForGuild(interaction.client, interaction.guildId);
        await interaction.editReply(studyTimeMessage(rows, interaction.user.id, { view, period, member }));
    } catch (error) { logger.warn(`Study time command: ${error.message}`); await interaction.editReply({ content: error.message, allowedMentions: { parse: [] } }); }
}
export async function handleStudyTime(interaction, client, args) {
    try {
        if (!interaction.guildId || interaction.user.bot) throw new Error('Use study time inside a server.');
        if (args[0] === 'resource') {
            if (!interaction.id) throw new Error('Please click the resource button again.');
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const resource = await getResource(client, interaction.guildId, args[1]);
            if (!resource) throw new Error('This resource is no longer available.');
            const awarded = await creditActivity(client, interaction.guildId, interaction.user.id, 'links', `${args[1]}:${interaction.id}`);
            return await interaction.editReply({ content: `${awarded ? 'Added **20 seconds** of study credit.' : 'This click has already been recorded.'}\n**${escapeMarkdown(resource.title)}**`,
                components: [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Visit resource').setURL(resource.url))], allowedMentions: { parse: [] } });
        }
        const [owner, view, period, page] = args;
        if (owner !== interaction.user.id) return await interaction.reply({ content: 'Open your own leaderboard with /studytime.', flags: MessageFlags.Ephemeral });
        if (!['stats', 'leaderboard'].includes(view) || !['month', 'all'].includes(period)) throw new Error('Open a fresh /studytime card.');
        await interaction.deferUpdate();
        const rows = await recordsForGuild(client, interaction.guildId);
        await interaction.editReply(studyTimeMessage(rows, owner, { view, period, page }));
    } catch (error) {
        logger.warn(`Study time interaction: ${error.message}`);
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content: error.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        else await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
}
