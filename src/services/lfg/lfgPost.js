import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from 'discord.js';

// Reuse the server's subject artwork; healthcare programs use matching emoji art.
export function subjectThumbnail(emoji) {
    const custom = /^<(a?):\w+:(\d+)>$/.exec(emoji || '');
    if (custom) return `https://cdn.discordapp.com/emojis/${custom[2]}.${custom[1] ? 'gif' : 'png'}?size=256`;
    const codepoints = [...(emoji || '📚')]
        .map(character => character.codePointAt(0))
        .filter(point => point !== 0xfe0f)
        .map(point => point.toString(16)).join('-');
    return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`;
}

export function buildLfgPost({ hostName, hostAvatar, subject, description, capacity, channel, inviteUrl }) {
    // Construct the payload directly to preserve this card's emojis and footer.
    const embed = new EmbedBuilder({
        color: 0x2dd4bf,
        author: {
            name: `${hostName} is looking for a study group!`.slice(0, 256),
            ...(hostAvatar ? { icon_url: hostAvatar } : {})
        },
        description: `${subject.emoji} **${escapeMarkdown(subject.label)}**\n\n${description}`.slice(0, 4096),
        fields: [
            { name: '🔊 Study Room', value: `<#${channel.id}>`, inline: true },
            { name: '👥 Group Size', value: `Up to ${capacity} people`, inline: true }
        ],
        thumbnail: { url: subjectThumbnail(subject.emoji) },
        footer: { text: 'Join the voice room to study together.' },
        timestamp: new Date().toISOString()
    });
    const join = new ButtonBuilder()
        .setLabel('Join Study Room')
        .setEmoji('🔊')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl);
    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(join)],
        allowedMentions: { parse: [] }
    };
}
