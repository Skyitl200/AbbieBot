import { SlashCommandBuilder } from 'discord.js';
import test from './test.js';

export default {
    ...test,
    guildOnly: true,
    data: new SlashCommandBuilder().setName('quiz').setDescription('Choose a class and practice quiz questions, including anatomy lab models.').setDMPermission(false),
};
