import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from 'discord.js';
import { boostBadgePath } from './artwork.js';

export function boostAnnouncement({ guild, user, displayName, emojis = {}, preview = false, timestamp = new Date() }) {
    const perks = [
        '😈 **Custom role** with unique appearance',
        `${emojis.xp || '🧪'} **20% XP** Gain`,
        '🖼️ **Send** external stickers',
        '🔊 **Send** voice notes in lounges',
        `${emojis.soundboard || '🎛️'} **Access** to soundboard`,
        '🎬 **Access** to stream in VC',
        `👑 **Access** to ${escapeMarkdown(guild.name)} Fun social commands`,
        '🏅 **Recognition** on the server leaderboard',
    ];
    const avatar = user.displayAvatarURL?.({ size: 128 });
    const author = { name: `${displayName || user.globalName || user.username} just boosted!`.slice(0, 256) };
    if (avatar) author.icon_url = avatar;
    // This announcement explicitly requires emoji and a timestamp. Construct its
    // API data directly so the legacy global embed setter sanitizers do not
    // strip the approved icons or the boost instructions from this one feature.
    const embed = new EmbedBuilder({
        color: 0xc65ae8, author,
        description: `Thank you, <@${user.id}>, for helping **${escapeMarkdown(guild.name)}** grow!`,
        thumbnail: { url: 'attachment://boost-rank.png' },
        fields: [{ name: '🔓 Perks Unlocked', value: perks.map((perk, i) => `${i + 1}️⃣ ${perk}`).join('\n') }],
        footer: { text: preview ? 'Preview only • No announcement was posted' : 'Server menu → Server Boost to apply a boost.' },
        timestamp: new Date(timestamp).toISOString(),
    });
    // Use Discord's stable server URL. Discord's Server Boost menu handles the
    // account-specific purchase/apply flow; no third-party checkout is involved.
    const button = new ButtonBuilder().setLabel('Boost Now').setStyle(ButtonStyle.Link)
        .setEmoji('💎').setURL(`https://discord.com/channels/${guild.id}`);
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)],
        files: [new AttachmentBuilder(boostBadgePath, { name: 'boost-rank.png' })],
        allowedMentions: { parse: [], users: preview ? [] : [user.id] } };
}
