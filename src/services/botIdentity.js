import { logger } from '../utils/logger.js';

const legacyName = name => ['abbiebot', 'titanbot'].includes(String(name || '').toLowerCase().replace(/\s/g, ''));

// Only write when needed: Discord rate-limits account username changes.
// Each failure is isolated so identity updates cannot stop normal startup.
export async function synchronizeBotIdentity(client, name = 'StudyBot') {
    if (client.user.username !== name) {
        try { await client.user.setUsername(name); }
        catch (error) { logger.warn(`Could not rename bot account to ${name}: ${error.message}`); }
    }
    for (const guild of client.guilds.cache.values()) {
        try {
            const member = guild.members.me || await guild.members.fetchMe();
            if (legacyName(member.nickname)) await member.setNickname(name, 'Rename AbbieBot to StudyBot');
        } catch (error) {
            logger.warn(`Could not update bot nickname in ${guild.id}: ${error.message}`);
        }
    }
}
