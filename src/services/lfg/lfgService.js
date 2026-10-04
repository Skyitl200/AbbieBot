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
 * Transfer LFG ownership to another member.
 */
async function transferLfgOwnership(
    channel,
    oldCreatorId,
    newOwner
) {
    try {
        /*
         * Remove owner permissions from the
         * previous creator.
         */
        await channel.permissionOverwrites.edit(
            oldCreatorId,
            {
                ManageChannels: false,
                MoveMembers: false
            }
        );

        /*
         * Give owner permissions to the
         * new creator.
         */
        await channel.permissionOverwrites.edit(
            newOwner.id,
            {
                ViewChannel: true,
                Connect: true,
                Speak: true,
                MoveMembers: true,
                ManageChannels: true
            }
        );

        /*
         * Rename the Study Room so everyone knows
         * who currently controls it.
         */
        const newOwnerName =
            newOwner.displayName ||
            newOwner.user.username;

        await channel.setName(
            `${newOwnerName}'s Study Room`
        );

        /*
         * Update our internal ownership tracking.
         */
        activeLfgChannels.set(
            channel.id,
            {
                guildId: channel.guild.id,
                creatorId: newOwner.id
            }
        );

        logger.info(
            `Transferred LFG ownership of ${channel.id} from ${oldCreatorId} to ${newOwner.id}`
        );

        return true;

    } catch (error) {
        logger.error(
            'Error transferring LFG ownership:',
            error
        );

        return false;
    }
}

/**
 * Handle LFG voice-state changes.
 *
 * If the creator leaves:
 *
 * 1. If other students remain:
 *    Transfer ownership to one of them.
 *
 * 2. If nobody remains:
 *    Delete the Study Room.
 */
export async function handleLfgVoiceStateUpdate(
    oldState,
    newState
) {
    try {
        /*
         * We only care about the channel
         * the member LEFT.
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
         * Only react when the current owner
         * leaves the LFG Study Room.
         */
        if (
            oldState.member?.id !==
            lfgInfo.creatorId
        ) {
            return;
        }

        /*
         * Make sure the creator actually
         * left the channel.
         */
        if (
            newState.channelId ===
            oldChannel.id
        ) {
            return;
        }

        /*
         * Find remaining non-bot members.
         */
        const remainingMembers =
            [...oldChannel.members.values()]
                .filter(member => !member.user.bot);

        /*
         * Nobody remains.
         *
         * Delete the Study Room.
         */
        if (
            remainingMembers.length === 0
        ) {
            activeLfgChannels.delete(
                oldChannel.id
            );

            if (!oldChannel.deleted) {
                await oldChannel.delete(
                    'LFG Study Room became empty'
                );
            }

            logger.info(
                `Deleted empty LFG Study Room: ${oldChannel.id}`
            );

            return;
        }

        /*
         * Someone is still in the Study Room.
         *
         * Transfer ownership.
         */
        const newOwner =
            remainingMembers[0];

        await transferLfgOwnership(
            oldChannel,
            lfgInfo.creatorId,
            newOwner
        );

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
