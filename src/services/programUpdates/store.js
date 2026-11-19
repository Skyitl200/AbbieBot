import pgConfig from '../../config/database/postgres.js';
const table = pgConfig.tables.temp_data;
export function poolFor(client) {
    const pool = client.db?.db?.pool || client.db?.pool;
    if (!pool?.connect || client.db?.useFallback) throw new Error('Program updates need the persistent database. Please try again shortly.');
    return pool;
}
export const key = (guild, kind, id = '') => `program-updates:${guild}:${kind}${id ? ':' + id : ''}`;
export async function get(db, name) { return (await db.query(`SELECT value FROM ${table} WHERE key = $1`, [name])).rows[0]?.value; }
export async function put(db, name, value) {
    await db.query(`INSERT INTO ${table} (key,value,expires_at) VALUES ($1,$2::jsonb,$3) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, expires_at=EXCLUDED.expires_at`, [name, JSON.stringify(value), value.expiresAt ? new Date(value.expiresAt) : null]);
}
export async function remove(db, name) { await db.query(`DELETE FROM ${table} WHERE key=$1`, [name]); }
export async function list(db, prefix) {
    return (await db.query(`SELECT key,value FROM ${table} WHERE key LIKE $1 ORDER BY key`, [prefix + '%'])).rows;
}
export async function withDb(client, fn) { const db = await poolFor(client).connect(); try { return await fn(db); } finally { db.release(); } }
// Session lock avoids concurrent checks/reviews across Railway replicas. Never
// hold a transaction open while fetching websites or sending Discord messages.
export async function locked(client, name, fn) {
    return withDb(client, async db => {
        const result = await db.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired', [name]);
        if (!result.rows[0]?.acquired) return { busy: true };
        try { return await fn(db); }
        finally { await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [name]); }
    });
}
export const sourcesFor = (db, guild) => list(db, key(guild, 'source') + ':').then(rows => rows.map(row => row.value));
