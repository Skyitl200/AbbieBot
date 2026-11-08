import { MessageFlags } from 'discord.js';

export const LFG_CHANNEL_ID = '1553916775928959049';
export const LFG_CHANNEL_ONLY_MESSAGE = 'You can only use the /lfg command in the LFG text channel.';

export function lfgChannelAccess(interaction) {
    const inGuild = interaction.inGuild?.() ?? Boolean(interaction.guildId || interaction.guild?.id);
    const currentId = interaction.channelId || interaction.channel?.id;
    return { allowed: Boolean(inGuild && currentId === LFG_CHANNEL_ID), channelId: LFG_CHANNEL_ID, message: LFG_CHANNEL_ONLY_MESSAGE };
}

export async function requireLfgChannel(interaction) {
    const access = lfgChannelAccess(interaction);
    if (access.allowed) return true;
    await interaction.reply({ content: access.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return false;
}
