import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';

import { logger } from '../utils/logger.js';

const LFG_SUBJECT_SELECT_PREFIX = 'lfg_subject:';
const LFG_DESCRIPTION_MODAL_PREFIX = 'lfg_description:';

const SUBJECTS = {
    anatomy_1: {
        label: 'Anatomy & Physiology I',
        emoji: '🦴'
    },
    anatomy_2: {
        label: 'Anatomy & Physiology II',
        emoji: '🫀'
    },
    microbiology: {
        label: 'Microbiology',
        emoji: '🦠'
    },
    teas: {
        label: 'TEAS',
        emoji: '📚'
    },
    program: {
        label: 'Program',
        emoji: '🎓'
    },
    chemistry: {
        label: 'Chemistry',
        emoji: '🧪'
    },
    physics: {
        label: 'Physics',
        emoji: '⚛️'
    },
    math: {
        label: 'Math',
        emoji: '📐'
    }
};

export const lfgSubjectSelectMenu = {
    name: `${LFG_SUBJECT_SELECT_PREFIX}`,

    async execute(interaction) {
        try {
            const selectedSubject = interaction.values[0];

            const subject = SUBJECTS[selectedSubject];

            if (!subject) {
                await interaction.reply({
                    content: '❌ Invalid LFG subject.',
                    ephemeral: true
                });

                return;
            }

            /*
             * Keep the user ID and selected subject
             * attached to the modal so the next step
             * knows exactly who created the LFG and
             * what subject they selected.
             */
            const modal = new ModalBuilder()
                .setCustomId(
                    `${LFG_DESCRIPTION_MODAL_PREFIX}${interaction.user.id}:${selectedSubject}`
                )
                .setTitle(
                    `${subject.label} — LFG`
                );

            const descriptionInput =
                new TextInputBuilder()
                    .setCustomId(
                        'lfg-description'
                    )
                    .setLabel(
                        'What are you looking for?'
                    )
                    .setPlaceholder(
                        'Example: Studying the cardiovascular system for tomorrow\'s exam...'
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(500);

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        descriptionInput
                    );

            modal.addComponents(row);

            await interaction.showModal(modal);

        } catch (error) {
            logger.error(
                'LFG subject select error:',
                error
            );

            if (!interaction.replied) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong while setting up your LFG.',
                    ephemeral: true
                });
            }
        }
    }
};

export {
    LFG_SUBJECT_SELECT_PREFIX,
    LFG_DESCRIPTION_MODAL_PREFIX,
    SUBJECTS
};
