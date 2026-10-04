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
                return interaction.reply({
                    content:
                        '🔊 You are already in this Study Room.',
                    ephemeral: true
                });
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
             * Give the person permission to see
             * and connect to the Study Room.
             *
             * This is important even when they
             * are currently NOT in a VC.
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
                    'Could not give LFG member voice permissions:',
                    permissionError
                );

                return interaction.reply({
                    content:
                        '❌ I could not give you permission to join this Study Room.',
                    ephemeral: true
                });
            }

            /*
             * USER IS NOT CURRENTLY IN A VC.
             *
             * Discord does not allow the bot to
             * force a completely disconnected user
             * into voice.
             *
             * Instead, give them a direct button
             * to open the Study Room.
             */
            if (!member.voice?.channel) {

                const openButton =
                    new ButtonBuilder()
                        .setLabel(
                            'Open Study Room'
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
                        '🔊 You can join this Study Room from the button below.',
                    components: [
                        row
                    ],
                    ephemeral: true
                });
            }

            /*
             * User IS already in another VC.
             *
             * The bot needs Move Members permission
             * to move them.
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
             * Move the member into the LFG room.
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
                        '❌ I could not move you into the Study Room. Please make sure the bot has **Move Members** permission.',
                    ephemeral: true
                });
            }

            return interaction.reply({
                content:
                    `🔊 You joined **${channel.name}**!`,
                ephemeral: true
            });

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
