import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    EmbedBuilder
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
 * Temporarily stores LFG information
 * between the description modal and
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
 * SUBJECT SELECT MENU
 * =========================================================
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
             *
             * Custom ID:
             *
             * lfg_description:USER_ID:SUBJECT
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
 * CAPACITY SELECT MENU
 * =========================================================
 *
 * User chooses:
 *
 * 2 people
 * 3 people
 * 4 people
 * 5 people
 *
 * Then the existing Study Room is registered
 * as the LFG and its capacity is updated.
 */

export const lfgCapacitySelectMenu = {

    name: 'lfg_capacity',

    async execute(interaction) {

        try {

            /*
             * Custom ID:
             *
             * lfg_capacity:USER_ID
             */
            const parts =
                interaction.customId.split(':');

            const creatorId =
                parts[1];

            /*
             * Validate creator ID.
             */
            if (!creatorId) {

                return interaction.reply({
                    content:
                        '❌ Invalid LFG request.',
                    ephemeral: true
                });

            }

            /*
             * Only the person who created
             * the LFG can select its capacity.
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
             * Get selected capacity.
             */
            const selectedCapacity =
                Number(
                    interaction.values[0]
                );

            /*
             * Only allow:
             *
             * 2
             * 3
             * 4
             * 5
             */
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
             * Retrieve the information saved
             * by lfgDescription.js.
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

            /*
             * Get subject information.
             */
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
             * Register the creator's existing
             * Study Room and apply the capacity.
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
             * Make sure the Study Room has
             * the selected maximum capacity.
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
             * Create a REAL Discord voice invite.
             *
             * Discord handles the native
             * voice invite card and join UI.
             */
            let voiceInvite;

            try {

                voiceInvite =
                    await channel.createInvite({
                        maxAge: 0,
                        maxUses: 0,
                        unique: true,
                        reason:
                            `LFG Study Room created by ${interaction.user.tag}`
                    });

            } catch (inviteError) {

                logger.error(
                    'Could not create LFG voice invite:',
                    inviteError
                );

                return interaction.reply({
                    content:
                        '❌ The Study Room was created, but I could not create the Discord voice invite. Please make sure the bot has **Create Invite** permission.',
                    ephemeral: true
                });

            }

            /*
             * Create the public LFG post.
             *
             * Example:
             *
             * 👥 Woods is looking for a study group!
             *
             * 🫀 Subject: Anatomy & Physiology II
             *
             * 📝 Description: Studying cardiovascular...
             *
             * 👥 Maximum: 3 people
             *
             * 🔊 Woods's Study Room
             */
            const lfgEmbed =
                new EmbedBuilder()
                    .setDescription(

                        `👥 **${interaction.member.displayName} is looking for a study group!**\n\n` +

                        `${subject.emoji} **Subject:** ${subject.label}\n\n` +

                        `📝 **Description:** ${description}\n\n` +

                        `👥 **Maximum:** ${selectedCapacity} people\n\n` +

                        `🔊 **${channel.name}**`

                    );

            /*
             * Send the LFG information first.
             */
            await interaction.channel.send({
                embeds: [
                    lfgEmbed
                ]
            });

            /*
             * Send the REAL Discord voice invite.
             *
             * Discord should render its native
             * voice-channel invite UI underneath
             * the LFG information.
             */
            await interaction.channel.send({
                content:
                    voiceInvite.url
            });

            /*
             * Remove temporary LFG data.
             */
            pendingLfgDescriptions.delete(
                interaction.user.id
            );

            /*
             * Remove the capacity selector
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
 * =========================================================
 * EXPORTS
 * =========================================================
 */

export {
    LFG_SUBJECT_SELECT_PREFIX,
    LFG_DESCRIPTION_MODAL_PREFIX,
    LFG_CAPACITY_SELECT_PREFIX,
    SUBJECTS
};
