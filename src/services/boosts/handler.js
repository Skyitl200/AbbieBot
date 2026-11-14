import { MessageType, ChannelType, PermissionFlagsBits } from 'discord.js';
import { setTimeout as delay } from 'node:timers/promises';
import { pgConfig } from '../../config/database/postgres.js';
import { Mutex } from '../../utils/mutex.js';
import { logger } from '../../utils/logger.js';
import { getBoostAnnouncementKey } from '../../utils/database/keys.js';
import { getBoostSettings } from './settings.js';
import { boostEmojis } from './artwork.js';
import { boostAnnouncement } from './announcement.js';

export const BOOST_MESSAGE_TYPES = new Set([MessageType.GuildBoost, MessageType.GuildBoostTier1, MessageType.GuildBoostTier2, MessageType.GuildBoostTier3]);

export function canPostBoosts(channel, guildId, member) {
    return channel?.guild?.id === guildId && channel.type === ChannelType.GuildText &&
        Boolean(channel.permissionsFor(member)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles]));
}

async function sendOnce(client, key, send) {
    return Mutex.runExclusive(key, async () => {
        const pool = client.db?.db?.pool || client.db?.pool;
        if (pool) {
            const connection = await pool.connect();
            try {
                await connection.query('BEGIN');
                await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
                const existing = await connection.query(`SELECT value FROM ${pgConfig.tables.temp_data} WHERE key = $1`, [key]);
                if (!existing.rows.length) {
                    const message = await send();
                    await connection.query(`INSERT INTO ${pgConfig.tables.temp_data} (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
                        [key, JSON.stringify({ messageId: message.id, sentAt: Date.now() })]);
                }
                await connection.query('COMMIT');
            } catch (error) {
                await connection.query('ROLLBACK').catch(() => {});
                throw error;
            } finally { connection.release(); }
        } else {
            if (!client.db?.get || !client.db?.set) throw new Error('Boost receipt storage is unavailable');
            if (await client.db.get(key, null)) return;
            const message = await send();
            if (!await client.db.set(key, { messageId: message.id, sentAt: Date.now() })) throw new Error('Boost receipt could not be saved');
        }
    });
}

export async function handleBoostMessage(message, client) {
    if (!message.guild || !BOOST_MESSAGE_TYPES.has(message.type)) return false;
    try {
        const settings = await getBoostSettings(client, message.guild.id);
        if (!settings.enabled || !settings.channelId) return true;
        const channel = await message.guild.channels.fetch(settings.channelId);
        const me = message.guild.members.me || await message.guild.members.fetchMe();
        if (!canPostBoosts(channel, message.guild.id, me)) throw new Error('Cannot post boost announcement in the configured general channel');
        const emojis = await boostEmojis(client);
        const key = getBoostAnnouncementKey(message.guild.id, message.id);
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await sendOnce(client, key, () => channel.send({
                    ...boostAnnouncement({ guild: message.guild, user: message.author, displayName: message.member?.displayName, emojis, timestamp: message.createdAt }),
                    nonce: message.id, enforceNonce: true,
                }));
                break;
            } catch (error) {
                const transient = error.status >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', '40001', '40P01'].includes(error.code);
                if (!transient || attempt === 2) throw error;
                await delay(attempt ? 4000 : 1000);
            }
        }
    } catch (error) {
        logger.warn(`Boost announcement failed for ${message.id}: ${error.message}`);
    }
    // Native boost notices never earn message XP or trigger prefix commands.
    return true;
}
