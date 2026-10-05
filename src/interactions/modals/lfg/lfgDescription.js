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
             * Get the LFG creator ID
             * and selected subject.
             */
            const creatorId =
                args?.[0];

            const selectedSubject =
                args?.[1];

            /*
             * Validate the request.
             */
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
             * Create/register the Study Room.
             *
             * The creator is already inside
             * the Join to Create Study Room,
             * so the service handles creating
             * their personal Study Room.
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
             * Create a real Discord voice-channel
             * invite.
             *
             * Discord will handle the native
             * voice invite card.
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
                        '❌ I created the Study Room, but I could not create the Discord voice invite. Please make sure the bot has **Create Invite** permission.',
                    ephemeral: true
                });
            }

            /*
             * Get the emoji for the selected subject.
             */
            const subjectEmoji =
                SUBJECT_EMOJIS[selectedSubject] ||
                '📚';

            /*
             * Create the public LFG post.
             *
             * Instead of saying:
             *
             * "LFG Created!"
             *
             * it now says:
             *
             * "Woods is looking for a study group!"
             */
            const lfgEmbed =
                new EmbedBuilder()
                    .setTitle(
                        `👥 ${interaction.user.displayName} is looking for a study group!`
                    )
                    .setDescription(
                        `${subjectEmoji} **Subject:** ${subject.label}\n\n` +
                        `📝 **Description:** ${description}\n\n` +
                        `🔊 **Study Room:** <#${channel.id}>\n` +
                        `👥 **Maximum:** ${channel.userLimit || 4} people`
                    );

            /*
             * SEND THE LFG POST FIRST.
             *
             * This contains the study information.
             */
            await interaction.channel.send({
                embeds: [
                    lfgEmbed
                ]
            });

            /*
             * SEND THE VOICE INVITE SECOND.
             *
             * Discord will display its native
             * voice-channel invite underneath
             * the LFG information.
             */
            await interaction.channel.send({
                content:
                    voiceInvite.url
            });

            /*
             * Acknowledge the modal privately.
             *
             * No visible confirmation message
             * is created for the user.
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

            /*
             * Only respond if the interaction
             * has not already been acknowledged.
             */
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
