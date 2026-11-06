import { randomUUID } from 'node:crypto';
import pgConfig from '../../config/database/postgres.js';
import { CACHE_ID, rollCacheReward } from './catalog.js';

export class DiscoveryCacheError extends Error {}

export const OPEN_TOKEN_MS = 60 * 60_000;
export const createOpenToken = (now = Date.now()) => `${now.toString(36)}-${randomUUID()}`;
export function checkOpenToken(token, now = Date.now()) {
    if (typeof token !== 'string' || !/^[a-z0-9]+-[a-f0-9-]{36}$/.test(token)) throw new DiscoveryCacheError('This cache button has expired. Open /inventory again.');
    const issued = parseInt(token.split('-')[0], 36);
    if (!Number.isSafeInteger(issued) || issued > now + 30_000 || now - issued >= OPEN_TOKEN_MS) throw new DiscoveryCacheError('This cache button has expired. Open /inventory again.');
    return issued;
}

export async function openDiscoveryCache(client, guildId, userId, token, { now = Date.now(), roll = rollCacheReward } = {}) {
    const issued = checkOpenToken(token, now);
    if (!guildId) throw new DiscoveryCacheError('Open Discovery Caches inside a server.');
    const pool = client.db?.db?.pool || client.db?.pool;
    if (!pool?.connect || client.db?.useFallback) throw new DiscoveryCacheError('The persistent inventory is unavailable. Please try again later.');
    const connection = await pool.connect();
    try {
        await connection.query('BEGIN');
        const key = `discovery-open:${guildId}:${userId}:${token}`;
        // Serializes duplicate deliveries as well as multiple cache opens for this wallet.
        await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`guild:${guildId}:economy:${userId}`]);
        const receipt = await connection.query(`SELECT value FROM ${pgConfig.tables.temp_data} WHERE key = $1`, [key]);
        if (receipt.rows.length) {
            const current = await connection.query(`SELECT data, balance FROM ${pgConfig.tables.economy} WHERE guild_id = $1 AND user_id = $2 FOR UPDATE`, [guildId, userId]);
            const wallet = current.rows[0];
            await connection.query('COMMIT');
            return { ...receipt.rows[0].value, ...(wallet ? { inventory: wallet.data?.inventory || {}, balance: Number(wallet.data?.wallet ?? wallet.balance ?? 0) } : {}), repeated: true };
        }
        const result = await connection.query(`SELECT data, balance FROM ${pgConfig.tables.economy} WHERE guild_id = $1 AND user_id = $2 FOR UPDATE`, [guildId, userId]);
        const saved = result.rows[0];
        const data = saved?.data || {};
        const inventory = { ...data.inventory };
        const count = Number(inventory[CACHE_ID] || 0);
        if (!Number.isSafeInteger(count) || count < 1) throw new DiscoveryCacheError('You do not have a Discovery Cache yet. Correct /test answers and successful Microbemon catches each have a 1-in-300 chance.');
        const reward = roll();
        inventory[CACHE_ID] = count - 1;
        let balance = Number(data.wallet ?? saved.balance ?? 0);
        if (!Number.isSafeInteger(balance) || balance < 0) throw new DiscoveryCacheError('Your wallet could not be loaded safely.');
        if (reward.id === 'merit_coins') {
            if (!Number.isSafeInteger(reward.amount) || reward.amount < 5 || reward.amount > 30) throw new DiscoveryCacheError('Invalid cache coin reward');
            balance += reward.amount;
        } else {
            const quantity = Number(inventory[reward.id] || 0);
            if (!Number.isSafeInteger(quantity) || quantity < 0) throw new DiscoveryCacheError('Your item inventory could not be loaded safely.');
            inventory[reward.id] = quantity + 1;
            if (!Number.isSafeInteger(inventory[reward.id])) throw new DiscoveryCacheError('Your item inventory is full.');
        }
        if (!Number.isSafeInteger(balance)) throw new DiscoveryCacheError('Your wallet is full.');
        const patch = { wallet: balance, inventory };
        await connection.query(`UPDATE ${pgConfig.tables.economy} SET data = COALESCE(data, '{}'::jsonb) || $3::jsonb, balance = $4::bigint, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $1 AND user_id = $2`, [guildId, userId, JSON.stringify(patch), balance]);
        const opened = { reward, balance, inventory };
        await connection.query(`INSERT INTO ${pgConfig.tables.temp_data} (key, value, expires_at) VALUES ($1, $2::jsonb, $3)`, [key, JSON.stringify(opened), new Date(issued + OPEN_TOKEN_MS)]);
        await connection.query('COMMIT');
        return opened;
    } catch (error) {
        await connection.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { connection.release(); }
}
