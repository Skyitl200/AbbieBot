import { crateDropMessage, announceCrateDrop } from '../src/services/discovery/announcements.js';
import { readFileSync } from 'node:fs';
import { CRATE_ART, withCrateArtwork } from '../src/services/discovery/artwork.js';
import { cacheFoundNotice } from '../src/services/discovery/catalog.js';
import { newProfile } from '../src/services/microbemon/engine.js';
import { renderGame } from '../src/services/microbemon/interface.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_ID, CACHE_REWARDS, rollCacheDrop, rollCacheReward } from '../src/services/discovery/catalog.js';
import { createOpenToken, checkOpenToken, openDiscoveryCache, OPEN_TOKEN_MS } from '../src/services/discovery/store.js';
import { inventoryMessage, cacheRewardsMessage, handleDiscoveryInteraction } from '../src/services/discovery/interface.js';
import { createStudySession, submitStudyAnswer } from '../src/services/study/sessions.js';
import { settleStudyReward, STUDY_AWARD_SQL } from '../src/services/study/rewards.js';
import { resultMessage, handleStudyInteraction } from '../src/services/study/interface.js';

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
    assert.equal(resultMessage(session, true).embeds.length, 1); // Crate is posted separately in public.
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

 test('crate artwork keeps the uploaded GIF and activity images intact, only on confirmed drops', () => {
    const original = readFileSync(CRATE_ART.path);
    assert.equal(original.subarray(0, 6).toString(), 'GIF89a');
    const base = { embeds: [{ image: { url: 'attachment://model.png' } }], files: [{ name: 'model.png' }] };
    assert.equal(withCrateArtwork(base, false), base);
    const decorated = withCrateArtwork(base, true);
    assert.equal(decorated.embeds[0], base.embeds[0]);
    assert.equal(decorated.files[0], base.files[0]);
    assert.equal(decorated.files[1].attachment, CRATE_ART.path);
    assert.equal(base.files.length, 1);
    const profile = newProfile();
    const normal = renderGame(profile, 'u');
    const drop = renderGame(profile, 'u', { notice: cacheFoundNotice() });
    assert.equal(normal.embeds.length, 1);
    assert.equal(drop.embeds.length, 1); // Gameplay does not own the persistent drop announcement.
    const publicDrop = crateDropMessage('u');
    assert.equal(publicDrop.flags, 0);
    assert.equal(publicDrop.embeds[0].toJSON().image.url, 'attachment://treasure-crate.gif');
    assert.ok(publicDrop.files.some(file => file.name === CRATE_ART.name));
});


test('saved crate announcements are public, owner-bound, and shared across concurrent retries', async () => {
    const calls = []; const reward = { cacheDrop: true };
    const interaction = { async followUp(payload) { calls.push(payload); return { id: 'public-crate' }; } };
    await Promise.all([announceCrateDrop(interaction, 'u', reward), announceCrateDrop(interaction, 'u', reward)]);
    await announceCrateDrop(interaction, 'u', reward);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].flags, 0);
    assert.equal(reward.announcementId, 'public-crate');
    assert.match(calls[0].components[0].toJSON().components[0].custom_id, /^discovery:redeem:u:/);
    assert.match(calls[0].embeds[0].toJSON().description, /<@u>/);
    assert.deepEqual(calls[0].allowedMentions, { parse: [] });
    await announceCrateDrop(interaction, 'u', { cacheDrop: false });
    assert.equal(calls.length, 1);
    let attempts = 0;
    const retry = { cacheDrop: true };
    const unavailable = { async followUp() { if (++attempts === 1) throw new Error('missing send permission'); return { id: 'retry-card' }; } };
    await announceCrateDrop(unavailable, 'u', retry);
    assert.equal(retry.announcementId, undefined);
    await announceCrateDrop(unavailable, 'u', retry);
    assert.equal(retry.announcementId, 'retry-card');
});

test('public redemption rejects strangers and only consumes the owner crate once without exposing their wallet', async () => {
    const s = transactionalInventory(1), token = createOpenToken();
    let denied;
    await handleDiscoveryInteraction({ user: { id: 'stranger' }, async reply(p) { denied = p; } }, s.client, ['redeem', 'u', token]);
    assert.equal(denied.flags, 64);
    assert.equal(s.data().inventory[CACHE_ID], 1);
    const edits = [], notices = [];
    const owner = { guildId: 'g', user: { id: 'u', username: 'Student' }, async deferUpdate() {}, async editReply(p) { edits.push(p); }, async followUp(p) { notices.push(p); } };
    await handleDiscoveryInteraction(owner, s.client, ['redeem', 'u', token]);
    await handleDiscoveryInteraction(owner, s.client, ['redeem', 'u', token]);
    assert.equal(s.data().inventory[CACHE_ID], 0);
    assert.equal(edits.length, 2);
    assert.deepEqual(edits[0].components, []);
    assert.match(edits[0].embeds[0].toJSON().description, /<@u> redeemed/);
    assert.doesNotMatch(JSON.stringify(edits), /New Balance|Inventory|wallet/);
    assert.ok(notices.every(p => p.flags === 64));
    assert.ok(notices.every(p => /Opened a/.test(p.content)));
});


test('a saved /test crate posts publicly while quiz feedback stays private', async () => {
    const question = { id: 'public-drop-question', type: 'multiple_choice', question: 'Which?', options: ['A','B'], correct: [0], explanation: 'A is correct.' };
    const session = createStudySession('public-drop-guild', 'public-drop-user', [question], 'random');
    submitStudyAnswer(session, [0]);
    session.publicQuestionId = 'original-question';
    session.reward = { status: 'failed', amount: 10, cacheDrop: true };
    let wallet = { wallet: 100, inventory: {} };
    const client = { db: { async get() { return structuredClone(wallet); }, async set(key, value) { wallet = structuredClone(value); return true; } } };
    const messages = [], edits = [];
    const interaction = { guildId: session.guildId, user: { id: session.userId }, async deferUpdate() {},
        webhook: { async editMessage(id, payload) { edits.push([id, payload]); } },
        async followUp(payload) { messages.push(payload); return { id: 'crate-announcement' }; },
        async reply(payload) { assert.fail(JSON.stringify(payload)); } };
    await handleStudyInteraction(interaction, client, ['reward', session.userId, session.id, String(session.index), String(session.revision)]);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].flags, 64);
    assert.match(messages[0].embeds[0].toJSON().title, /Correct/);
    assert.equal(messages[1].flags, 0);
    assert.match(messages[1].components[0].toJSON().components[0].custom_id, /^discovery:redeem:public-drop-user:/);
    assert.equal(session.reward.announcementId, 'crate-announcement');
    assert.equal(wallet.inventory[CACHE_ID], 1);
    assert.equal(wallet.wallet, 110);
    assert.deepEqual(edits, [['original-question', { components: [] }]]);
});
