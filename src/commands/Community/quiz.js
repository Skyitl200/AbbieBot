import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

import { pgDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Answer a random nursing question!'),

    category: 'Community',

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Grab one random question from PostgreSQL
            const result = await pgDb.pool.query(`
                SELECT *
                FROM quiz_questions
                ORDER BY RANDOM()
                LIMIT 1
            `);

            if (result.rows.length === 0) {
                return interaction.editReply(
                    '❌ There are no quiz questions in the database yet.'
                );
            }

            const q = result.rows[0];

            const embed = new EmbedBuilder()
                .setTitle('🩺 Nursing Quiz')
                .setDescription(`**${q.question}**`)
                .addFields(
                    {
                        name: 'Category',
                        value: q.category || 'General',
                        inline: true
                    },
                    {
                        name: 'Difficulty',
                        value: q.difficulty || 'Normal',
                        inline: true
                    }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`quiz:A:${q.id}`)
                    .setLabel(`A. ${q.option_a}`)
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(`quiz:B:${q.id}`)
                    .setLabel(`B. ${q.option_b}`)
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(`quiz:C:${q.id}`)
                    .setLabel(`C. ${q.option_c}`)
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(`quiz:D:${q.id}`)
                    .setLabel(`D. ${q.option_d}`)
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            logger.error('Quiz command error:', error);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(
                    '❌ Something went wrong while loading the quiz.'
                );
            } else {
                await interaction.reply({
                    content: '❌ Something went wrong while loading the quiz.',
                    ephemeral: true
                });
            }
        }
    }
};
