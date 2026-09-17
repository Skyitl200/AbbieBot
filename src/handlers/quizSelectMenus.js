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

            let result;

            if (selectedSubject === 'random') {
                result = await pgDb.pool.query(`
                    SELECT *
                    FROM quiz_questions
                    ORDER BY RANDOM()
                    LIMIT 1
                `);
            } else {
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

            const questionMessage = buildQuestionMessage(
                q,
                interaction.user.id
            );

            await interaction.editReply(questionMessage);

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

export {
    SUBJECT_SELECT_ID,
    SUBJECTS
};
