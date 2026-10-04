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
             * Get the description.
             */
            const description =
                interaction.fields.getTextInputValue(
                    'lfg-description'
                );

            /*
             * Register the Study Room that
             * the creator is already inside.
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
             * Create a REAL Discord voice-channel
             * invite.
             *
             * Discord handles the invite UI and
             * voice joining experience.
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
             * Subject emoji.
             */
            const subjectEmoji =
                SUBJECT_EMOJIS[selectedSubject] ||
                '📚';

            /*
             * LFG information.
             */
            const lfgEmbed =
                new EmbedBuilder()
                    .setTitle(
                        '🔎 LFG Created!'
                    )
                    .setDescription(
                        `${subjectEmoji} **Subject:** ${subject.label}\n\n` +
                        `📝 **Description:** ${description}\n\n` +
                        `🔊 **Study Room:** <#${channel.id}>\n` +
                        `👥 **Maximum:** ${channel.userLimit || 4} people`
                    );

            /*
             * IMPORTANT:
             *
             * We do NOT create a custom Join button.
             *
             * Sending the actual Discord voice invite
             * allows Discord to render its native
             * voice-channel invite UI.
             */
            await interaction.channel.send({
                content: voiceInvite.url,
                embeds: [
                    lfgEmbed
                ]
            });

            /*
             * Acknowledge the modal without creating
             * a visible confirmation message.
             *
             * The public LFG post above is all the
             * user needs to see.
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

            if (!interaction.replied &&
                !interaction.deferred) {
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
