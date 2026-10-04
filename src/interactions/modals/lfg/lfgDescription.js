import {
    EmbedBuilder
} from 'discord.js';

import { logger } from '../../../utils/logger.js';
import { SUBJECTS } from '../../../handlers/lfgSelectMenus.js';

import {
    createLfgVoiceChannel
} from '../../../services/lfg/lfgService.js';

const LFG_DESCRIPTION_MODAL_PREFIX =
    'lfg_description:';

export default {
    name: 'lfg_description',

    async execute(
        interaction,
        client,
        args
    ) {
        try {
            const creatorId =
                args?.[0];

            const selectedSubject =
                args?.[1];

            if (
                !creatorId ||
                !selectedSubject
            ) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG request.',
                    ephemeral: true
                });
            }

            /*
             * Make sure the person submitting
             * the modal is the person who
             * started the LFG.
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

            const subject =
                SUBJECTS[
                    selectedSubject
                ];

            if (!subject) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG subject.',
                    ephemeral: true
                });
            }

            /*
             * Get the description.
             */
            const description =
                interaction.fields.getTextInputValue(
                    'lfg-description'
                );

            /*
             * Register the voice channel
             * the creator is ALREADY inside.
             *
             * This no longer creates a new
             * voice channel.
             */
            const result =
                await createLfgVoiceChannel(
                    interaction,
                    subject.label
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
             * IMPORTANT:
             *
             * We DO NOT call:
             *
             * interaction.member.voice.setChannel()
             *
             * because the creator is already
             * inside the correct Study Room.
             */

            /*
             * Create the PUBLIC LFG announcement.
             */
            const lfgEmbed =
                new EmbedBuilder()
                    .setTitle(
                        '🔎 LFG Created!'
                    )
                    .setDescription(
                        `${subject.emoji} **${subject.label}**\n\n` +
                        `📝 **Description:** ${description}\n\n` +
                        `🔊 **Study Room:** <#${channel.id}>\n` +
                        `👥 **Maximum:** ${channel.userLimit || 0} people\n\n` +
                        `The creator controls this Study Room and can change its limit or permissions from Discord.`
                    );

            /*
             * Public LFG post.
             *
             * This is intentionally NOT ephemeral.
             */
            await interaction.channel.send({
                embeds: [
                    lfgEmbed
                ]
            });

            /*
             * Private confirmation for
             * the person who created the LFG.
             */
            await interaction.reply({
                content:
                    `✅ Your **${subject.label}** LFG has been posted!\n\n` +
                    `🔊 Study Room: <#${channel.id}>`,
                ephemeral: true
            });

        } catch (error) {
            logger.error(
                'LFG description modal error:',
                error
            );

            if (
                !interaction.replied
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
