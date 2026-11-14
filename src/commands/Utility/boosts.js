import { ChannelType, GuildSystemChannelFlags, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, SystemChannelFlagsBitField } from 'discord.js';
import { boostAnnouncement } from '../../services/boosts/announcement.js';
import { boostEmojis } from '../../services/boosts/artwork.js';
import { canPostBoosts } from '../../services/boosts/handler.js';
import { getBoostSettings, saveBoostSettings } from '../../services/boosts/settings.js';

export default {
    slashOnly: true,
    guildOnly: true,
    data: new SlashCommandBuilder().setName('boosts').setDescription('Configure purple server boost announcements.')
        .setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub.setName('setup').setDescription('Send future boost announcements to your general channel.')
            .addChannelOption(option => option.setName('channel').setDescription('Your general text channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(sub => sub.setName('preview').setDescription('Preview a boost announcement privately.'))
        .addSubcommand(sub => sub.setName('status').setDescription('Check the announcement channel and boost event settings.'))
        .addSubcommand(sub => sub.setName('disable').setDescription('Disable boost announcements and their message-XP bonus.')),
    category: 'Utility',
    async execute(interaction, _guildConfig, suppliedClient) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: 'You need Manage Server permission to configure boost announcements.', flags: MessageFlags.Ephemeral });
            return;
        }
        const client = suppliedClient || interaction.client;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const action = interaction.options.getSubcommand();
            const settings = await getBoostSettings(client, interaction.guildId);
            if (action === 'preview') {
                await interaction.editReply(boostAnnouncement({ guild: interaction.guild, user: interaction.user,
                    displayName: interaction.member?.displayName, emojis: await boostEmojis(client), preview: true }));
            } else if (action === 'disable') {
                await saveBoostSettings(client, interaction.guildId, { ...settings, enabled: false, xpBonusPercent: 0 });
                await interaction.editReply('Boost announcements and the 20% booster message-XP bonus are disabled.');
            } else if (action === 'status') {
                const notices = interaction.guild.systemChannelId && !interaction.guild.systemChannelFlags.has(GuildSystemChannelFlags.SuppressPremiumSubscriptions);
                await interaction.editReply(`Boost announcements: **${settings.enabled ? 'Enabled' : 'Disabled'}**\nGeneral channel: ${settings.channelId ? `<#${settings.channelId}>` : 'Not configured'}\nDiscord boost notices: **${notices ? 'Enabled' : 'Disabled — run /boosts setup'}**\nBooster message XP: **+${settings.xpBonusPercent}%**`);
            } else if (action === 'setup') {
                const channel = interaction.options.getChannel('channel', true);
                const me = interaction.guild.members.me || await interaction.guild.members.fetchMe();
                if (!canPostBoosts(channel, interaction.guildId, me)) throw new Error('I need View Channel, Send Messages, Embed Links, and Attach Files in that text channel.');
                const guild = interaction.guild;
                const noticesSuppressed = guild.systemChannelFlags.has(GuildSystemChannelFlags.SuppressPremiumSubscriptions);
                if ((!guild.systemChannelId || noticesSuppressed) && !me.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    throw new Error('Enable server boost system messages in Server Settings → Overview, or give me Manage Server so setup can enable them.');
                }
                if (!guild.systemChannelId) await guild.setSystemChannel(channel, 'Enable requested boost announcements');
                const systemChannel = await guild.channels.fetch(guild.systemChannelId || channel.id);
                if (!systemChannel?.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel)) throw new Error('I need View Channel in the server system-message channel to detect every boost.');
                if (noticesSuppressed) {
                    const flags = new SystemChannelFlagsBitField(guild.systemChannelFlags.bitfield).remove(GuildSystemChannelFlags.SuppressPremiumSubscriptions);
                    await guild.setSystemChannelFlags(flags, 'Enable requested boost announcements');
                }
                await boostEmojis(client);
                await saveBoostSettings(client, interaction.guildId, { enabled: true, channelId: channel.id, xpBonusPercent: 20 });
                await interaction.editReply(`Future boosts will be announced in <#${channel.id}> with the purple badge, eight perks, and **Boost Now** link. Current boosters also receive **20% extra message XP** when leveling is enabled.\nUse **/boosts preview** to inspect the announcement privately.`);
            }
        } catch (error) {
            await interaction.editReply({ content: `Could not configure boost announcements: ${error.message}`, embeds: [], components: [], attachments: [], files: [] });
        }
    },
};
