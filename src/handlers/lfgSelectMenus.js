import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    EmbedBuilder
} from 'discord.js';
import path from 'node:path';

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
        emoji: '<:AP1:1557576078518648842>',
        image: 'LFGAP1.png'
    },

    anatomy_2: {
        label: 'Anatomy & Physiology II',
        emoji: '<:AP2:1557576103256784896>',
        image: 'LFGAP2.png'
    },

    microbiology: {
        label: 'Microbiology',
        emoji: '<:Microbiology:1557576299365671013>',
        image: 'LFGMICROBIOLOGY.png'
    },

    teas: {
        label: 'TEAS',
        emoji: '<:TEAS:1557576611115565076>',
        image: 'LFGTEAS.png'
    },

    program: {
        label: 'Program',
        emoji: '🎓'
    },

    chemistry: {
        label: 'Chemistry',
        emoji: '<:Chemistry:1557576122500120587>',
        image: 'LFGCHEMISTRY.png'
    },

    physics: {
        label: 'Physics',
        emoji: '<:Physics:1557576410917507082>',
        image: 'LFGPHYSICS.png'
    },

    math: {
        label: 'Math',
        emoji: '<:Math:1558128316253470861>',
        image: 'LFGMATH.png'
    }

};
/*
 * Healthcare programs.
 */
const PROGRAMS = {
    nursing: {
        label: 'Nursing School',
        emoji: '🩺',
        image: 'LFGRNPROGRAM.png'
    },

    dental_hygienist: {
        label: 'Dental Hygienist School',
        emoji: '🦷',
        image: 'LFGDENTALHYGIENISTPROGRAM.png'
    },

    dental_assistant: {
        label: 'Dental Assistant School',
        emoji: '🦷',
        image: 'LFGDENTALASSISTANTPROGRAM.png'
    },

    radiologic_technologist: {
        label: 'Radiologic Technologist School',
        emoji: '🩻',
        image: 'LFGRADIOLOGICTECHNOLOGISTPROGRAM.png'
    },

    diagnostic_medical_sonography: {
        label: 'Diagnostic Medical Sonography',
        emoji: '🔊',
        image: 'LFGDIAGNOSTICMEDICALSONOGRAPHYPROGRAM.png'
    },

    respiratory_therapist: {
        label: 'Respiratory Therapist School',
        emoji: '🫁',
        image: 'LFGRESPIRATORYTHERAPISTPROGRAM.png'
    },

    physical_therapy_assistant: {
        label: 'Physical Therapy Assistant School',
        emoji: '🏃',
        image: 'LFGPHYSICALTHERAPYASSISTANTPROGRAM.png'
    },

    physician_assistant: {
        label: 'Physician Assistant School',
        emoji: '🩺',
        image: 'LFGPHYSICIANASSISTANTPROGRAM.png'
    },

    medical_school: {
        label: 'Medical School',
        emoji: '🧑‍⚕️',
        image: 'LFGMEDICALSCHOOL.png'
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

                /*
 * If the user selected Program,
 * show the Healthcare Program dropdown.
 */
if (selectedSubject === 'program') {

    const programMenu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `lfg_program:${interaction.user.id}`
            )
            .setPlaceholder(
                'Healthcare Program'
            )
            .addOptions(
                Object.entries(PROGRAMS).map(
                    ([value, program]) => ({
                        label: program.label,
                        value,
                        emoji: program.emoji
                    })
                )
            );

    const programRow =
        new ActionRowBuilder()
            .addComponents(
                programMenu
            );

    return interaction.update({
        content:
            '🎓 **Healthcare Program**',
        components: [
            programRow
        ]
    });
}

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
            `${subject.label} - LFG`
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
/*
 * =========================================================
 * HEALTHCARE PROGRAM SELECT MENU
 * =========================================================
 */

export const lfgProgramSelectMenu = {

    name: 'lfg_program',

    async execute(interaction) {

        try {

            /*
             * Custom ID:
             *
             * lfg_program:USER_ID
             */

            const parts =
                interaction.customId.split(':');

            const creatorId =
                parts[1];

            const selectedProgram =
                interaction.values[0];

            /*
             * Validate creator.
             */
            if (
                !creatorId ||
                creatorId !== interaction.user.id
            ) {
                return interaction.reply({
                    content:
                        '❌ This Healthcare Program selection belongs to someone else.',
                    ephemeral: true
                });
            }

            /*
             * Validate program.
             */
            const program =
                PROGRAMS[selectedProgram];

            if (!program) {
                return interaction.reply({
                    content:
                        '❌ Invalid Healthcare Program.',
                    ephemeral: true
                });
            }

            /*
             * Create the description modal.
             *
             * Custom ID:
             *
             * lfg_description:USER_ID:PROGRAM:PROGRAM_VALUE
             */

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `${LFG_DESCRIPTION_MODAL_PREFIX}${interaction.user.id}:program:${selectedProgram}`
                    )
                    .setTitle(
                        `${program.label} — LFG`
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
                        'Example: Looking for classmates to study with...'
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
                'LFG program select error:',
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong while setting up your Healthcare Program LFG.',
                    ephemeral: true
                });
            }
        }
    }
};
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

const selectedProgram =
    pending.selectedProgram;

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
            const program =
    selectedProgram
        ? PROGRAMS[selectedProgram]
        : null;
        const lfgImage =
    program?.image || subject.image;
            const lfgEmbed =
    new EmbedBuilder()
        .setDescription(
            `👥 **${interaction.member.displayName} is looking for a study group!**\n\n` +

            (
                subject.label === 'Program' && program
                    ? `${program.emoji} **Program:** ${program.label}\n\n`
                    : `${subject.emoji} **Subject:** ${subject.label}\n\n`
            ) +

            `📝 **Description:** ${description}\n\n` +

            `👥 **Maximum:** ${selectedCapacity} people\n\n` +

            `🔊 **${channel.name}**`
        );
if (lfgImage) {
    lfgEmbed.setThumbnail(
        `attachment://${lfgImage}`
    );
}
            /*
             * Send the LFG information first.
             */
            const lfgImagePath = lfgImage
    ? path.join(
        process.cwd(),
        'src',
        'assets',
        'lfg',
        lfgImage
    )
    : null;

await interaction.channel.send({
    embeds: [
        lfgEmbed
    ],
    ...(lfgImagePath
        ? {
            files: [
                {
                    attachment: lfgImagePath,
                    name: lfgImage
                }
            ]
        }
        : {})
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
    SUBJECTS,
    PROGRAMS
};
