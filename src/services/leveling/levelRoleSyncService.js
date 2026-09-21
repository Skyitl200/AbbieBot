import { logger } from '../../utils/logger.js';
import {
    getLevelingConfig,
    getUserLevelData,
    saveLevelingConfig
} from './leveling.js';

import { getUserLevelPrefix } from '../../utils/database/keys.js';

async function listLevelUserIds(client, guildId) {
    if (!client.db?.list) return [];

    const prefixes = [
        getUserLevelPrefix(guildId),
        `${guildId}:leveling:users:`
    ];

    const userIds = new Set();

    for (const prefix of prefixes) {
        let keys = await client.db.list(prefix).catch(() => []);

        if (!Array.isArray(keys)) {
            keys =
                typeof keys === 'object' && keys !== null
                    ? Object.keys(keys)
                    : [];
        }

        for (const key of keys) {
            if (!key.startsWith(prefix)) continue;

            const userId = key.slice(prefix.length);

            if (/^\d{17,19}$/.test(userId)) {
                userIds.add(userId);
            }
        }
    }

    return [...userIds];
}

async function syncMemberLevelRole(
    member,
    rewards,
    currentLevel
) {
    // Sort configured level rewards from lowest to highest.
    const rewardEntries = Object.entries(rewards)
        .map(([level, roleId]) => ({
            level: Number(level),
            roleId
        }))
        .filter(entry => Number.isFinite(entry.level))
        .sort((a, b) => a.level - b.level);

    // Find the HIGHEST milestone the member has reached.
    const eligibleRewards = rewardEntries.filter(
        entry => currentLevel >= entry.level
    );

    const highestReward =
        eligibleRewards.length > 0
            ? eligibleRewards[eligibleRewards.length - 1]
            : null;

    const correctRoleId = highestReward?.roleId ?? null;

    // All IDs belonging to the leveling reward system.
    const allLevelRoleIds = new Set(
        rewardEntries.map(entry => entry.roleId)
    );

    // Find level roles the member should no longer have.
    const rolesToRemove = member.roles.cache.filter(
        role =>
            allLevelRoleIds.has(role.id) &&
            role.id !== correctRoleId
    );

    if (rolesToRemove.size > 0) {
        await member.roles.remove(
            rolesToRemove,
            'Synchronizing highest level reward role'
        );

        logger.info(
            `🧹 Removed ${rolesToRemove.size} old level role(s) from ${member.user.tag}`
        );
    }

    // If the member hasn't reached Level 1 yet,
    // they should have no milestone role.
    if (!highestReward) {
        return {
            removed: rolesToRemove.size,
            awarded: false
        };
    }

    // Make sure their correct highest role exists.
    const role =
        member.guild.roles.cache.get(correctRoleId) ||
        await member.guild.roles
            .fetch(correctRoleId)
            .catch(() => null);

    if (!role) {
        return {
            removed: rolesToRemove.size,
            awarded: false
        };
    }

    // If they already have the correct role, we're done.
    if (member.roles.cache.has(correctRoleId)) {
        return {
            removed: rolesToRemove.size,
            awarded: false
        };
    }

    await member.roles.add(
        role,
        `Level ${highestReward.level} reward (startup sync)`
    );

    logger.info(
        `✅ Synced ${member.user.tag} to Level ${highestReward.level} role`
    );

    return {
        removed: rolesToRemove.size,
        awarded: true
    };
}

export async function reconcileLevelRoles(
    client,
    guildId = null
) {
    const summary = {
        scannedGuilds: 0,
        prunedRewardEntries: 0,
        rolesReAwarded: 0,
        rolesRemoved: 0,
        errors: 0
    };

    const guilds = guildId
        ? [client.guilds.cache.get(guildId)].filter(Boolean)
        : [...client.guilds.cache.values()];

    for (const guild of guilds) {
        summary.scannedGuilds += 1;

        try {
            const cfg = await getLevelingConfig(
                client,
                guild.id
            );

            if (cfg.enabled === false) continue;

            const rewards = {
                ...(cfg.roleRewards || {})
            };

            if (Object.keys(rewards).length === 0) {
                continue;
            }

            let configChanged = false;

            // Remove reward mappings whose Discord role
            // no longer exists.
            for (const [level, roleId] of Object.entries(rewards)) {
                const role =
                    guild.roles.cache.get(roleId) ||
                    await guild.roles
                        .fetch(roleId)
                        .catch(() => null);

                if (!role) {
                    delete rewards[level];
                    configChanged = true;
                    summary.prunedRewardEntries += 1;

                    logger.warn(
                        `Removed missing level ${level} reward role ${roleId} from config in guild ${guild.id}`
                    );
                }
            }

            if (configChanged) {
                cfg.roleRewards = rewards;

                await saveLevelingConfig(
                    client,
                    guild.id,
                    cfg
                );
            }

            if (Object.keys(rewards).length === 0) {
                continue;
            }

            const userIds = await listLevelUserIds(
                client,
                guild.id
            );

            for (const userId of userIds) {
                try {
                    const levelData =
                        await getUserLevelData(
                            client,
                            guild.id,
                            userId
                        );

                    const member =
                        await guild.members
                            .fetch(userId)
                            .catch(() => null);

                    if (!member) continue;

                    const result =
                        await syncMemberLevelRole(
                            member,
                            rewards,
                            levelData.level
                        );

                    summary.rolesRemoved +=
                        result.removed;

                    if (result.awarded) {
                        summary.rolesReAwarded += 1;
                    }

                } catch (memberError) {
                    summary.errors += 1;

                    logger.warn(
                        `Could not sync level role for ${userId} in guild ${guild.id}:`,
                        memberError.message
                    );
                }
            }

        } catch (error) {
            summary.errors += 1;

            logger.warn(
                `Level role sync failed for guild ${guild.id}:`,
                error.message
            );
        }
    }

    return summary;
}
