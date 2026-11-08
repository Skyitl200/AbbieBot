import { ChannelType, MessageFlags } from 'discord.js';

const isLfgName = name => ['lfg', 'lookingforgroup'].includes(String(name || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

export function lfgChannelAccess(interaction, configuredId = process.env.LFG_CHANNEL_ID) {
    if (!(interaction.inGuild?.() ?? Boolean(interaction.guildId || interaction.guild?.id))) {
        return { allowed: false, message: 'Use /lfg in the server’s LFG channel.' };
    }
    const currentId = interaction.channelId || interaction.channel?.id;
    const explicitId = configuredId?.trim();
    if (explicitId) return { allowed: currentId === explicitId, channelId: explicitId,
        message: `Use /lfg in <#${explicitId}>. LFG setup is only available there.` };
    const candidates = [...(interaction.guild?.channels?.cache?.values() || [])]
        .filter(channel => channel.type === ChannelType.GuildText && isLfgName(channel.name));
    if (candidates.length !== 1) return { allowed: false,
        message: 'The LFG channel could not be identified uniquely. Ask an administrator to configure LFG_CHANNEL_ID or keep one text channel named lfg or looking-for-group.' };
    const id = candidates[0].id;
    return { allowed: currentId === id, channelId: id,
        message: `Use /lfg in <#${id}>. LFG setup is only available there.` };
}

export async function requireLfgChannel(interaction) {
    const access = lfgChannelAccess(interaction);
    if (access.allowed) return true;
    await interaction.reply({ content: access.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return false;
}
