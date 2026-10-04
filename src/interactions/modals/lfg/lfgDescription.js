import {
    EmbedBuilder
} from 'discord.js';

import { logger } from '../../../utils/logger.js';
import { SUBJECTS } from '../../../handlers/lfgSelectMenus.js';

import {
    createLfgVoiceChannel
} from '../../../services/lfg/lfgService.js';

const LFG_DESCRIPTION_MODAL_PREFIX = 'lfg_description:';

export default {
    name: 'lfg_description',

    async execute(interaction, client, args) {
        try {
            /*
             * The interaction dispatcher already splits:
             *
             * lfg_description:USER_ID:SUBJECT
             *
             * into:
             *
             * args[0] = USER_ID
             * args[1] = SUBJECT
             */
            const creatorId = args?.[0];
            const selectedSubject = args?.[1];

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
             * Make sure the person submitting the
             * modal is the person who created it.
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
                SUBJECTS[selectedSubject];

            if (!subject) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG subject.',
                    ephemeral: true
                });
            }

            /*
             * Get the description entered by
             * the creator.
             */
            const description =
                interaction.fields.getTextInputValue(
                    'lfg-description'
                );

            /*
             * Create the temporary Study Room.
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
                        '❌ I could not create your Study Room.',
                    ephemeral: true
                });
            }

            const channel =
                result.channel;

            /*
             * Move the creator into their new
             * Study Room.
             */
            try {
                if (interaction.member.voice) {
                    await interaction.member.voice.setChannel(
                        channel
                    );
                }
            } catch (error) {
                logger.error(
                    'Could not move LFG creator into Study Room:',
                    error
                );
            }

            /*
             * Create the PUBLIC LFG announcement.
             *
             * This is intentionally NOT ephemeral.
             * Everyone who can see #・LFG・ will see it.
             */
            const lfgEmbed =
                new EmbedBuilder()
                    .setTitle(
                        '🔎 LFG Created!'
                    )
                    .setDescription(
                        `${subject.emoji} **${subject.label}**\n\n` +
                        `📚 **Description:** ${description}\n\n` +
                        `🔊 **Study Room:** <#${channel.id}>\n` +
                        `👥 **Maximum:** ${channel.userLimit} people\n\n` +
                        `The creator controls this Study Room and can change its limit or permissions from Discord.`
                    );

            /*
             * interaction.channel is the #・LFG・
             * channel where the LFG setup began.
             */
            await interaction.channel.send({
                embeds: [
                    lfgEmbed
                ]
            });

            /*
             * PRIVATE confirmation for the creator.
             */
            await interaction.reply({
                content:
                    `✅ Your **${subject.label}** LFG has been created!\n\n` +
                    `🔊 Study Room: <#${channel.id}>`,
                ephemeral: true
            });

        } catch (error) {
            logger.error(
                'LFG description modal error:',
                error
            );

            if (!interaction.replied) {
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
