import pgConfig from '../../config/database/postgres.js';

export const FREE_QUIZ_LIMIT = 50;
export const QUIZ_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_SUBSCRIBER_ROLE_ID = '1552123365760831488';

// Share the allowance across servers and DMs so changing channels cannot reset it.
export function quizUsageDecision(stored, interactionId, now) {
    const history = typeof stored === 'string' ? JSON.parse(stored) : (stored ?? []);
    if (!Array.isArray(history) || history.some(entry => !entry || typeof entry.id !== 'string' || !Number.isFinite(entry.at))) {
        throw new Error('Invalid quiz usage history');
    }
    const recent = history.filter(entry => entry.at > now - QUIZ_WINDOW_MS).sort((a, b) => a.at - b.at);
    if (recent.some(entry => entry.id === interactionId)) return { allowed: true, history: recent, duplicate: true };
    if (recent.length >= FREE_QUIZ_LIMIT) return { allowed: false, resetAt: recent[0].at + QUIZ_WINDOW_MS };
    return { allowed: true, history: [...recent, { id: interactionId, at: now }], duplicate: false };
}

export async function isQuizSubscriber(interaction) {
    if (!interaction.guildId) return false;
    const roleId = process.env.SUBSCRIBER_ROLE_ID || DEFAULT_SUBSCRIBER_ROLE_ID;
    const member = interaction.guild?.members?.fetch
        ? await interaction.guild.members.fetch({ user: interaction.user.id, force: true })
        : interaction.member;
    return Boolean(member?.roles?.cache?.has(roleId) || (Array.isArray(member?.roles) && member.roles.includes(roleId)));
}

export async function consumeQuizStart(interaction, client, { now = Date.now() } = {}) {
    if (await isQuizSubscriber(interaction)) return { allowed: true, unlimited: true };
    if (!interaction.id || !interaction.user?.id) throw new Error('Missing quiz interaction identity');
    const db = client?.db;
    const pool = db?.db?.pool || db?.pool;
    if (db?.useFallback || !pool?.connect) throw new Error('Persistent quiz usage storage is unavailable');
    const connection = await pool.connect();
    try {
        await connection.query('BEGIN');
        const key = `quiz:usage:${interaction.user.id}`;
        // This also serializes a user's first two requests before a row exists.
        await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
        const stored = await connection.query(`SELECT value FROM ${pgConfig.tables.temp_data} WHERE key = $1 FOR UPDATE`, [key]);
        const decision = quizUsageDecision(stored.rows[0]?.value, interaction.id, now);
        if (decision.allowed && !decision.duplicate) {
            await connection.query(`INSERT INTO ${pgConfig.tables.temp_data} (key, value, expires_at) VALUES ($1, $2, $3)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
            [key, JSON.stringify(decision.history), new Date(now + QUIZ_WINDOW_MS)]);
        }
        await connection.query('COMMIT');
        return decision.allowed ? { allowed: true, remaining: Math.max(0, FREE_QUIZ_LIMIT - decision.history.length) } : decision;
    } catch (error) {
        await connection.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        connection.release();
    }
}
