import {
    ChannelType,
    PermissionFlagsBits
} from 'discord.js';

import { logger } from '../../utils/logger.js';

const DEFAULT_LFG_USER_LIMIT = 4;

/*
 * Tracks active LFG voice channels.
 *
 * channelId -> {
 *     guildId,
 *     creatorId
 * }
 */
const activeLfgChannels = new Map();

/**
 * Register a voice channel as an LFG channel.
 *
 * The creator starts with a maximum of 4 users,
 * but because they have ManageChannels they can
 * change the limit and permissions however they want.
 */
export function registerLfgChannel(channel, creatorId) {
    if (!channel) {
        return false;
    }

    activeLfgChannels.set(channel.id, {
        guildId: channel.guild.id,
        creatorId
    });

    return true;
}

/**
 * Create an LFG voice channel.
 *
 * The channel is created in the same category as the
 * creator's current voice channel when possible.
 */
export async function createLfgVoiceChannel(
    interaction,
    subjectLabel
) {
    try {
        const member = interaction.member;

        const currentVoiceChannel =
            member.voice?.channel;

        if (!currentVoiceChannel) {
            return {
                success: false,
                error:
                    '❌ You must be in a voice channel before creating an LFG.'
            };
        }

        const guild = interaction.guild;

        const creatorName =
            member.displayName ||
            interaction.user.username;

        const channelName =
            `${creatorName}'s Study Room`;

        const channel =
            await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,

                parent:
                    currentVoiceChannel.parentId ||
                    undefined,

                userLimit:
                    DEFAULT_LFG_USER_LIMIT,

                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,

                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak
                        ]
                    },
                    {
                        id: interaction.user.id,

                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });

        registerLfgChannel(
            channel,
            interaction.user.id
        );

        return {
            success: true,
            channel,
            creatorId: interaction.user.id,
            subjectLabel
        };

    } catch (error) {
        logger.error(
            'Error creating LFG voice channel:',
            error
        );

        return {
            success: false,
            error:
                '❌ I could not create the LFG voice channel.'
        };
    }
}

/**
 * Remove an LFG channel from tracking.
 */
export function unregisterLfgChannel(channelId) {
    activeLfgChannels.delete(channelId);
}

/**
 * Check whether a channel is an active LFG channel.
 */
export function isLfgChannel(channelId) {
    return activeLfgChannels.has(channelId);
}

/**
 * Get LFG information for a channel.
 */
export function getLfgChannelInfo(channelId) {
    return activeLfgChannels.get(channelId) || null;
}

/**
 * Automatically delete an LFG voice channel when
 * its creator leaves.
 */
export async function handleLfgVoiceStateUpdate(
    oldState,
    newState
) {
    try {
        /*
         * We only care about the channel the member
         * LEFT.
         */
        const oldChannel =
            oldState.channel;

        if (!oldChannel) {
            return;
        }

        const lfgInfo =
            activeLfgChannels.get(
                oldChannel.id
            );

        if (!lfgInfo) {
            return;
        }

        /*
         * If the creator is the person who left,
         * the LFG room is finished.
         */
        if (
            oldState.member?.id !==
            lfgInfo.creatorId
        ) {
            return;
        }

        /*
         * Make sure the creator actually left
         * the channel.
         */
        if (
            newState.channelId ===
            oldChannel.id
        ) {
            return;
        }

        activeLfgChannels.delete(
            oldChannel.id
        );

        /*
         * Delete the voice channel.
         */
        if (!oldChannel.deleted) {
            await oldChannel.delete(
                'LFG creator left the voice channel'
            );
        }

    } catch (error) {
        logger.error(
            'Error handling LFG voice state update:',
            error
        );
    }
}

/**
 * Attach the LFG voice-state listener to the bot.
 *
 * Call this once during bot startup.
 */
export function initializeLfgService(client) {
    client.on(
        'voiceStateUpdate',
        handleLfgVoiceStateUpdate
    );

    logger.info(
        'LFG voice channel service initialized'
    );
}
