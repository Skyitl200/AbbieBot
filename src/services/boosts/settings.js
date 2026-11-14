import { getGuildConfig, patchGuildConfig } from '../config/guildConfig.js';

export async function getBoostSettings(client, guildId) {
    const config = await getGuildConfig(client, guildId);
    const saved = config.boostAnnouncements || {};
    return { enabled: saved.enabled === true, channelId: saved.channelId || null, xpBonusPercent: saved.xpBonusPercent === 20 ? 20 : 0 };
}

export async function saveBoostSettings(client, guildId, settings) {
    return patchGuildConfig(client, guildId, { boostAnnouncements: settings });
}

export function boostedMessageXp(baseXp, member, settings) {
    if (!settings.enabled || settings.xpBonusPercent !== 20 || !member?.premiumSinceTimestamp) return baseXp;
    return Math.floor(baseXp * 1.2);
}
