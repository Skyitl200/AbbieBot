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

const SUBJECT_SELECT_ID = 'quiz-subject-select';
const CATEGORY_SELECT_ID = 'quiz-category-select';

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

function buildQuestionMessage(q, ownerId) {
    const embed = new EmbedBuilder()
        .setTitle('🩺 Nursing Quiz')
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
        );

    const answerRow = new ActionRowBuilder().addComponents(
        ['A', 'B', 'C', 'D'].map(letter => {
            const column = ANSWER_LABELS[letter];

            return new ButtonBuilder()
                .setCustomId(`quiz:${letter}:${q.id}:${ownerId}`)
                .setLabel(`${letter}. ${q[column]}`)
                .setStyle(ButtonStyle.Primary);
        })
    );

    return {
        embeds: [embed],
        components: [answerRow]
    };
}

function buildAPCategoryMenu() {
    const embed = new EmbedBuilder()
        .setTitle('🫀 Anatomy & Physiology')
        .setDescription(
            '**Choose the body system you would like to study.**\n\n' +
            'Or choose Random A&P for a question from any A&P topic.'
        );

    const menu = new StringSelectMenuBuilder()
        .setCustomId(CATEGORY_SELECT_ID)
        .setPlaceholder('Choose an A&P topic...')
        .addOptions(
            Object.entries(AP_CATEGORIES).map(([value, category]) =>
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

// FIRST MENU:
// /quiz -> choose subject
export const quizSubjectSelectMenu = {
    name: SUBJECT_SELECT_ID,

    async execute(interaction) {
        try {
            await interaction.deferUpdate();

            const selectedSubject = interaction.values[0];

            if (!SUBJECTS[selectedSubject]) {
                await interaction.followUp({
                    content: '❌ Invalid quiz subject.',
                    ephemeral: true
                });
                return;
            }

            // Anatomy & Physiology opens the second topic menu
            if (selectedSubject === 'anatomy_physiology') {
                await interaction.editReply(
                    buildAPCategoryMenu()
                );
                return;
            }

            let result;

            // Random = question from absolutely any subject
            if (selectedSubject === 'random') {
                result = await pgDb.pool.query(`
                    SELECT *
                    FROM quiz_questions
                    ORDER BY RANDOM()
                    LIMIT 1
                `);
            } else {
                // Other subjects currently give a random question
                // from that subject.
                const subjectName = SUBJECTS[selectedSubject].label;

                result = await pgDb.pool.query(
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

            if (result.rows.length === 0) {
                await interaction.followUp({
                    content: `❌ There are no questions available for **${SUBJECTS[selectedSubject].label}** yet.`,
                    ephemeral: true
                });
                return;
            }

            const q = result.rows[0];

            await interaction.editReply(
                buildQuestionMessage(
                    q,
                    interaction.user.id
                )
            );

        } catch (error) {
            logger.error('Quiz subject select error:', error);

            try {
                await interaction.followUp({
                    content: '❌ Something went wrong while loading that quiz subject.',
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

// SECOND MENU:
// Anatomy & Physiology -> choose body system
export const quizCategorySelectMenu = {
    name: CATEGORY_SELECT_ID,

    async execute(interaction) {
        try {
            await interaction.deferUpdate();

            const selectedCategory = interaction.values[0];

            if (!AP_CATEGORIES[selectedCategory]) {
                await interaction.followUp({
                    content: '❌ Invalid Anatomy & Physiology topic.',
                    ephemeral: true
                });
                return;
            }

            let result;

            // Random A&P = any question whose subject is A&P
            if (selectedCategory === 'random_ap') {
                result = await pgDb.pool.query(
                    `
                    SELECT *
                    FROM quiz_questions
                    WHERE LOWER(subject) = LOWER($1)
                    ORDER BY RANDOM()
                    LIMIT 1
                    `,
                    ['Anatomy & Physiology']
                );
            } else {
                const categoryName =
                    AP_CATEGORIES[selectedCategory].label;

                result = await pgDb.pool.query(
                    `
                    SELECT *
                    FROM quiz_questions
                    WHERE LOWER(subject) = LOWER($1)
                    AND LOWER(category) = LOWER($2)
                    ORDER BY RANDOM()
                    LIMIT 1
                    `,
                    [
                        'Anatomy & Physiology',
                        categoryName
                    ]
                );
            }

            if (result.rows.length === 0) {
                await interaction.followUp({
                    content:
                        `❌ There are no questions available for **${AP_CATEGORIES[selectedCategory].label}** yet.`,
                    ephemeral: true
                });
                return;
            }

            const q = result.rows[0];

            await interaction.editReply(
                buildQuestionMessage(
                    q,
                    interaction.user.id
                )
            );

        } catch (error) {
            logger.error('Quiz category select error:', error);

            try {
                await interaction.followUp({
                    content: '❌ Something went wrong while loading that A&P topic.',
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

export {
    SUBJECT_SELECT_ID,
    CATEGORY_SELECT_ID,
    SUBJECTS,
    AP_CATEGORIES
};
