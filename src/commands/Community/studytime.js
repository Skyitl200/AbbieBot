import { SlashCommandBuilder } from 'discord.js';
import { openStudyTime } from '../../services/studyTime/interface.js';
export default {
    guildOnly: true,
    data: new SlashCommandBuilder().setName('studytime').setDescription('Study-time leaderboard, personal tiers, and tracked resources.').setDMPermission(false)
        .addStringOption(o => o.setName('view').setDescription('Choose a leaderboard, personal stats, or publish a resource.').addChoices(
            { name: 'Leaderboard', value: 'leaderboard' }, { name: 'Personal stats', value: 'stats' }, { name: 'Publish resource (Manage Server)', value: 'resource' }))
        .addStringOption(o => o.setName('period').setDescription('Monthly or all-time study credit.').addChoices({ name: 'This month', value: 'month' }, { name: 'All time', value: 'all' }))
        .addUserOption(o => o.setName('member').setDescription('Member to show in personal stats.'))
        .addStringOption(o => o.setName('title').setDescription('Title when publishing a resource.').setMaxLength(180))
        .addStringOption(o => o.setName('url').setDescription('HTTPS link when publishing a resource.').setMaxLength(500)),
    execute: openStudyTime,
};
