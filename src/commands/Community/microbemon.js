import { SlashCommandBuilder } from 'discord.js';
import { openMicrobemon } from '../../services/microbemon/controller.js';

export default {
    slashOnly: true,
    guildOnly: true,
    data: new SlashCommandBuilder().setName('microbemon')
        .setDescription('Explore, battle, catch Microbemon, and open your Microbedeck.')
        .setDMPermission(false),
    execute: openMicrobemon
};
