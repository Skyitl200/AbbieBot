import {
    PermissionFlagsBits
} from 'discord.js';

import { logger } from '../../../utils/logger.js';

const LFG_JOIN_PREFIX = 'lfg_join:';

export default {
    name: 'lfg_join',

    async execute(interaction) {
        try {
            /*
             * Get the Study Room channel ID
             * from:
             *
             * lfg_join:CHANNEL_ID
             */
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

            if (!guild) {
                return interaction.reply({
                    content:
                        '❌ This button can only be used inside BiologyHQ.',
                    ephemeral: true
                });
            }

            /*
             * Find the Study Room.
             */
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

            /*
             * Make sure it is a voice channel.
             */
            if (!channel.isVoiceBased()) {
                return interaction.reply({
                    content:
                        '❌ This is not a valid Study Room.',
                    ephemeral: true
                });
            }

            /*
             * Discord can only move someone
             * who is already connected to voice.
             *
             * If they are not currently in a VC,
             * Discord will not allow the bot to
             * place them into one.
             */
            const member =
                interaction.member;

            const currentVoiceChannel =
                member.voice?.channel;

            if (!currentVoiceChannel) {
                return interaction.reply({
                    content:
                        '🔊 **Join a voice channel first**, then click **Join Study Room** again.',
                    ephemeral: true
                });
            }

            /*
             * Already inside this Study Room.
             */
            if (
                currentVoiceChannel.id ===
                channel.id
            ) {
                return interaction.reply({
                    content:
                        '🔊 You are already in this Study Room.',
                    ephemeral: true
                });
            }

            /*
             * Check whether the Study Room
             * is full.
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
             * Get the bot's GuildMember.
             */
            const botMember =
                guild.members.me;

            if (!botMember) {
                return interaction.reply({
                    content:
                        '❌ I could not find my bot permissions.',
                    ephemeral: true
                });
            }

            /*
             * The bot needs Move Members.
             */
            if (
                !botMember.permissions.has(
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
             * Make sure the user can actually
             * connect to the Study Room.
             *
             * This is especially important because
             * the Join-to-Create system may have
             * its own permission overwrites.
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
             * Move the member into the
             * Study Room.
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
                        '❌ I could not move you into the Study Room. Make sure the bot has **Move Members** permission.',
                    ephemeral: true
                });
            }

            /*
             * Successful join.
             */
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
