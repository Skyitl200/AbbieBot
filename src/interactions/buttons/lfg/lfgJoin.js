import {
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    PermissionFlagsBits
} from 'discord.js';

import { logger } from '../../../utils/logger.js';

const LFG_JOIN_PREFIX = 'lfg_join:';

export default {
    name: 'lfg_join',

    async execute(interaction) {
        try {
            const channelId =
                interaction.customId.slice(
                    LFG_JOIN_PREFIX.length
                );

            if (!channelId) {
                return interaction.reply({
                    content:
                        '❌ This Study Room is invalid.',
                    ephemeral: true
                });
            }

            const guild =
                interaction.guild;

            const channel =
                await guild.channels.fetch(
                    channelId
                ).catch(() => null);

            if (!channel) {
                return interaction.reply({
                    content:
                        '❌ This Study Room no longer exists.',
                    ephemeral: true
                });
            }

            if (!channel.isVoiceBased()) {
                return interaction.reply({
                    content:
                        '❌ This is not a valid Study Room.',
                    ephemeral: true
                });
            }

            const member =
                interaction.member;

            /*
             * Already inside this Study Room.
             */
            if (
                member.voice?.channelId ===
                channel.id
            ) {
                return interaction.deferUpdate();
            }

            /*
             * Check capacity.
             */
            const userLimit =
                channel.userLimit;

            const currentUsers =
                channel.members.filter(
                    member =>
                        !member.user.bot
                ).size;

            if (
                userLimit > 0 &&
                currentUsers >= userLimit
            ) {
                return interaction.reply({
                    content:
                        '❌ This Study Room is currently full.',
                    ephemeral: true
                });
            }

            /*
             * Give the member permission to
             * connect to the Study Room.
             */
            try {
                await channel.permissionOverwrites.edit(
                    member.id,
                    {
                        ViewChannel: true,
                        Connect: true,
                        Speak: true
                    }
                );
            } catch (permissionError) {
                logger.error(
                    'Could not update LFG member permissions:',
                    permissionError
                );

                return interaction.reply({
                    content:
                        '❌ I could not give you permission to join this Study Room.',
                    ephemeral: true
                });
            }

            /*
             * USER IS NOT CURRENTLY IN VOICE.
             *
             * Discord does not allow the bot to
             * force a disconnected user into voice.
             *
             * Give them a direct Discord channel link.
             */
            if (!member.voice?.channel) {

                const openButton =
                    new ButtonBuilder()
                        .setLabel(
                            'Join Voice'
                        )
                        .setEmoji('🔊')
                        .setStyle(
                            ButtonStyle.Link
                        )
                        .setURL(
                            `https://discord.com/channels/${guild.id}/${channel.id}`
                        );

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            openButton
                        );

                return interaction.reply({
                    content:
                        '🔊 Click below to join the Study Room.',
                    components: [
                        row
                    ],
                    ephemeral: true
                });
            }

            /*
             * User IS already in another VC.
             *
             * Bot needs Move Members.
             */
            const botMember =
                guild.members.me;

            if (
                !botMember?.permissions.has(
                    PermissionFlagsBits.MoveMembers
                )
            ) {
                return interaction.reply({
                    content:
                        '❌ I need the **Move Members** permission to move you into the Study Room.',
                    ephemeral: true
                });
            }

            /*
             * Move the member immediately.
             */
            try {
                await member.voice.setChannel(
                    channel,
                    'Joined LFG Study Room'
                );
            } catch (moveError) {
                logger.error(
                    'Could not move member into LFG Study Room:',
                    moveError
                );

                return interaction.reply({
                    content:
                        '❌ I could not move you into the Study Room.',
                    ephemeral: true
                });
            }

            /*
             * IMPORTANT:
             *
             * Do NOT send a confirmation message.
             *
             * Simply acknowledge the button interaction
             * and leave the original LFG post untouched.
             */
            return interaction.deferUpdate();

        } catch (error) {
            logger.error(
                'LFG join button error:',
                error
            );

            if (!interaction.replied) {
                return interaction.reply({
                    content:
                        '❌ Something went wrong while joining the Study Room.',
                    ephemeral: true
                });
            }
        }
    }
};

export {
    LFG_JOIN_PREFIX
};
