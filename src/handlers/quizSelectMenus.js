import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';

import { pgDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

import {
    createQuizSession,
    getCurrentQuestion
} from '../utils/quizSessions.js';

const SUBJECT_SELECT_ID = 'quiz-subject-select';
const CATEGORY_SELECT_ID = 'quiz-category-select';
const COUNT_SELECT_ID = 'quiz-count-select';

const SUBJECTS = {
    random: {
        label: 'Random',
        emoji: '🎲'
    },
    anatomy_physiology: {
        label: 'Anatomy & Physiology',
        emoji: '🫀'
    },
    microbiology: {
        label: 'Microbiology',
        emoji: '🦠'
    },
    nursing: {
        label: 'Nursing',
        emoji: '🩺'
    },
    teas: {
        label: 'TEAS',
        emoji: '📚'
    }
};

const AP_CATEGORIES = {
    random_ap: {
        label: 'Random A&P',
        emoji: '🎲'
    },
    endocrine: {
        label: 'Endocrine System',
        emoji: '🧪'
    },
    cardiovascular: {
        label: 'Cardiovascular System',
        emoji: '❤️'
    },
    nervous: {
        label: 'Nervous System',
        emoji: '🧠'
    },
    muscular: {
        label: 'Muscular System',
        emoji: '💪'
    },
    skeletal: {
        label: 'Skeletal System',
        emoji: '🦴'
    },
    respiratory: {
        label: 'Respiratory System',
        emoji: '🫁'
    },
    digestive: {
        label: 'Digestive System',
        emoji: '🍽️'
    },
    urinary: {
        label: 'Urinary System',
        emoji: '💧'
    },
    reproductive: {
        label: 'Reproductive System',
        emoji: '🧬'
    },
    lymphatic_immune: {
        label: 'Lymphatic & Immune System',
        emoji: '🛡️'
    },
    integumentary: {
        label: 'Integumentary System',
        emoji: '🧴'
    }
};

const ANSWER_LABELS = {
    A: 'option_a',
    B: 'option_b',
    C: 'option_c',
    D: 'option_d'
};

/*
 * Creates the question card.
 *
 * Example:
 * Question 1 / 20
 */
function buildQuestionMessage(
    q,
    ownerId,
    current = 1,
    total = 1
) {
    const embed = new EmbedBuilder()
        .setTitle(`🩺 Question ${current} / ${total}`)
        .setDescription(`**${q.question}**`)
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
            text: `Progress: ${current} of ${total}`
        });

    const answerRow = new ActionRowBuilder().addComponents(
        ['A', 'B', 'C', 'D'].map(letter => {
            const column = ANSWER_LABELS[letter];

            return new ButtonBuilder()
                .setCustomId(
                    `quiz:${letter}:${q.id}:${ownerId}`
                )
                .setLabel(
                    `${letter}. ${q[column]}`
                )
                .setStyle(ButtonStyle.Primary);
        })
    );

    return {
        embeds: [embed],
        components: [answerRow]
    };
}

/*
 * Anatomy & Physiology category menu
 */
function buildAPCategoryMenu() {
    const embed = new EmbedBuilder()
        .setTitle('🫀 Anatomy & Physiology')
        .setDescription(
            '**Choose the body system you would like to study.**\n\n' +
            'Or choose Random A&P for questions from any A&P topic.'
        );

    const menu = new StringSelectMenuBuilder()
        .setCustomId(CATEGORY_SELECT_ID)
        .setPlaceholder('Choose an A&P topic...')
        .addOptions(
            Object.entries(AP_CATEGORIES).map(
                ([value, category]) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(category.label)
                        .setValue(value)
                        .setEmoji(category.emoji)
            )
        );

    const row = new ActionRowBuilder()
        .addComponents(menu);

    return {
        embeds: [embed],
        components: [row]
    };
}

/*
 * Question-count menu
 */
function buildQuestionCountMenu(selectedCategory) {
    const category =
        AP_CATEGORIES[selectedCategory];

    const embed = new EmbedBuilder()
        .setTitle('📚 Quiz Length')
        .setDescription(
            `**${category.emoji} ${category.label}**\n\n` +
            'How many questions would you like to do?'
        );

    const menu = new StringSelectMenuBuilder()
        .setCustomId(COUNT_SELECT_ID)
        .setPlaceholder(
            'Choose number of questions...'
        )
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('1 Question')
                .setDescription(
                    'Quick practice question'
                )
                .setValue(
                    `${selectedCategory}|1`
                )
                .setEmoji('1️⃣'),

            new StringSelectMenuOptionBuilder()
                .setLabel('5 Questions')
                .setDescription(
                    'Short practice session'
                )
                .setValue(
                    `${selectedCategory}|5`
                )
                .setEmoji('5️⃣'),

            new StringSelectMenuOptionBuilder()
                .setLabel('20 Questions')
                .setDescription(
                    'Full study session'
                )
                .setValue(
                    `${selectedCategory}|20`
                )
                .setEmoji('📝'),

            new StringSelectMenuOptionBuilder()
                .setLabel('50 Questions')
                .setDescription(
                    'Challenge yourself'
                )
                .setValue(
                    `${selectedCategory}|50`
                )
                .setEmoji('🔥')
        );

    const row = new ActionRowBuilder()
        .addComponents(menu);

    return {
        embeds: [embed],
        components: [row]
    };
}

/*
 * FIRST MENU
 *
 * /quiz
 * ↓
 * Choose subject
 */
export const quizSubjectSelectMenu = {
    name: SUBJECT_SELECT_ID,

    async execute(interaction) {
        try {
            await interaction.deferUpdate();

            const selectedSubject =
                interaction.values[0];

            if (!SUBJECTS[selectedSubject]) {
                await interaction.followUp({
                    content:
                        '❌ Invalid quiz subject.',
                    ephemeral: true
                });

                return;
            }

            /*
             * A&P opens the body-system menu.
             */
            if (
                selectedSubject ===
                'anatomy_physiology'
            ) {
                await interaction.editReply(
                    buildAPCategoryMenu()
                );

                return;
            }

            /*
             * Keep the existing behavior
             * for Random, Microbiology,
             * Nursing and TEAS for now.
             */
            let result;

            if (selectedSubject === 'random') {
                result =
                    await pgDb.pool.query(`
                        SELECT *
                        FROM quiz_questions
                        ORDER BY RANDOM()
                        LIMIT 1
                    `);
            } else {
                const subjectName =
                    SUBJECTS[
                        selectedSubject
                    ].label;

                result =
                    await pgDb.pool.query(
                        `
                        SELECT *
                        FROM quiz_questions
                        WHERE LOWER(subject) = LOWER($1)
                        ORDER BY RANDOM()
                        LIMIT 1
                        `,
                        [subjectName]
                    );
            }

            if (
                result.rows.length === 0
            ) {
                await interaction.followUp({
                    content:
                        `❌ There are no questions available for **${SUBJECTS[selectedSubject].label}** yet.`,
                    ephemeral: true
                });

                return;
            }

            const q = result.rows[0];

            await interaction.editReply(
                buildQuestionMessage(
                    q,
                    interaction.user.id,
                    1,
                    1
                )
            );

        } catch (error) {
            logger.error(
                'Quiz subject select error:',
                error
            );

            try {
                await interaction.followUp({
                    content:
                        '❌ Something went wrong while loading that quiz subject.',
                    ephemeral: true
                });
            } catch (replyError) {
                logger.error(
                    'Failed to send quiz subject error response:',
                    replyError
                );
            }
        }
    }
};

/*
 * SECOND MENU
 *
 * Anatomy & Physiology
 * ↓
 * Choose body system
 */
export const quizCategorySelectMenu = {
    name: CATEGORY_SELECT_ID,

    async execute(interaction) {
        try {
            await interaction.deferUpdate();

            const selectedCategory =
                interaction.values[0];

            if (
                !AP_CATEGORIES[
                    selectedCategory
                ]
            ) {
                await interaction.followUp({
                    content:
                        '❌ Invalid Anatomy & Physiology topic.',
                    ephemeral: true
                });

                return;
            }

            /*
             * After selecting a body system,
             * ask how many questions they want.
             */
            await interaction.editReply(
                buildQuestionCountMenu(
                    selectedCategory
                )
            );

        } catch (error) {
            logger.error(
                'Quiz category select error:',
                error
            );

            try {
                await interaction.followUp({
                    content:
                        '❌ Something went wrong while loading that A&P topic.',
                    ephemeral: true
                });
            } catch (replyError) {
                logger.error(
                    'Failed to send quiz category error response:',
                    replyError
                );
            }
        }
    }
};

/*
 * THIRD MENU
 *
 * Choose:
 * 1
 * 5
 * 20
 * 50
 *
 * Then create the quiz session.
 */
export const quizCountSelectMenu = {
    name: COUNT_SELECT_ID,

    async execute(interaction) {
        try {
            await interaction.deferUpdate();

            const selectedValue =
                interaction.values[0];

            const [
                selectedCategory,
                countString
            ] = selectedValue.split('|');

            const questionCount =
                Number.parseInt(
                    countString,
                    10
                );

            if (
                !AP_CATEGORIES[
                    selectedCategory
                ] ||
                ![1, 5, 20, 50].includes(
                    questionCount
                )
            ) {
                await interaction.followUp({
                    content:
                        '❌ Invalid quiz selection.',
                    ephemeral: true
                });

                return;
            }

            let result;

            /*
             * RANDOM A&P
             */
            if (
                selectedCategory ===
                'random_ap'
            ) {
                result =
                    await pgDb.pool.query(
                        `
                        SELECT *
                        FROM quiz_questions
                        WHERE LOWER(subject) = LOWER($1)
                        ORDER BY RANDOM()
                        LIMIT $2
                        `,
                        [
                            'Anatomy & Physiology',
                            questionCount
                        ]
                    );
            } else {
                /*
                 * SPECIFIC BODY SYSTEM
                 */
                const categoryName =
                    AP_CATEGORIES[
                        selectedCategory
                    ].label;

                result =
                    await pgDb.pool.query(
                        `
                        SELECT *
                        FROM quiz_questions
                        WHERE LOWER(subject) = LOWER($1)
                        AND LOWER(category) = LOWER($2)
                        ORDER BY RANDOM()
                        LIMIT $3
                        `,
                        [
                            'Anatomy & Physiology',
                            categoryName,
                            questionCount
                        ]
                    );
            }

            /*
             * No questions found
             */
            if (
                result.rows.length === 0
            ) {
                await interaction.followUp({
                    content:
                        `❌ There are no questions available for **${AP_CATEGORIES[selectedCategory].label}** yet.`,
                    ephemeral: true
                });

                return;
            }

            /*
             * CREATE THE QUIZ SESSION
             *
             * This saves ALL of the selected
             * questions instead of only
             * remembering question #1.
             */
            const session =
                createQuizSession({
                    guildId:
                        interaction.guildId,

                    userId:
                        interaction.user.id,

                    questions:
                        result.rows,

                    category:
                        selectedCategory
                });

            /*
             * Get question #1.
             */
            const q =
                getCurrentQuestion(
                    session
                );

            if (!q) {
                await interaction.followUp({
                    content:
                        '❌ Could not start the quiz session.',
                    ephemeral: true
                });

                return;
            }

            /*
             * Display:
             *
             * Question 1 / 5
             * Question 1 / 20
             * etc.
             */
            await interaction.editReply(
                buildQuestionMessage(
                    q,
                    interaction.user.id,
                    1,
                    session.questions.length
                )
            );

        } catch (error) {
            logger.error(
                'Quiz count select error:',
                error
            );

            try {
                await interaction.followUp({
                    content:
                        '❌ Something went wrong while starting the quiz.',
                    ephemeral: true
                });
            } catch (replyError) {
                logger.error(
                    'Failed to send quiz count error response:',
                    replyError
                );
            }
        }
    }
};

export {
    SUBJECT_SELECT_ID,
    CATEGORY_SELECT_ID,
    COUNT_SELECT_ID,
    SUBJECTS,
    AP_CATEGORIES
};
