import { SlashCommandBuilder } from 'discord.js';
import { openProgramBrowser } from '../../services/programUpdates/browser.js';
export default {
    guildOnly: true,
    data: new SlashCommandBuilder().setName('programs').setDescription('Find schools, program requirements, updates, subscriptions and settings').setDMPermission(false),
    execute: openProgramBrowser,
};
