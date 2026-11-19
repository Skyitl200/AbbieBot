import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { openProgramUpdates } from '../../services/programUpdates/interface.js';
import { openProgramBrowser } from '../../services/programUpdates/browser.js';
export default {
    guildOnly: true,
    data: new SlashCommandBuilder().setName('programupdatesadmin').setDescription('Configure programme update channels, sources and checks').setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(c => c.setName('setup').setDescription('Configure public updates and moderator review channels (Manage Server)')
            .addChannelOption(o => o.setName('channel').setDescription('Public updates channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
            .addChannelOption(o => o.setName('review-channel').setDescription('Moderator review channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(c => c.setName('add-source').setDescription('Find and approve an official source using dropdowns (Manage Server)'))
        .addSubcommand(c => c.setName('sources').setDescription('List tracked sources').addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)))
        .addSubcommand(c => c.setName('requests').setDescription('List coverage requests (Manage Server)').addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)))
        .addSubcommand(c => c.setName('source-remove').setDescription('Remove a source (Manage Server)').addStringOption(o => o.setName('id').setDescription('Source ID').setRequired(true)))
        .addSubcommand(c => c.setName('check').setDescription('Check tracked sources now (Manage Server)')),
    execute: interaction => interaction.options.getSubcommand() === 'add-source' ? openProgramBrowser(interaction, 'source') : openProgramUpdates(interaction),
};
