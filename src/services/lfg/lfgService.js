import {
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle
} from 'discord.js';

import { logger } from '../../../utils/logger.js';
import { SUBJECTS } from '../../../handlers/lfgSelectMenus.js';

import {
    createLfgVoiceChannel
} from '../../../services/lfg/lfgService.js';

const LFG_DESCRIPTION_MODAL_PREFIX =
    'lfg_description:';

const LFG_JOIN_PREFIX =
    'lfg_join:';

const SUBJECT_EMOJIS = {
    anatomy_1: '🦴',
    anatomy_2: '🫀',
    microbiology: '🦠',
    teas: '📚',
    program: '🎓',
    chemistry: '🧪',
    physics: '⚛️',
    math: '📐'
};

export default {
    name: 'lfg_description',

    async execute(
        interaction,
        client,
        args
    ) {
        try {

            /*
             * Get the LFG creator ID,
             * selected subject,
             * and selected maximum capacity.
             *
             * Custom ID format:
             *
             * lfg_description:USER_ID:SUBJECT:CAPACITY
             */
            const creatorId =
                args?.[0];

            const selectedSubject =
                args?.[1];

            const selectedCapacity =
                Number(args?.[2]);

            /*
             * Validate the request.
             */
            if (
                !creatorId ||
                !selectedSubject ||
                ![2, 3, 4, 5].includes(
                    selectedCapacity
                )
            ) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG request.',
                    ephemeral: true
                });
            }

            /*
             * Make sure the person submitting
             * the modal is the LFG creator.
             */
            if (
                creatorId !==
                interaction.user.id
            ) {
                return interaction.reply({
                    content:
                        '❌ This LFG form belongs to someone else.',
                    ephemeral: true
                });
            }

            /*
             * Get the selected subject.
             */
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
             * Get the description entered
             * by the LFG creator.
             */
            const description =
                interaction.fields.getTextInputValue(
                    'lfg-description'
                );

            /*
             * Use the creator's existing
             * Study Room.
             *
             * The selected capacity is applied
             * to that Study Room.
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
             * Get the emoji for the selected subject.
             */
            const subjectEmoji =
                SUBJECT_EMOJIS[selectedSubject] ||
                '📚';

            /*
             * Create the public LFG post.
             */
            const lfgEmbed =
                new EmbedBuilder()
                    .setTitle(
                        `👥 ${interaction.user.displayName} is looking for a study group!`
                    )
                    .setDescription(
                        `${subjectEmoji} **Subject:** ${subject.label}\n\n` +
                        `📝 **Description:** ${description}\n\n` +
                        `👥 **Maximum:** ${selectedCapacity} people\n\n` +
                        `🔊 **Study Room:** ${channel.name}`
                    );

            /*
             * Create the custom LFG Join button.
             *
             * This connects to:
             *
             * src/interactions/buttons/lfg/lfgJoin.js
             *
             * The channel ID is stored directly
             * in the button custom ID.
             */
            const joinButton =
                new ButtonBuilder()
                    .setCustomId(
                        `${LFG_JOIN_PREFIX}${channel.id}`
                    )
                    .setLabel(
                        'Join Study Room'
                    )
                    .setEmoji('🔊')
                    .setStyle(
                        ButtonStyle.Primary
                    );

            const buttonRow =
                new ActionRowBuilder()
                    .addComponents(
                        joinButton
                    );

            /*
             * Send the LFG post with the
             * custom instant-join button.
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
             * Acknowledge the modal privately.
             *
             * No public confirmation message.
             */
            await interaction.deferReply({
                ephemeral: true
            });

            await interaction.deleteReply();

        } catch (error) {

            logger.error(
                'LFG description modal error:',
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

export {
    LFG_DESCRIPTION_MODAL_PREFIX
};
