import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

import { pgDb } from '../utils/database.js';
import {
    getEconomyData,
    setEconomyData
} from '../utils/economy.js';

import {
    getQuizSession,
    deleteQuizSession,
    getCurrentQuestion,
    moveToNextQuestion,
    isQuizComplete,
    recordQuizAnswer,
    getQuizProgress
} from '../utils/quizSessions.js';

import { logger } from '../utils/logger.js';

const ANSWER_LABELS = {
    A: 'option_a',
    B: 'option_b',
    C: 'option_c',
    D: 'option_d'
};

const QUIZ_REWARD = 10;


/*
 * Build a normal quiz question.
 */
function buildQuestionMessage(
    q,
    ownerId,
    current,
    total
) {
    const embed = new EmbedBuilder()
        .setTitle(
            `🩺 Question ${current} / ${total}`
        )
        .setDescription(
            `**${q.question}**`
        )
        .addFields(
            {
                name: 'Subject',
                value: q.subject || 'General',
                inline: true
            },
            {
                name: 'Topic',
                value: q.category || 'General',
                inline: true
            },
            {
                name: 'Difficulty',
                value: q.difficulty || 'Normal',
                inline: true
            }
        )
        .setFooter({
            text:
                `Progress: ${current} of ${total}`
        });

    const answerRow =
        new ActionRowBuilder().addComponents(
            ['A', 'B', 'C', 'D'].map(
                letter => {
                    const column =
                        ANSWER_LABELS[letter];

                    return new ButtonBuilder()
                        .setCustomId(
                            `quiz:${letter}:${q.id}:${ownerId}`
                        )
                        .setLabel(
                            `${letter}. ${q[column]}`
                        )
                        .setStyle(
                            ButtonStyle.Primary
                        );
                }
            )
        );

    return {
        embeds: [embed],
        components: [answerRow]
    };
}


/*
 * ANSWER BUTTON HANDLER
 */
export const quizAnswerHandler = {
    name: 'quiz',

    async execute(
        interaction,
        client,
        args = []
    ) {
        try {
            await interaction.deferUpdate();

            const [
                selectedAnswer,
                questionId,
                ownerId
            ] = args;

            if (
                !selectedAnswer ||
                !questionId ||
                !ownerId
            ) {
                await interaction.followUp({
                    content:
                        '❌ Invalid quiz answer.',
                    ephemeral: true
                });

                return;
            }


            /*
             * Make sure only the person
             * who started the quiz can answer.
             */
            if (
                interaction.user.id !== ownerId
            ) {
                await interaction.followUp({
                    content:
                        '❌ This quiz belongs to someone else. Use `/quiz` to start your own quiz.',
                    ephemeral: true
                });

                return;
            }


            const answer =
                selectedAnswer.toUpperCase();

            if (
                !['A', 'B', 'C', 'D'].includes(
                    answer
                )
            ) {
                await interaction.followUp({
                    content:
                        '❌ Invalid answer choice.',
                    ephemeral: true
                });

                return;
            }


            /*
             * Get the question from PostgreSQL.
             */
            const result =
                await pgDb.pool.query(
                    `
                    SELECT *
                    FROM quiz_questions
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [questionId]
                );


            if (
                result.rows.length === 0
            ) {
                await interaction.followUp({
                    content:
                        '❌ This quiz question could not be found.',
                    ephemeral: true
                });

                return;
            }


            const q = result.rows[0];

            const correctAnswer =
                String(q.correct_answer)
                    .trim()
                    .toUpperCase();


            if (
                !['A', 'B', 'C', 'D'].includes(
                    correctAnswer
                )
            ) {
                logger.error(
                    `Quiz question ${q.id} has an invalid correct_answer: ${q.correct_answer}`
                );

                await interaction.followUp({
                    content:
                        '❌ This quiz question has an invalid answer configured.',
                    ephemeral: true
                });

                return;
            }


            const isCorrect =
                answer === correctAnswer;

            const correctColumn =
                ANSWER_LABELS[
                    correctAnswer
                ];

            const correctText =
                q[correctColumn];


            /*
             * Find the active quiz session.
             */
            const session =
                getQuizSession(
                    interaction.guildId,
                    interaction.user.id
                );


            /*
             * Record score in the session.
             */
            if (session) {
                recordQuizAnswer(
                    session,
                    isCorrect,
                    isCorrect
                        ? QUIZ_REWARD
                        : 0
                );
            }


            let newBalance = null;


            /*
             * Correct answer:
             * award $10.
             */
            if (isCorrect) {
                const guildId =
                    interaction.guildId;

                const userId =
                    interaction.user.id;

                const userData =
                    await getEconomyData(
                        client,
                        guildId,
                        userId
                    );


                if (!userData) {
                    throw new Error(
                        `Failed to load economy data for quiz reward. User: ${userId}`
                    );
                }


                userData.wallet =
                    (userData.wallet || 0) +
                    QUIZ_REWARD;


                await setEconomyData(
                    client,
                    guildId,
                    userId,
                    userData
                );


                newBalance =
                    userData.wallet;


                logger.info(
                    '[ECONOMY_TRANSACTION] Quiz reward earned',
                    {
                        userId,
                        guildId,
                        questionId: q.id,
                        amount:
                            QUIZ_REWARD,
                        newWallet:
                            newBalance,
                        timestamp:
                            new Date()
                                .toISOString()
                    }
                );
            }


            /*
             * Disable answer buttons.
             *
             * Correct = green
             * Selected wrong = red
             */
            const disabledRow =
                new ActionRowBuilder()
                    .addComponents(
                        ['A', 'B', 'C', 'D']
                            .map(letter => {
                                const column =
                                    ANSWER_LABELS[
                                        letter
                                    ];

                                let style =
                                    ButtonStyle
                                        .Secondary;


                                if (
                                    letter ===
                                    correctAnswer
                                ) {
                                    style =
                                        ButtonStyle
                                            .Success;
                                } else if (
                                    letter ===
                                    answer
                                ) {
                                    style =
                                        ButtonStyle
                                            .Danger;
                                }


                                return new ButtonBuilder()
                                    .setCustomId(
                                        `quiz:${letter}:${q.id}:${ownerId}`
                                    )
                                    .setLabel(
                                        `${letter}. ${q[column]}`
                                    )
                                    .setStyle(
                                        style
                                    )
                                    .setDisabled(
                                        true
                                    );
                            })
                    );


            /*
             * Update original question.
             */
            await interaction.editReply({
                components: [
                    disabledRow
                ]
            });


            /*
             * SINGLE QUESTION MODE
             *
             * If there isn't an active
             * multi-question session,
             * preserve old behavior.
             */
            if (!session) {
                const resultEmbed =
                    new EmbedBuilder()
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
                            name:
                                'Explanation',
                            value:
                                q.explanation ||
                                'No explanation provided.'
                        });


                await interaction.followUp({
                    embeds: [
                        resultEmbed
                    ]
                });

                return;
            }


            /*
             * Get current quiz progress
             * BEFORE moving forward.
             */
            const progress =
                getQuizProgress(
                    session
                );


            /*
             * Determine whether another
             * question remains.
             */
            const hasMoreQuestions =
                session.currentIndex + 1 <
                session.questions.length;


            /*
             * RESULT EMBED
             */
            const resultEmbed =
                new EmbedBuilder()
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
                    .addFields(
                        {
                            name:
                                'Explanation',
                            value:
                                q.explanation ||
                                'No explanation provided.'
                        },
                        {
                            name:
                                'Quiz Progress',
                            value:
                                `Question **${progress.current} / ${progress.total}**\n` +
                                `✅ Correct: **${progress.correct}**\n` +
                                `❌ Incorrect: **${progress.incorrect}**\n` +
                                `💰 Earned: **$${progress.moneyEarned}**`
                        }
                    );


            /*
             * MORE QUESTIONS REMAIN
             */
            if (hasMoreQuestions) {
                const nextRow =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `quiznext:${ownerId}`
                                )
                                .setLabel(
                                    'Next Question'
                                )
                                .setEmoji('➡️')
                                .setStyle(
                                    ButtonStyle
                                        .Primary
                                )
                        );


                await interaction.followUp({
                    embeds: [
                        resultEmbed
                    ],
                    components: [
                        nextRow
                    ]
                });

                return;
            }


            /*
             * FINAL QUESTION
             *
             * Quiz is complete.
             */
            const finalCorrect =
                session.correct;

            const finalIncorrect =
                session.incorrect;

            const total =
                session.questions.length;

            const percentage =
                Math.round(
                    (finalCorrect / total) *
                    100
                );


            const finalEmbed =
                new EmbedBuilder()
                    .setTitle(
                        '🎉 Quiz Complete!'
                    )
                    .setDescription(
                        `You finished all **${total} questions**!`
                    )
                    .addFields(
                        {
                            name:
                                '📊 Final Score',
                            value:
                                `**${finalCorrect} / ${total} (${percentage}%)**`,
                            inline: false
                        },
                        {
                            name:
                                '✅ Correct',
                            value:
                                `${finalCorrect}`,
                            inline: true
                        },
                        {
                            name:
                                '❌ Incorrect',
                            value:
                                `${finalIncorrect}`,
                            inline: true
                        },
                        {
                            name:
                                '💰 Total Earned',
                            value:
                                `$${session.moneyEarned}`,
                            inline: true
                        }
                    )
                    .setFooter({
                        text:
                            'Great work! Use /quiz to study again.'
                    });


            /*
             * Show explanation for final
             * question first.
             */
            await interaction.followUp({
                embeds: [
                    resultEmbed,
                    finalEmbed
                ]
            });


            /*
             * Delete completed session.
             */
            deleteQuizSession(
                interaction.guildId,
                interaction.user.id
            );


        } catch (error) {
            logger.error(
                'Quiz button error:',
                error
            );


            try {
                if (
                    !interaction.deferred &&
                    !interaction.replied
                ) {
                    await interaction.reply({
                        content:
                            '❌ Something went wrong while checking your answer.',
                        ephemeral: true
                    });
                } else {
                    await interaction.followUp({
                        content:
                            '❌ Something went wrong while checking your answer.',
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


/*
 * NEXT QUESTION BUTTON
 *
 * customId:
 * quiznext:USER_ID
 */
export const quizNextHandler = {
    name: 'quiznext',

    async execute(
        interaction,
        client,
        args = []
    ) {
        try {
            await interaction.deferUpdate();


            const [ownerId] = args;


            if (!ownerId) {
                await interaction.followUp({
                    content:
                        '❌ Invalid quiz session.',
                    ephemeral: true
                });

                return;
            }


            /*
             * Owner protection.
             */
            if (
                interaction.user.id !==
                ownerId
            ) {
                await interaction.followUp({
                    content:
                        '❌ This quiz belongs to someone else.',
                    ephemeral: true
                });

                return;
            }


            const session =
                getQuizSession(
                    interaction.guildId,
                    interaction.user.id
                );


            if (!session) {
                await interaction.followUp({
                    content:
                        '❌ This quiz session has expired. Use `/quiz` to start another one.',
                    ephemeral: true
                });

                return;
            }


            /*
             * Advance to next question.
             */
            const nextQuestion =
                moveToNextQuestion(
                    session
                );


            if (
                isQuizComplete(session) ||
                !nextQuestion
            ) {
                await interaction.followUp({
                    content:
                        '✅ This quiz is already complete.',
                    ephemeral: true
                });

                return;
            }


            const progress =
                getQuizProgress(
                    session
                );


            /*
             * Remove Next Question button
             * from previous result.
             */
            await interaction.editReply({
                components: []
            });


            /*
             * Send the next question.
             */
            await interaction.followUp(
                buildQuestionMessage(
                    nextQuestion,
                    ownerId,
                    progress.current,
                    progress.total
                )
            );


        } catch (error) {
            logger.error(
                'Quiz next button error:',
                error
            );


            try {
                await interaction.followUp({
                    content:
                        '❌ Something went wrong while loading the next question.',
                    ephemeral: true
                });
            } catch (replyError) {
                logger.error(
                    'Failed to send next-question error:',
                    replyError
                );
            }
        }
    }
};


export default quizAnswerHandler;
