import { logger } from '../../utils/logger.js';

/*
 * Tracks voice channels that currently have an
 * active LFG attached to them.
 *
 * channelId -> {
 *     guildId,
 *     creatorId
 * }
 */
const activeLfgChannels = new Map();

/**
 * Register an existing voice channel as an LFG channel.
 *
 * IMPORTANT:
 * The LFG system does NOT create the voice channel.
 * The Join to Create Study Room system creates it.
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
 * Use the creator's CURRENT Study Room as
 * the LFG Study Room.
 *
 * This function does NOT:
 *
 * - Create another voice channel
 * - Move the creator
 * - Delete the existing voice channel
 *
 * The creator must already be inside their
 * actual Study Room.
 */
export async function createLfgVoiceChannel(
    interaction,
    subjectLabel
) {
    try {
        const member =
            interaction.member;

        const currentVoiceChannel =
            member.voice?.channel;

        /*
         * The creator must be in a voice
         * channel first.
         */
        if (!currentVoiceChannel) {
            return {
                success: false,
                error:
                    '❌ You must be inside your Study Room before creating an LFG.'
            };
        }

        /*
         * IMPORTANT:
         *
         * Do NOT allow the Join to Create
         * trigger channel itself to become
         * an LFG.
         *
         * The trigger channel creates the
         * actual Study Room. The user must
         * wait until they are moved into
         * that Study Room.
         */
        const channelName =
            currentVoiceChannel.name
                ?.toLowerCase() || '';

        if (
            channelName.includes(
                'join to create'
            )
        ) {
            return {
                success: false,
                error:
                    '❌ Please wait until you are moved into your Study Room, then create the LFG.'
            };
        }

        /*
         * The current voice channel is now
         * the actual Study Room.
         *
         * We simply register it as the LFG.
         *
         * NO new voice channel is created.
         */
        registerLfgChannel(
            currentVoiceChannel,
            interaction.user.id
        );

        /*
         * Give the LFG creator control over
         * the existing Study Room.
         */
        try {
            await currentVoiceChannel.permissionOverwrites.edit(
                interaction.user.id,
                {
                    ViewChannel: true,
                    Connect: true,
                    Speak: true,
                    MoveMembers: true,
                    ManageChannels: true
                }
            );
        } catch (permissionError) {
            logger.warn(
                'Could not update LFG creator permissions:',
                permissionError
            );
        }

        return {
            success: true,
            channel: currentVoiceChannel,
            creatorId: interaction.user.id,
            subjectLabel
        };

    } catch (error) {
        logger.error(
            'Error registering current LFG voice channel:',
            error
        );

        return {
            success: false,
            error:
                '❌ I could not register your current Study Room as an LFG.'
        };
    }
}

/**
 * Remove an LFG channel from tracking.
 */
export function unregisterLfgChannel(
    channelId
) {
    activeLfgChannels.delete(
        channelId
    );
}

/**
 * Check whether a channel is an active LFG.
 */
export function isLfgChannel(
    channelId
) {
    return activeLfgChannels.has(
        channelId
    );
}

/**
 * Get LFG information for a channel.
 */
export function getLfgChannelInfo(
    channelId
) {
    return (
        activeLfgChannels.get(
            channelId
        ) || null
    );
}

/**
 * Transfer LFG ownership to another
 * student who remains in the Study Room.
 */
async function transferLfgOwnership(
    channel,
    oldCreatorId,
    newOwner
) {
    try {
        /*
         * Remove owner permissions from
         * the previous owner.
         */
        await channel.permissionOverwrites.edit(
            oldCreatorId,
            {
                MoveMembers: false,
                ManageChannels: false
            }
        );

        /*
         * Give owner permissions to
         * the new owner.
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
         * Rename the Study Room to show
         * the new LFG owner.
         */
        const newOwnerName =
            newOwner.displayName ||
            newOwner.user.username;

        await channel.setName(
            `${newOwnerName}'s Study Room`
        );

        /*
         * Update internal LFG ownership.
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
 * If the LFG owner leaves:
 *
 * 1. If other students remain:
 *    Transfer LFG ownership.
 *
 * 2. If nobody remains:
 *    Stop tracking the LFG.
 *
 * IMPORTANT:
 * We do NOT delete the voice channel here.
 * The Join to Create system owns the
 * voice-channel lifecycle.
 */
export async function handleLfgVoiceStateUpdate(
    oldState,
    newState
) {
    try {
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
         * Only react when the current LFG
         * owner leaves.
         */
        if (
            oldState.member?.id !==
            lfgInfo.creatorId
        ) {
            return;
        }

        /*
         * Make sure the owner actually
         * left the channel.
         */
        if (
            newState.channelId ===
            oldChannel.id
        ) {
            return;
        }

        /*
         * Find remaining real users.
         */
        const remainingMembers =
            [...oldChannel.members.values()]
                .filter(
                    member =>
                        !member.user.bot
                );

        /*
         * Nobody remains.
         *
         * Stop tracking the LFG.
         *
         * We intentionally do NOT delete
         * the voice channel.
         */
        if (
            remainingMembers.length === 0
        ) {
            activeLfgChannels.delete(
                oldChannel.id
            );

            logger.info(
                `LFG ended for empty Study Room: ${oldChannel.id}`
            );

            return;
        }

        /*
         * Someone is still inside.
         *
         * Transfer LFG ownership to the
         * first remaining student.
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
 * Attach the LFG voice-state listener.
 */
export function initializeLfgService(
    client
) {
    client.on(
        'voiceStateUpdate',
        handleLfgVoiceStateUpdate
    );

    logger.info(
        'LFG voice channel service initialized'
    );
}
