import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_ID, CACHE_REWARDS, rollCacheDrop, rollCacheReward } from '../src/services/discovery/catalog.js';
import { createOpenToken, checkOpenToken, openDiscoveryCache, OPEN_TOKEN_MS } from '../src/services/discovery/store.js';
import { inventoryMessage, cacheRewardsMessage, handleDiscoveryInteraction } from '../src/services/discovery/interface.js';
import { createStudySession, submitStudyAnswer } from '../src/services/study/sessions.js';
import { settleStudyReward, STUDY_AWARD_SQL } from '../src/services/study/rewards.js';
import { resultMessage } from '../src/services/study/interface.js';

function transactionalInventory(caches = 2) {
    let saved = { data: { wallet: 100, bank: 900, xp: 50, inventory: { [CACHE_ID]: caches, pickaxe: 1 } }, receipts: new Map() };
    let failReceipt = false, loseCommit = false, tail = Promise.resolve();
    const calls = [];
    const client = { db: { pool: { async connect() {
        let draft, release;
        return { async query(sql, params) {
            calls.push(sql);
            if (sql.includes('pg_advisory')) {
                const previous = tail; tail = new Promise(resolve => { release = resolve; }); await previous;
                draft = structuredClone(saved);
            }
            if (sql.startsWith('SELECT value')) return { rows: draft.receipts.has(params[0]) ? [{ value: structuredClone(draft.receipts.get(params[0])) }] : [] };
            if (sql.startsWith('SELECT data')) return { rows: [{ data: structuredClone(draft.data), balance: draft.data.wallet }] };
            if (sql.startsWith('UPDATE')) draft.data = { ...draft.data, ...JSON.parse(params[2]) };
            if (sql.startsWith('INSERT')) {
                if (failReceipt) throw new Error('receipt write failed');
                draft.receipts.set(params[0], JSON.parse(params[1]));
            }
            if (sql === 'COMMIT') {
                saved = structuredClone(draft);
                if (loseCommit) { loseCommit = false; throw new Error('response lost after commit'); }
            }
            return { rows: [] };
        }, release() { release?.(); } };
    } } } };
    return { client, data: () => saved.data, calls, failReceipt: () => { failReceipt = true; }, loseCommit: () => { loseCommit = true; } };
}
const item = () => ({ id: 'discovery_microscope_pin', name: 'Microscope Pin', rarity: 'Common', amount: 1 });
const coins = () => ({ id: 'merit_coins', name: 'Merit Coins', rarity: 'Common', amount: 5 });

test('exactly one of 300 activity rolls drops a cache; loot weights total 100', () => {
    let drops = 0;
    for (let roll = 0; roll < 300; roll++) if (rollCacheDrop(max => { assert.equal(max, 300); return roll; })) drops++;
    assert.equal(drops, 1);
    assert.equal(CACHE_REWARDS.reduce((sum, item) => sum + item.weight, 0), 100);
    const counts = new Map();
    for (let roll = 0; roll < 100; roll++) {
        const reward = rollCacheReward(max => max === 100 ? roll : 0);
        counts.set(reward.id, (counts.get(reward.id) || 0) + 1);
        if (reward.id === 'merit_coins') assert.ok(reward.amount >= 5 && reward.amount <= 30);
    }
    for (const reward of CACHE_REWARDS) assert.equal(counts.get(reward.id), reward.weight);
});

test('correct study answers store and notify cache drops once, including lost-response retries', async () => {
    let wallet = { wallet: 100, bank: 50, inventory: { pickaxe: 1 } }, writes = 0, lost = true;
    const client = { db: { async get() { return structuredClone(wallet); }, async set(key, value) { wallet = structuredClone(value); writes++; if (lost) { lost = false; throw new Error('lost response'); } return true; } } };
    const question = { id: 'cache-q', type: 'multiple_choice', question: 'Which?', options: ['A', 'B'], correct: [0], explanation: 'A is correct.' };
    const session = createStudySession('g', 'u', [question], 'random');
    submitStudyAnswer(session, [0]);
    session.reward = { status: 'failed', amount: 10, cacheDrop: true };
    await settleStudyReward(session, client);
    assert.equal(session.reward.status, 'failed');
    assert.equal(wallet.inventory[CACHE_ID], 1);
    assert.equal(wallet.wallet, 110);
    await settleStudyReward(session, client);
    assert.equal(session.reward.status, 'saved');
    assert.equal(wallet.inventory[CACHE_ID], 1);
    assert.equal(wallet.inventory.pickaxe, 1);
    assert.equal(writes, 1);
    assert.match(resultMessage(session, true).embeds[0].toJSON().description, /You found a \*\*Treasure Crate\*\*/);
    assert.match(STUDY_AWARD_SQL, /inventory/);
    assert.match(STUDY_AWARD_SQL, /CASE WHEN.*studyRewardReceipts.*THEN 0 ELSE \$6/s);
    const wrong = createStudySession('g', 'wrong', [question], 'random');
    submitStudyAnswer(wrong, [1]); await settleStudyReward(wrong, client);
    assert.equal(wrong.reward.cacheDrop, false);
    assert.equal(wallet.inventory[CACHE_ID], 1);
});

test('opening a cache consumes one and permanently stores one collectible without changing bank or XP', async () => {
    const s = transactionalInventory();
    const result = await openDiscoveryCache(s.client, 'g', 'u', createOpenToken(), { roll: item });
    assert.equal(result.inventory[CACHE_ID], 1);
    assert.equal(result.inventory.discovery_microscope_pin, 1);
    assert.equal(result.inventory.pickaxe, 1);
    assert.equal(result.balance, 100);
    assert.equal(s.data().bank, 900);
    assert.equal(s.data().xp, 50);
});

test('coin loot is credited to the existing wallet, and concurrent opens preserve both rewards', async () => {
    const s = transactionalInventory();
    await Promise.all([createOpenToken(), createOpenToken()].map(token => openDiscoveryCache(s.client, 'g', 'u', token, { roll: coins })));
    assert.equal(s.data().inventory[CACHE_ID], 0);
    assert.equal(s.data().wallet, 110);
    assert.equal(s.data().bank, 900);
});

test('duplicate clicks and a lost commit response cannot consume or reward a second cache', async () => {
    const s = transactionalInventory(); const token = createOpenToken(); let rolls = 0;
    await Promise.all([1, 2].map(() => openDiscoveryCache(s.client, 'g', 'u', token, { roll() { rolls++; return item(); } })));
    assert.equal(rolls, 1);
    assert.equal(s.data().inventory[CACHE_ID], 1);
    assert.equal(s.data().inventory.discovery_microscope_pin, 1);
    await openDiscoveryCache(s.client, 'g', 'u', createOpenToken(), { roll: coins });
    const refreshed = await openDiscoveryCache(s.client, 'g', 'u', token, { roll() { assert.fail('No reroll'); } });
    assert.equal(refreshed.inventory[CACHE_ID], 0);
    assert.equal(refreshed.balance, 105);
    const t = transactionalInventory(); const token2 = createOpenToken(); t.loseCommit();
    await assert.rejects(openDiscoveryCache(t.client, 'g', 'u', token2, { roll: coins }), /lost/);
    const replay = await openDiscoveryCache(t.client, 'g', 'u', token2, { roll() { assert.fail('No reroll after commit'); } });
    assert.equal(replay.repeated, true);
    assert.equal(t.data().inventory[CACHE_ID], 1);
    assert.equal(t.data().wallet, 105);
});

test('failed writes and empty inventories never lose a cache or grant loot', async () => {
    const s = transactionalInventory(); s.failReceipt();
    await assert.rejects(openDiscoveryCache(s.client, 'g', 'u', createOpenToken(), { roll: item }), /write failed/);
    assert.equal(s.data().inventory[CACHE_ID], 2);
    assert.equal(s.data().inventory.discovery_microscope_pin, undefined);
    assert.equal(s.data().wallet, 100);
    assert.ok(s.calls.includes('ROLLBACK'));
    const empty = transactionalInventory(0);
    await assert.rejects(openDiscoveryCache(empty.client, 'g', 'u', createOpenToken(), { roll() { assert.fail('No roll without cache'); } }), /do not have/);
    await assert.rejects(openDiscoveryCache({ db: { useFallback: true } }, 'g', 'u', createOpenToken()), /persistent inventory/);
});

test('opening controls are owner-bound, expire, and show the complete reward list', async () => {
    const now = Date.now(), token = createOpenToken(now);
    assert.equal(checkOpenToken(token, now), now);
    assert.throws(() => checkOpenToken(token, now + OPEN_TOKEN_MS), /expired/);
    assert.throws(() => checkOpenToken('malformed'), /expired/);
    const payload = inventoryMessage({ [CACHE_ID]: 2, discovery_guild_relic: 1, pickaxe: 1 }, { id: 'u', username: 'Student' });
    assert.match(payload.embeds[0].toJSON().description, /Treasure Crate.*2x/);
    assert.match(payload.embeds[0].toJSON().description, /Guild Relic/);
    const buttons = payload.components[0].toJSON().components;
    assert.equal(buttons[0].disabled, false);
    assert.ok(buttons.every(button => button.custom_id.length <= 100));
    assert.equal(inventoryMessage({}, { id: 'u' }).components[0].toJSON().components[0].disabled, true);
    assert.equal(cacheRewardsMessage().embeds[0].toJSON().fields.length, CACHE_REWARDS.length);
    let response;
    await handleDiscoveryInteraction({ user: { id: 'foreign' }, reply: async payload => { response = payload; } }, {}, ['open', 'u', token]);
    assert.equal(response.flags, 64);
    assert.match(response.content, /own Treasure/);
    const { default: route } = await import('../src/interactions/buttons/discovery/discovery.js');
    assert.equal(route.execute, handleDiscoveryInteraction);
});

test('a failed message update still confirms the already-saved reward', async () => {
    const s = transactionalInventory(1);
    let notification;
    await handleDiscoveryInteraction({ guildId: 'g', user: { id: 'u', username: 'Student' }, async deferUpdate() {},
        async editReply() { throw new Error('message unavailable'); }, async followUp(payload) { notification = payload; } },
    s.client, ['open', 'u', createOpenToken()]);
    assert.equal(s.data().inventory[CACHE_ID], 0);
    assert.match(notification.content, /Opened a \*\*Treasure Crate\*\*/);
    assert.equal(notification.flags, 64);
});
