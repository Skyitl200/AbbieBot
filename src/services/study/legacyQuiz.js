import {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder
} from 'discord.js';

import { logger } from '../../utils/logger.js';

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Study nursing and health science questions!'),

    category: 'Community',

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const embed = new EmbedBuilder()
                .setTitle('🩺 Nursing Study Quiz')
                .setDescription(
                    '**Choose what you would like to study.**\n\n' +
                    'You can choose a specific subject or select Random for a question from any subject.'
                );

            const subjectMenu = new StringSelectMenuBuilder()
                .setCustomId('quiz-subject-select')
                .setPlaceholder('Choose a subject...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Random')
                        .setDescription('Question from any subject')
                        .setValue('random')
                        .setEmoji('🎲'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Anatomy & Physiology')
                        .setDescription('Study the human body and its systems')
                        .setValue('anatomy_physiology')
                        .setEmoji('🫀'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Microbiology')
                        .setDescription('Study microorganisms and pathogens')
                        .setValue('microbiology')
                        .setEmoji('🦠'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Nursing')
                        .setDescription('Study nursing concepts and patient care')
                        .setValue('nursing')
                        .setEmoji('🩺'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('TEAS')
                        .setDescription('Practice ATI TEAS-style material')
                        .setValue('teas')
                        .setEmoji('📚')
                );

            const row = new ActionRowBuilder()
                .addComponents(subjectMenu);

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            logger.error('Quiz command error:', error);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ Something went wrong while loading the quiz.',
                    embeds: [],
                    components: []
                });
            } else {
                await interaction.reply({
                    content: '❌ Something went wrong while loading the quiz.',
                    ephemeral: true
                });
            }
        }
    }
};
