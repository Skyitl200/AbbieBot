import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

import { pgDb } from '../utils/database.js';
import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { logger } from '../utils/logger.js';

const ANSWER_LABELS = {
    A: 'option_a',
    B: 'option_b',
    C: 'option_c',
    D: 'option_d'
};

const QUIZ_REWARD = 10;

export const quizAnswerHandler = {
    name: 'quiz',

    async execute(interaction, client, args = []) {
        try {
            // Immediately acknowledge the button click
            await interaction.deferUpdate();

            // customId format:
            // quiz:A:123:USER_ID
            //
            // Handler name = quiz
            // args = [answer, questionId, ownerId]
            const [selectedAnswer, questionId, ownerId] = args;

            if (!selectedAnswer || !questionId || !ownerId) {
                await interaction.followUp({
                    content: '❌ Invalid quiz answer.',
                    ephemeral: true
                });
                return;
            }

            // Only the person who started the quiz can answer it
            if (interaction.user.id !== ownerId) {
                await interaction.followUp({
                    content: '❌ This quiz belongs to someone else. Use `/quiz` to start your own question.',
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

            const correctAnswer = String(q.correct_answer)
                .trim()
                .toUpperCase();

            if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
                logger.error(
                    `Quiz question ${q.id} has an invalid correct_answer: ${q.correct_answer}`
                );

                await interaction.followUp({
                    content: '❌ This quiz question has an invalid answer configured.',
                    ephemeral: true
                });
                return;
            }

            const isCorrect = answer === correctAnswer;

            const correctColumn = ANSWER_LABELS[correctAnswer];
            const correctText = q[correctColumn];

            let newBalance = null;

            // Correct answers award $10 to the existing universal economy wallet
            if (isCorrect) {
                const guildId = interaction.guildId;
                const userId = interaction.user.id;

                const userData = await getEconomyData(
                    client,
                    guildId,
                    userId
                );

                if (!userData) {
                    throw new Error(
                        `Failed to load economy data for quiz reward. User: ${userId}`
                    );
                }

                userData.wallet = (userData.wallet || 0) + QUIZ_REWARD;

                await setEconomyData(
                    client,
                    guildId,
                    userId,
                    userData
                );

                newBalance = userData.wallet;

                logger.info('[ECONOMY_TRANSACTION] Quiz reward earned', {
                    userId,
                    guildId,
                    questionId: q.id,
                    amount: QUIZ_REWARD,
                    newWallet: newBalance,
                    timestamp: new Date().toISOString()
                });
            }

            // Disable all buttons after the owner answers.
            // Correct answer = green.
            // Incorrect selected answer = red.
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
                        .setCustomId(
                            `quiz:${letter}:${q.id}:${ownerId}`
                        )
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
                        ? `You earned **$${QUIZ_REWARD}**!\n\n💰 New Balance: **$${newBalance.toLocaleString()}**`
                        : `The correct answer was **${correctAnswer}. ${correctText}**`
                )
                .addFields({
                    name: 'Explanation',
                    value: q.explanation || 'No explanation provided.'
                });

            // Update the original quiz so the buttons cannot be used again
            await interaction.editReply({
                components: [disabledRow]
            });

            // Send the answer result
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
                logger.error(
                    'Failed to send quiz error response:',
                    replyError
                );
            }
        }
    }
};

export default quizAnswerHandler;
