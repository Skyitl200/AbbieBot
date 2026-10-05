import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder
} from 'discord.js';

import { logger } from '../utils/logger.js';

const LFG_SUBJECT_SELECT_PREFIX =
    'lfg_subject:';

const LFG_DESCRIPTION_MODAL_PREFIX =
    'lfg_description:';

const LFG_CAPACITY_SELECT_PREFIX =
    'lfg_capacity:';

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

/*
 * Temporary storage for LFG descriptions
 * while the creator chooses the room size.
 *
 * userId -> {
 *     subject,
 *     description
 * }
 */
export const pendingLfgDescriptions =
    new Map();

/**
 * SUBJECT SELECT
 *
 * User selects what they want to study.
 *
 * Flow:
 *
 * Subject
 *   ↓
 * Description modal
 */
export const lfgSubjectSelectMenu = {
    name: 'lfg_subject',

    async execute(interaction) {
        try {

            const selectedSubject =
                interaction.values[0];

            const subject =
                SUBJECTS[selectedSubject];

            if (!subject) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG subject.',
                    ephemeral: true
                });
            }

            /*
             * Create the description modal.
             */
            const modal =
                new ModalBuilder()
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

            modal.addComponents(
                row
            );

            await interaction.showModal(
                modal
            );

        } catch (error) {

            logger.error(
                'LFG subject select error:',
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong while setting up your LFG.',
                    ephemeral: true
                });
            }
        }
    }
};

/**
 * CAPACITY SELECT
 *
 * This is used after the creator
 * submits their description.
 *
 * The creator chooses:
 *
 * 2 people
 * 3 people
 * 4 people
 * 5 people
 */
export const lfgCapacitySelectMenu = {
    name: 'lfg_capacity',

    async execute(interaction) {
        try {

            const selectedCapacity =
                Number(
                    interaction.values[0]
                );

            if (
                ![2, 3, 4, 5].includes(
                    selectedCapacity
                )
            ) {
                return interaction.reply({
                    content:
                        '❌ Invalid Study Room capacity.',
                    ephemeral: true
                });
            }

            /*
             * The capacity select menu's
             * custom ID contains:
             *
             * lfg_capacity:USER_ID
             */
            const parts =
                interaction.customId.split(':');

            const creatorId =
                parts[1];

            if (!creatorId) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG request.',
                    ephemeral: true
                });
            }

            /*
             * Make sure the person selecting
             * the capacity is the person who
             * created the LFG.
             */
            if (
                creatorId !==
                interaction.user.id
            ) {
                return interaction.reply({
                    content:
                        '❌ This LFG belongs to someone else.',
                    ephemeral: true
                });
            }

            /*
             * Retrieve the description that
             * was temporarily stored after
             * the modal was submitted.
             */
            const pending =
                pendingLfgDescriptions.get(
                    interaction.user.id
                );

            if (!pending) {
                return interaction.reply({
                    content:
                        '❌ This LFG request has expired. Please create a new LFG.',
                    ephemeral: true
                });
            }

            /*
             * Store the capacity with the
             * pending LFG information.
             */
            pending.capacity =
                selectedCapacity;

            /*
             * The description modal handler
             * will use this information to
             * create the LFG.
             *
             * We acknowledge the selection.
             */
            await interaction.deferUpdate();

            /*
             * IMPORTANT:
             *
             * The actual LFG creation is handled
             * by the LFG capacity interaction.
             */
            return;

        } catch (error) {

            logger.error(
                'LFG capacity select error:',
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong while selecting the Study Room size.',
                    ephemeral: true
                });
            }
        }
    }
};

export {
    LFG_SUBJECT_SELECT_PREFIX,
    LFG_DESCRIPTION_MODAL_PREFIX,
    LFG_CAPACITY_SELECT_PREFIX,
    SUBJECTS
};
