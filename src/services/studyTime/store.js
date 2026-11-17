import { createHash } from 'node:crypto';
import pgConfig from '../../config/database/postgres.js';
import { CREDIT_MS, newRecord, addCredit, checkpointVoice } from './model.js';
const table = pgConfig.tables.temp_data;
export function studyPool(client) {
    const pool = client.db?.db?.pool || client.db?.pool;
    if (!pool?.connect || client.db?.useFallback) throw new Error('Study time needs the persistent database. Please try again shortly.');
    return pool;
}
export const profileKey = (guildId, userId) => `study-time:${guildId}:${userId}`;
export async function transaction(client, fn) {
    const db = await studyPool(client).connect();
    try { await db.query('BEGIN'); const value = await fn(db); await db.query('COMMIT'); return value; }
    catch (error) { await db.query('ROLLBACK').catch(() => {}); throw error; }
    finally { db.release(); }
}
async function changeRecord(db, guildId, userId, fn) {
    if (!guildId || !userId) throw new Error('Study time is available inside a server.');
    const key = profileKey(guildId, userId);
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    const result = await db.query(`SELECT value FROM ${table} WHERE key = $1`, [key]);
    const record = result.rows[0]?.value || newRecord();
    if (record.version !== 1 || !record.totals || !record.months) throw new Error('Saved study time could not be loaded safely.');
    const value = await fn(record);
    await db.query(`INSERT INTO ${table} (key, value, expires_at) VALUES ($1, $2::jsonb, NULL)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = NULL`, [key, JSON.stringify(record)]);
    return value;
}
// The receipt, totals and any caller-owned game mutation commit together.
export async function creditOnConnection(db, guildId, userId, source, receipt, at = Date.now()) {
    if (!Object.hasOwn(CREDIT_MS, source) || !receipt) throw new Error('Invalid study activity');
    const hash = createHash('sha256').update(`${guildId}:${userId}:${source}:${receipt}`).digest('hex');
    const result = await db.query(`INSERT INTO ${table} (key, value, expires_at) VALUES ($1, $2::jsonb, $3)
        ON CONFLICT (key) DO NOTHING RETURNING key`, [`study-time-event:${hash}`, '{}', new Date(at + 90 * 86400000)]);
    if (!result.rows.length) return false;
    return changeRecord(db, guildId, userId, record => { addCredit(record, source, CREDIT_MS[source], at); return true; });
}
export const creditActivity = (client, guildId, userId, source, receipt, at) => transaction(client, db => creditOnConnection(db, guildId, userId, source, receipt, at));
export const saveVoice = (client, guildId, userId, channelId, at) => transaction(client, db => changeRecord(db, guildId, userId, record => checkpointVoice(record, channelId, at)));
export async function recordsForGuild(client, guildId) {
    if (!guildId) throw new Error('Study time is available inside a server.');
    const db = await studyPool(client).connect();
    try {
        const result = await db.query(`SELECT key, value FROM ${table} WHERE key LIKE $1`, [`study-time:${guildId}:%`]);
        return result.rows.map(row => ({ userId: row.key.slice(`study-time:${guildId}:`.length), record: row.value }));
    } finally { db.release(); }
}
export async function clearOldVoice(client) {
    const db = await studyPool(client).connect();
    try { await db.query(`UPDATE ${table} SET value = jsonb_set(value, '{voice}', 'null'::jsonb) WHERE key LIKE $1`, ['study-time:%']); }
    finally { db.release(); }
}
export async function putResource(client, guildId, id, resource) {
    const db = await studyPool(client).connect();
    try { await db.query(`INSERT INTO ${table} (key, value, expires_at) VALUES ($1, $2::jsonb, NULL) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [`study-resource:${guildId}:${id}`, JSON.stringify(resource)]); }
    finally { db.release(); }
}
export async function getResource(client, guildId, id) {
    const db = await studyPool(client).connect();
    try { return (await db.query(`SELECT value FROM ${table} WHERE key = $1`, [`study-resource:${guildId}:${id}`])).rows[0]?.value; }
    finally { db.release(); }
}
