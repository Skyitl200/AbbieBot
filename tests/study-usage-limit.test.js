import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeQuizStart, quizUsageDecision, isQuizSubscriber, QUIZ_WINDOW_MS, DEFAULT_SUBSCRIBER_ROLE_ID } from '../src/services/study/usageLimit.js';
import command from '../src/commands/Community/test.js';

const NOW = 1800000000000;
const history = count => Array.from({ length: count }, (_, i) => ({ id: `previous-${i}`, at: NOW - 1000 + i }));
const interaction = (id, extra = {}) => ({ id, user: { id: 'user' }, ...extra });
function storage() {
    const values = new Map();
    let queue = Promise.resolve();
    const pool = { async connect() {
        let unlock, pending;
        return {
            async query(sql, args = []) {
                if (sql.includes('pg_advisory_xact_lock')) {
                    const previous = queue;
                    queue = new Promise(resolve => { unlock = resolve; });
                    await previous;
                }
                if (sql.startsWith('SELECT value')) return { rows: values.has(args[0]) ? [{ value: structuredClone(values.get(args[0])) }] : [] };
                if (sql.startsWith('INSERT INTO')) pending = [args[0], JSON.parse(args[1])];
                if (sql === 'COMMIT' || sql === 'ROLLBACK') {
                    if (sql === 'COMMIT' && pending) values.set(...pending);
                    unlock?.(); unlock = null;
                }
                return { rows: [] };
            },
            release() { unlock?.(); },
        };
    } };
    return { values, client: { db: { useFallback: false, pool } } };
}

test('rolling allowance admits use 50, blocks 51, and expires the oldest use at exactly 24 hours', () => {
    assert.equal(quizUsageDecision(history(49), 'next', NOW).history.length, 50);
    const full = history(50);
    assert.deepEqual(quizUsageDecision(full, 'next', NOW), { allowed: false, resetAt: full[0].at + QUIZ_WINDOW_MS });
    assert.equal(quizUsageDecision(full, 'next', full[0].at + QUIZ_WINDOW_MS).allowed, true);
    assert.equal(quizUsageDecision(full, full[0].id, NOW).duplicate, true);
    assert.throws(() => quizUsageDecision({ count: 0 }, 'next', NOW), /Invalid/);
});

test('concurrent requests share a persistent allowance, retries are idempotent, and other users are independent', async () => {
    const { values, client } = storage();
    const results = await Promise.all(Array.from({ length: 60 }, (_, i) => consumeQuizStart(interaction(`i-${i}`), client, { now: NOW })));
    assert.equal(results.filter(r => r.allowed).length, 50);
    assert.equal(values.get('quiz:usage:user').length, 50);
    const restartedClient = { db: { ...client.db } };
    assert.equal((await consumeQuizStart(interaction('later'), restartedClient, { now: NOW })).allowed, false);
    assert.equal((await consumeQuizStart(interaction('i-0'), restartedClient, { now: NOW })).allowed, true);
    assert.equal(values.get('quiz:usage:user').length, 50);
    assert.equal((await consumeQuizStart(interaction('other', { user: { id: 'other' } }), client, { now: NOW })).remaining, 49);
});

test('exact Subscriber role is refreshed, bypasses storage, and a revoked role no longer bypasses', async () => {
    const roleId = process.env.SUBSCRIBER_ROLE_ID || DEFAULT_SUBSCRIBER_ROLE_ID;
    let paid = true, fetched = 0;
    const i = interaction('paid', { guildId: 'guild', member: { roles: [roleId] }, guild: { members: { async fetch(options) {
        assert.equal(options.force, true); fetched++;
        return { roles: { cache: new Map(paid ? [[roleId, {}]] : []) } };
    } } } });
    assert.deepEqual(await consumeQuizStart(i, null), { allowed: true, unlimited: true });
    paid = false;
    assert.equal(await isQuizSubscriber(i), false);
    assert.equal(fetched, 2);
    assert.equal(await isQuizSubscriber(interaction('dm', { member: { roles: [roleId] } })), false);
    assert.equal(await isQuizSubscriber(interaction('wrong', { guildId: 'g', member: { roles: ['some-other-role'] } })), false);
});

test('database failures roll back and release the connection rather than silently resetting the quota', async () => {
    const calls = [];
    const client = { db: { pool: { async connect() { return {
        async query(sql) { calls.push(sql); if (sql.startsWith('SELECT value')) throw new Error('offline'); return { rows: [] }; },
        release() { calls.push('released'); },
    }; } } } };
    await assert.rejects(consumeQuizStart(interaction('i'), client), /offline/);
    assert.ok(calls.includes('ROLLBACK'));
    assert.equal(calls.at(-1), 'released');
    await assert.rejects(consumeQuizStart(interaction('i'), { db: { useFallback: true, pool: client.db.pool } }), /unavailable/);
});

test('/test opens privately below quota and returns a retry time at quota without showing menus', async () => {
    const { values, client } = storage();
    const calls = [];
    const i = interaction('open', { async deferReply(payload) { assert.equal(payload.flags, 64); }, async editReply(payload) { calls.push(payload); } });
    await command.execute(i, {}, client);
    assert.ok(calls.at(-1).components.length);
    values.set('quiz:usage:user', Array.from({ length: 50 }, (_, n) => ({ id: `used-${n}`, at: Date.now() })));
    await command.execute({ ...i, id: 'blocked' }, {}, client);
    assert.match(calls.at(-1).content, /50 times per 24 hours/);
    assert.match(calls.at(-1).content, /<t:\d+:R>/);
    assert.deepEqual(calls.at(-1).components, []);
    assert.equal(values.get('quiz:usage:user').length, 50);
});
