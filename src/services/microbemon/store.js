import { cacheFoundNotice } from '../discovery/catalog.js';
import { awardCatchReward, COIN_EMOJI, BALANCE_EMOJI } from '../study/rewards.js';
import { MicrobemonError } from './errors.js';
import pgConfig from '../../config/database/postgres.js';
import { newProfile, normalizeProfile } from './engine.js';

// One locked row holds both collection and encounter, so a catch cannot save twice
// or remove an encounter without saving its pet. Never fall back to volatile memory.
export async function withProfile(client, guildId, userId, operation, { rng } = {}) {
    if (!guildId) throw new MicrobemonError('Play Microbemon inside a server.');
    const pool = client.db?.db?.pool || client.db?.pool;
    if (!pool?.connect || client.db?.useFallback) throw new MicrobemonError('Microbemon needs the persistent database. Please try again when it is available.');
    const key = `microbemon:${guildId}:${userId}`;
    const connection = await pool.connect();
    try {
        await connection.query('BEGIN');
        await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
        const result = await connection.query(`SELECT value FROM ${pgConfig.tables.temp_data} WHERE key = $1`, [key]);
        const profile = result.rows[0]?.value || newProfile();
        if (profile.version !== 1 || !Array.isArray(profile.pets)) throw new MicrobemonError('Saved Microbemon data could not be loaded safely.');
        normalizeProfile(profile);
        const existingPets = new Set(profile.pets.map(pet => pet.id));
        let value = await operation(profile);
        for (const pet of profile.pets.filter(pet => !existingPets.has(pet.id))) {
            const reward = await awardCatchReward(connection, client, guildId, userId, pet.id, { rng });
            pet.catchReward = reward;
            value = `${value || ''}\n${COIN_EMOJI} You earned **+${reward.amount} Merit Coins**!\n${BALANCE_EMOJI} New Balance: **${reward.balance.toLocaleString()} Merit Coins**${reward.cacheDrop ? `\n${cacheFoundNotice()}` : ''}`;
        }
        await connection.query(`INSERT INTO ${pgConfig.tables.temp_data} (key, value, expires_at)
            VALUES ($1, $2::jsonb, NULL) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = NULL`,
        [key, JSON.stringify(profile)]);
        await connection.query('COMMIT');
        return { profile, value };
    } catch (error) {
        await connection.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { connection.release(); }
}
