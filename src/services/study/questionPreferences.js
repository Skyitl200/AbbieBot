import pgConfig from '../../config/database/postgres.js';

const keyFor = (guildId, userId) => `question-preferences:${guildId || 'dm'}:${userId}`;
function poolFor(client) {
  const pool = client.db?.db?.pool || client.db?.pool;
  if (!pool?.query || client.db?.useFallback || client.db?.getStatus?.().isDegraded) {
    throw new Error('This question preference service is unavailable. Your saved settings have not changed.');
  }
  return pool;
}

export async function getQuestionPreferences(client, guildId, userId) {
  const result = await poolFor(client).query(`SELECT value FROM ${pgConfig.tables.temp_data} WHERE key = $1`, [keyFor(guildId, userId)]);
  return result.rows[0]?.value?.disabled || {};
}

export async function setQuestionEnabled(client, guildId, userId, question, enabled) {
  if (typeof question.id !== 'string' || !question.id || question.id.length > 100 || typeof enabled !== 'boolean') throw new Error('Invalid question preference');
  const pool = poolFor(client);
  if (!pool.connect) throw new Error('This question preference service is unavailable. Your saved settings have not changed.');
  const connection = await pool.connect();
  const key = keyFor(guildId, userId);
  try {
    await connection.query('BEGIN');
    await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    const result = await connection.query(`SELECT value FROM ${pgConfig.tables.temp_data} WHERE key = $1`, [key]);
    const disabled = { ...result.rows[0]?.value?.disabled };
    if (enabled) delete disabled[question.id];
    else disabled[question.id] = { id: question.id, title: String(question.modelName ? `${question.modelName} — ${question.question}` : question.question || question.title || question.id).slice(0, 180), classId: question.classId || '' };
    await connection.query(`INSERT INTO ${pgConfig.tables.temp_data} (key, value, expires_at)
      VALUES ($1, $2::jsonb, NULL) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = NULL`, [key, JSON.stringify({ version: 1, disabled })]);
    await connection.query('COMMIT');
    return disabled;
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { connection.release(); }
}

export function enabledQuestions(questions, disabled) {
  return questions.filter(question => !Object.hasOwn(disabled, question.id));
}
