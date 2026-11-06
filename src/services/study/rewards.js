import { CACHE_ID, rollCacheDrop } from '../discovery/catalog.js';
import { DEFAULT_ECONOMY_DATA } from '../../utils/constants.js';
import { normalizeEconomyData } from '../../utils/schemas.js';
import pgConfig from '../../config/database/postgres.js';
import { rollMeritReward } from '../../utils/meritRewards.js';
export const COIN_EMOJI = '<a:MeritCoins:1553709164012900404>';
export const BALANCE_EMOJI = '<a:ManyMerits:1553716009456898098>';
const walletLocks = new Map();

async function withWalletLock(key, callback) {
    const previous = walletLocks.get(key) || Promise.resolve();
    const operation = previous.catch(() => {}).then(callback);
    walletLocks.set(key, operation);
    try { return await operation; }
    finally { if (walletLocks.get(key) === operation) walletLocks.delete(key); }
}

// An atomic receipt and increment keep retries safe even if a database write
// commits but the response is lost. Keep only a bounded recent receipt history.
const receiptArray = "COALESCE(wallet.data->'studyRewardReceipts', '[]'::jsonb)";
const currentWallet = "COALESCE((wallet.data->>'wallet')::bigint, wallet.balance, 0)";
const delta = `CASE WHEN ${receiptArray} ? $4::text THEN 0 ELSE $3::bigint END`;
const currentCaches = `COALESCE((wallet.data->'inventory'->>'${CACHE_ID}')::bigint, 0)`;
const cacheDelta = `CASE WHEN ${receiptArray} ? $4::text THEN 0 ELSE $6::bigint END`;
const currentInventory = "CASE WHEN jsonb_typeof(wallet.data->'inventory') = 'object' THEN wallet.data->'inventory' ELSE '{}'::jsonb END";
export const STUDY_AWARD_SQL = `
INSERT INTO ${pgConfig.tables.economy} AS wallet (guild_id, user_id, balance, data)
VALUES ($1, $2, $3::bigint + $5::bigint, jsonb_build_object('wallet', $3::bigint + $5::bigint, 'studyRewardReceipts', jsonb_build_array($4::text), 'inventory', jsonb_build_object('${CACHE_ID}', $6::bigint)))
ON CONFLICT (guild_id, user_id) DO UPDATE SET
    balance = ${currentWallet} + ${delta},
    data = jsonb_build_object('bank', COALESCE(wallet.bank, 0)) || COALESCE(wallet.data, '{}'::jsonb) || jsonb_build_object(
        'wallet', ${currentWallet} + ${delta},
        'inventory', (${currentInventory}) || jsonb_build_object('${CACHE_ID}', ${currentCaches} + ${cacheDelta}),
        'studyRewardReceipts', CASE WHEN ${receiptArray} ? $4::text THEN ${receiptArray}
        ELSE COALESCE((SELECT jsonb_agg(entry ORDER BY position) FROM (
            SELECT entry, position FROM jsonb_array_elements(${receiptArray}) WITH ORDINALITY AS history(entry, position)
            ORDER BY position DESC LIMIT 2047
        ) AS recent), '[]'::jsonb) || jsonb_build_array($4::text) END),
    updated_at = CURRENT_TIMESTAMP
WHERE ${currentWallet} >= 0 AND ${currentWallet} <= 9007199254740991 - ${delta}
AND ${currentCaches} >= 0 AND ${currentCaches} <= 9007199254740991 - ${cacheDelta}
RETURNING balance`;

async function persistReward(session, client, reward, key) {
    const receipt = `${session.rewardId || session.id}:${session.index}`;
    const starting = client.config?.economy?.startingBalance ?? DEFAULT_ECONOMY_DATA.wallet;
    if (!Number.isSafeInteger(starting) || starting < 0 || starting > Number.MAX_SAFE_INTEGER - reward.amount) throw new Error('Invalid starting wallet balance');
    const pool = client.db?.db?.pool || client.db?.pool;
    if (pool) {
        if (reward.amount) {
            await pool.query(`INSERT INTO ${pgConfig.tables.guilds} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [session.guildId]);
            await pool.query(`INSERT INTO ${pgConfig.tables.users} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [session.userId]);
            const result = await pool.query(STUDY_AWARD_SQL, [session.guildId, session.userId, reward.amount, receipt, starting, reward.cacheDrop ? 1 : 0]);
            if (!result.rows.length) throw new Error('Invalid wallet balance');
            return Number(result.rows[0].balance);
        }
        const result = await pool.query(`SELECT COALESCE((data->>'wallet')::bigint, balance, 0) AS balance FROM ${pgConfig.tables.economy} WHERE guild_id = $1 AND user_id = $2`, [session.guildId, session.userId]);
        return result.rows.length ? Number(result.rows[0].balance) : starting;
    }
    if (client.db.useFallback === false) throw new Error('The persistent Merit Coin wallet is unavailable.');
    // Adapter path for non-Postgres storage implementations and isolated tests.
    const raw = await client.db.get(key, null);
    const data = normalizeEconomyData(raw || {}, { ...DEFAULT_ECONOMY_DATA, wallet: starting });
    const receipts = Array.isArray(data.studyRewardReceipts) ? data.studyRewardReceipts : [];
    if (receipts.includes(receipt)) return data.wallet;
    const balance = data.wallet + reward.amount;
    if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Invalid wallet balance');
    if (reward.amount) {
        const inventory = { ...data.inventory };
        if (reward.cacheDrop) {
            const count = Number(inventory[CACHE_ID] ?? 0);
            if (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER) throw new Error('Invalid cache inventory');
            inventory[CACHE_ID] = count + 1;
        }
        const result = await client.db.set(key, { ...data, wallet: balance, inventory, studyRewardReceipts: [...receipts.slice(-2047), receipt] });
        if (result === false) throw new Error('Unable to save Merit Coins');
    }
    return balance;
}

export function settleStudyReward(session, client) {
    if (!session.answered) throw new Error('Answer the current question first.');
    if (session.reward?.status === 'saved') return Promise.resolve(session.reward);
    if (session.reward?.status === 'pending') return session.reward.promise;
    const reward = { status: 'pending', amount: session.reward?.amount ?? (session.lastCorrect ? rollMeritReward() : 0), cacheDrop: session.reward?.cacheDrop ?? (session.lastCorrect ? rollCacheDrop() : false), balance: null };
    session.reward = reward;
    reward.promise = (async () => {
        try {
            if (!session.guildId) throw new Error('Merit Coins are available when studying in a server.');
            if (!client.db?.get || !client.db?.set || client.db.useFallback) throw new Error('The persistent Merit Coin wallet is unavailable.');
            const key = `guild:${session.guildId}:economy:${session.userId}`;
            reward.balance = await withWalletLock(key, () => persistReward(session, client, reward, key));
            reward.status = 'saved';
            session.moneyEarned += reward.amount;
        } catch (error) {
            reward.status = 'failed';
            reward.error = error.message;
        }
        return reward;
    })();
    return reward.promise;
}

// Use the caller's transaction so the catch and wallet credit commit together.
export async function awardCatchReward(connection, client, guildId, userId, petId, { rng } = {}) {
    const amount = rollMeritReward(rng);
    const cacheDrop = rollCacheDrop(rng);
    const starting = client.config?.economy?.startingBalance ?? DEFAULT_ECONOMY_DATA.wallet;
    if (!Number.isSafeInteger(starting) || starting < 0 || starting > Number.MAX_SAFE_INTEGER - amount) throw new Error('Invalid starting wallet balance');
    await connection.query(`INSERT INTO ${pgConfig.tables.guilds} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [guildId]);
    await connection.query(`INSERT INTO ${pgConfig.tables.users} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [userId]);
    const result = await connection.query(STUDY_AWARD_SQL, [guildId, userId, amount, `microbemon:${petId}`, starting, cacheDrop ? 1 : 0]);
    if (!result.rows.length) throw new Error('Unable to save catch reward');
    return { amount, balance: Number(result.rows[0].balance), cacheDrop };
}
