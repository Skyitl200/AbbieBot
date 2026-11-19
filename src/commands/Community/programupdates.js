import { SlashCommandBuilder } from 'discord.js';
import { openProgramBrowser } from '../../services/programUpdates/browser.js';
export default {
    guildOnly: true,
    data: new SlashCommandBuilder().setName('programupdates').setDescription('Browse programmes, countries, regions and schools using dropdown menus').setDMPermission(false),
    execute: openProgramBrowser,
};
