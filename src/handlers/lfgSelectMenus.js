import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

import { logger } from '../utils/logger.js';

import {
    createLfgVoiceChannel
} from '../services/lfg/lfgService.js';

const LFG_SUBJECT_SELECT_PREFIX =
    'lfg_subject:';

const LFG_DESCRIPTION_MODAL_PREFIX =
    'lfg_description:';

const LFG_CAPACITY_SELECT_PREFIX =
    'lfg_capacity:';

/*
 * LFG subjects.
 */
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
 * Temporarily stores the LFG information
 * between the description modal and the
 * capacity selection.
 *
 * userId -> {
 *     selectedSubject,
 *     description
 * }
 */
export const pendingLfgDescriptions =
    new Map();


/*
 * =========================================================
 * SUBJECT SELECT
 * =========================================================
 *
 * User selects:
 *
 * 🦴 Anatomy & Physiology I
 * 🫀 Anatomy & Physiology II
 * 🦠 Microbiology
 * 📚 TEAS
 * 🎓 Program
 * 🧪 Chemistry
 * ⚛️ Physics
 * 📐 Math
 *
 * Then the description modal appears.
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


/*
 * =========================================================
 * CAPACITY SELECT
 * =========================================================
 *
 * After the user submits their description,
 * they choose:
 *
 * 👥 2 people
 * 👥 3 people
 * 👥 4 people
 * 👥 5 people
 *
 * This then creates the actual LFG.
 */
export const lfgCapacitySelectMenu = {

    name: 'lfg_capacity',

    async execute(interaction) {

        try {

            /*
             * The custom ID is:
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
             * Get the selected capacity.
             */
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
             * Retrieve the description
             * saved by lfgDescription.js.
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

            const selectedSubject =
                pending.selectedSubject;

            const description =
                pending.description;

            const subject =
                SUBJECTS[selectedSubject];

            if (!subject) {

                pendingLfgDescriptions.delete(
                    interaction.user.id
                );

                return interaction.reply({
                    content:
                        '❌ The selected LFG subject is no longer valid.',
                    ephemeral: true
                });

            }

            /*
             * Create/register the creator's
             * existing Study Room.
             */
            const result =
                await createLfgVoiceChannel(
                    interaction,
                    subject.label,
                    selectedCapacity
                );

            if (!result.success) {

                return interaction.reply({
                    content:
                        result.error ||
                        '❌ I could not create your LFG.',
                    ephemeral: true
                });

            }

            const channel =
                result.channel;

            /*
             * Make sure the voice channel
             * uses the selected capacity.
             */
            try {

                await channel.setUserLimit(
                    selectedCapacity
                );

            } catch (capacityError) {

                logger.warn(
                    'Could not update LFG Study Room capacity:',
                    capacityError
                );

            }

            /*
             * Create the LFG embed.
             */
            const lfgEmbed =
                new EmbedBuilder()
                    .setDescription(
                        `👥 **${interaction.member.displayName} is looking for a study group!**\n\n` +

                        `${subject.emoji} **${subject.label}**\n\n` +

                        `📝 **Description:** ${description}\n\n` +

                        `👥 **Maximum:** ${selectedCapacity} people\n\n` +

                        `🔊 **${channel.name}**`
                    );

            /*
             * Existing LFG Join button.
             *
             * This uses your lfgJoin.js handler.
             */
            const joinButton =
                new ButtonBuilder()
                    .setCustomId(
                        `lfg_join:${channel.id}`
                    )
                    .setLabel(
                        'Join Voice'
                    )
                    .setEmoji(
                        '🔊'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    );

            const buttonRow =
                new ActionRowBuilder()
                    .addComponents(
                        joinButton
                    );

            /*
             * Send the completed LFG post.
             */
            await interaction.channel.send({

                embeds: [
                    lfgEmbed
                ],

                components: [
                    buttonRow
                ]

            });

            /*
             * Remove the temporary LFG data.
             */
            pendingLfgDescriptions.delete(
                interaction.user.id
            );

            /*
             * Remove the select menu
             * from the user's ephemeral message.
             */
            await interaction.update({
                content:
                    '✅ Your LFG has been created!',
                components: []
            });

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
                        '❌ Something went wrong while creating your LFG.',
                    ephemeral: true
                });

            }

        }

    }

};


/*
 * Export constants and subjects.
 */
export {
    LFG_SUBJECT_SELECT_PREFIX,
    LFG_DESCRIPTION_MODAL_PREFIX,
    LFG_CAPACITY_SELECT_PREFIX,
    SUBJECTS
};
