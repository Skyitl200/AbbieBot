import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { PROGRAMS, TOPICS, APPLICANTS } from '../../services/programUpdates/catalog.js';
import { openProgramUpdates } from '../../services/programUpdates/interface.js';
const choices = PROGRAMS.map(p => ({ name: p.name, value: p.id }));
const filters = command => command
    .addStringOption(o => o.setName('program').setDescription('Health programme').setRequired(true).addChoices(...choices))
    .addStringOption(o => o.setName('country').setDescription('Two-letter destination country code: US, CA, GB, AU, IN, ZA…').setRequired(true).setMinLength(2).setMaxLength(2))
    .addStringOption(o => o.setName('region').setDescription('State, province or region; omit for the whole country').setMaxLength(80))
    .addStringOption(o => o.setName('school').setDescription('School name; omit to browse tracked schools').setMaxLength(120))
    .addStringOption(o => o.setName('topic').setDescription('Update topic; omit for all').addChoices(...TOPICS.map(value => ({ name: value, value }))))
    .addStringOption(o => o.setName('applicant').setDescription('Applicant type').addChoices(...APPLICANTS.map(value => ({ name: value, value }))));
export default {
    guildOnly: true,
    data: new SlashCommandBuilder().setName('programupdates').setDescription('Find worldwide programme sources and subscribe to reviewed updates').setDMPermission(false)
        .addSubcommand(c => filters(c.setName('find').setDescription('Find monitored school sources or discover school pages worldwide')))
        .addSubcommand(c => filters(c.setName('compare').setDescription('Compare sources for two schools: separate school names with |')))
        .addSubcommand(c => filters(c.setName('subscribe').setDescription('Subscribe to matching programme and location updates')))
        .addSubcommand(c => c.setName('subscriptions').setDescription('Show your subscriptions').addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)))
        .addSubcommand(c => c.setName('unsubscribe').setDescription('Remove one of your subscriptions').addStringOption(o => o.setName('id').setDescription('Subscription ID from /programupdates subscriptions').setRequired(true)))
        .addSubcommand(c => c.setName('setup').setDescription('Configure public updates and moderator review channels (Manage Server)')
            .addChannelOption(o => o.setName('channel').setDescription('Public programme updates channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
            .addChannelOption(o => o.setName('review-channel').setDescription('Moderator channel for reviewing source changes').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(c => filters(c.setName('source-add').setDescription('Approve an official school or regulator source (Manage Server)'))
            .addStringOption(o => o.setName('url').setDescription('Official public HTTPS page or feed').setRequired(false).setMaxLength(1000))
            .addStringOption(o => o.setName('section').setDescription('Optional CSS selector for the requirements section').setMaxLength(200)))
        .addSubcommand(c => c.setName('sources').setDescription('List monitored sources and their check status').addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)))
        .addSubcommand(c => c.setName('source-remove').setDescription('Stop monitoring a source (Manage Server)').addStringOption(o => o.setName('id').setDescription('Source ID').setRequired(true)))
        .addSubcommand(c => c.setName('requests').setDescription('List coverage requests (Manage Server)').addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)))
        .addSubcommand(c => c.setName('check').setDescription('Check monitored sources now (Manage Server)'))
        .addSubcommand(c => filters(c.setName('request').setDescription('Request source coverage for a school or location'))),
    execute: openProgramUpdates,
};
