import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

import { pgDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const ANSWER_LABELS = {
    A: 'option_a',
    B: 'option_b',
    C: 'option_c',
    D: 'option_d'
};

export const quizAnswerHandler = {
    name: 'quiz',

    async execute(interaction, client, args = []) {
        try {
            // Immediately acknowledge the button click
            await interaction.deferUpdate();

            // customId format:
            // quiz_A_123
            //
            // Handler name = quiz
            // args should contain A and 123
            const [selectedAnswer, questionId] = args;

            if (!selectedAnswer || !questionId) {
                await interaction.followUp({
                    content: '❌ Invalid quiz answer.',
                    ephemeral: true
                });
                return;
            }

            const answer = selectedAnswer.toUpperCase();

            if (!['A', 'B', 'C', 'D'].includes(answer)) {
                await interaction.followUp({
                    content: '❌ Invalid answer choice.',
                    ephemeral: true
                });
                return;
            }

            // Get the question from PostgreSQL
            const result = await pgDb.pool.query(
                `
                SELECT *
                FROM quiz_questions
                WHERE id = $1
                LIMIT 1
                `,
                [questionId]
            );

            if (result.rows.length === 0) {
                await interaction.followUp({
                    content: '❌ This quiz question could not be found.',
                    ephemeral: true
                });
                return;
            }

            const q = result.rows[0];

            const correctAnswer = String(q.correct_answer).toUpperCase();
            const isCorrect = answer === correctAnswer;

            const correctColumn = ANSWER_LABELS[correctAnswer];
            const correctText = q[correctColumn];

            // Disable buttons after answering
            const disabledRow = new ActionRowBuilder().addComponents(
                ['A', 'B', 'C', 'D'].map(letter => {
                    const column = ANSWER_LABELS[letter];

                    let style = ButtonStyle.Secondary;

                    if (letter === correctAnswer) {
                        style = ButtonStyle.Success;
                    } else if (letter === answer) {
                        style = ButtonStyle.Danger;
                    }

                    return new ButtonBuilder()
                        .setCustomId(`quiz_${letter}_${q.id}`)
                        .setLabel(`${letter}. ${q[column]}`)
                        .setStyle(style)
                        .setDisabled(true);
                })
            );

            const resultEmbed = new EmbedBuilder()
                .setTitle(
                    isCorrect
                        ? '✅ Correct!'
                        : '❌ Incorrect'
                )
                .setDescription(
                    isCorrect
                        ? `You earned **${q.points ?? 10} points!**`
                        : `The correct answer was **${correctAnswer}. ${correctText}**`
                )
                .addFields({
                    name: 'Explanation',
                    value: q.explanation || 'No explanation provided.'
                });

            await interaction.editReply({
                components: [disabledRow]
            });

            await interaction.followUp({
                embeds: [resultEmbed]
            });

        } catch (error) {
            logger.error('Quiz button error:', error);

            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.reply({
                        content: '❌ Something went wrong while checking your answer.',
                        ephemeral: true
                    });
                } else {
                    await interaction.followUp({
                        content: '❌ Something went wrong while checking your answer.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                logger.error('Failed to send quiz error response:', replyError);
            }
        }
    }
};

export default quizAnswerHandler;
