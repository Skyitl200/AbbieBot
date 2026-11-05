import test from 'node:test';
import assert from 'node:assert/strict';
import { newProfile, rollEncounter, act, captureChance, COOLDOWN_MS, ENCOUNTER_MS } from '../src/services/microbemon/engine.js';
import { SPECIES, TIERS } from '../src/services/microbemon/catalog.js';
import { renderGame } from '../src/services/microbemon/interface.js';
import { withProfile } from '../src/services/microbemon/store.js';
import { handleMicrobemon } from '../src/services/microbemon/controller.js';
const now = Date.now();
const rolls = (...values) => { let i = 0; return max => { const v = values[i++] ?? 0; assert.ok(v >= 0 && v < max, `${v} outside ${max}`); return v; }; };
function started() { const p = newProfile(); act(p, 'explore', { now, rng: rolls(90, 0, 20, 0) }); return p; }
const turn = p => ({ encounterId: p.encounter.id, revision: p.encounter.revision, now });

// A simple transactional adapter permits testing failures without a Discord token or live DB.
function storage() {
    const data = new Map(); const calls = []; let fail = false;
    const client = { db: { pool: { connect: async () => {
        let pending;
        return { query: async (sql, params) => {
            calls.push({ sql, params });
            if (sql.startsWith('SELECT value')) return { rows: data.has(params[0]) ? [{ value: structuredClone(data.get(params[0])) }] : [] };
            if (sql.startsWith('INSERT')) { if (fail) throw new Error('write failed'); pending = [params[0], JSON.parse(params[1])]; }
            if (sql === 'COMMIT' && pending) data.set(...pending);
            return { rows: [] };
        }, release: () => calls.push({ sql: 'RELEASE' }) };
    } } } };
    return { client, data, calls, fail: () => { fail = true; } };
}

test('all 100 encounter rolls match the advertised tier weights', () => {
    const counts = Object.fromEntries(TIERS.map(t => [t.name, 0]));
    for (let i = 0; i < 100; i++) counts[SPECIES.find(s => s.id === rollEncounter(rolls(i, 0, 1, 0), now).speciesId).tier]++;
    assert.deepEqual(counts, { common: 55, uncommon: 30, rare: 12, epic: 3 });
    assert.equal(new Set(SPECIES.map(s => s.id)).size, 19);
});

test('exactly one of the 1,000 shiny roll outcomes is shiny, independent of tier', () => {
    for (const tierRoll of [0, 55, 85, 97]) {
        let shiny = 0;
        for (let i = 0; i < 1000; i++) if (rollEncounter(rolls(tierRoll, 0, i, 0), now).shiny) shiny++;
        assert.equal(shiny, 1);
    }
});

test('battle answers change HP, reject stale answers, and improve capture chance', () => {
    const p = started(); assert.equal(captureChance(p.encounter), 35);
    act(p, 'battle', { ...turn(p), rng: rolls(0, 0, 0) });
    const previous = turn(p); const answer = p.encounter.question.correct;
    act(p, 'answer', { ...previous, answer });
    assert.equal(p.encounter.hp, 25); assert.ok(captureChance(p.encounter) > 35);
    assert.throws(() => act(p, 'answer', { ...previous, answer }), /earlier turn/);
    for (let i = 0; i < 2; i++) {
        act(p, 'battle', { ...turn(p), rng: rolls(0, 0, 0) });
        act(p, 'answer', { ...turn(p), answer: p.encounter.question.correct });
    }
    assert.equal(p.encounter.hp, 0); assert.equal(captureChance(p.encounter), 90);
});

test('correct answers are stored after shuffling; wrong answers harm the player', () => {
    const p = started();
    act(p, 'battle', { ...turn(p), rng: rolls(0, 0, 0) });
    const correct = p.encounter.question.correct;
    act(p, 'answer', { ...turn(p), answer: (correct + 1) % 3 });
    assert.equal(p.encounter.playerHp, 45); assert.equal(p.encounter.hp, 40);
});

test('catches save a unique pet and default companion; duplicate clicks cannot duplicate it', () => {
    const p = started(); const previous = turn(p);
    p.encounter.shiny = true;
    act(p, 'catch', { ...previous, rng: rolls(0) });
    assert.equal(p.pets.length, 1); assert.equal(p.pets[0].shiny, true);
    assert.equal(p.companion, p.pets[0].id); assert.equal(p.encounter, null);
    assert.throws(() => act(p, 'catch', { ...previous, rng: rolls(0) }), /ended/);
    assert.equal(p.pets.length, 1);
    act(p, 'nickname', { petId: p.pets[0].id, nickname: 'Ribbon' });
    assert.equal(p.pets[0].nickname, 'Ribbon');
    assert.throws(() => act(p, 'companion', { petId: 'not-owned' }), /not in your collection/);
});

test('three failed captures end the encounter; cooldown and expiry are enforced', () => {
    const p = started();
    for (let i = 0; i < 3; i++) act(p, 'catch', { ...turn(p), rng: rolls(99) });
    assert.equal(p.encounter, null); assert.equal(p.pets.length, 0);
    assert.throws(() => act(p, 'explore', { now: now + 1 }), /seconds/);
    act(p, 'explore', { now: now + COOLDOWN_MS, rng: rolls(0, 0, 1, 0) });
    assert.throws(() => act(p, 'catch', { ...turn(p), now: now + COOLDOWN_MS + ENCOUNTER_MS }), /ended/);
});

test('collection and encounter are committed together and survive a fresh read', async () => {
    const s = storage();
    await withProfile(s.client, 'guild', 'user', p => {
        act(p, 'explore', { now, rng: rolls(0, 0, 0, 0) });
        act(p, 'catch', { ...turn(p), rng: rolls(0) });
    });
    const { profile } = await withProfile(s.client, 'guild', 'user', () => {});
    assert.equal(profile.pets.length, 1); assert.equal(profile.encounter, null);
    assert.ok(s.calls.some(call => call.sql.includes('pg_advisory_xact_lock')));
    assert.ok(s.calls.some(call => call.sql.includes('expires_at = NULL')));
    assert.equal(s.data.size, 1);
});

test('save failure rolls back a catch; memory fallback is refused', async () => {
    const s = storage();
    await withProfile(s.client, 'guild', 'user', p => act(p, 'explore', { now, rng: rolls(0, 0, 1, 0) }));
    s.fail();
    await assert.rejects(withProfile(s.client, 'guild', 'user', p => act(p, 'catch', { ...turn(p), rng: rolls(0) })), /write failed/);
    assert.equal(s.data.get('microbemon:guild:user').pets.length, 0);
    assert.ok(s.data.get('microbemon:guild:user').encounter);
    assert.equal(s.calls.at(-2).sql, 'ROLLBACK');
    await assert.rejects(withProfile({ db: { useFallback: true } }, 'guild', 'user', () => {}), /persistent database/);
    await assert.rejects(withProfile(s.client, null, 'user', () => {}), /inside a server/);
});

test('buttons are owner-bound; another user cannot access the collection', async () => {
    let touched = false; let response;
    await handleMicrobemon({ user: { id: 'other' }, reply: async p => { response = p; } },
        { db: { pool: { connect: () => { touched = true; } } } }, ['owner', 'catch']);
    assert.equal(touched, false); assert.equal(response.flags, 64);
});

test('encounter and collection payloads fit Discord limits and clear stale attachments', () => {
    const p = started();
    const messages = [renderGame(p, '123456789012345678')];
    act(p, 'catch', { ...turn(p), rng: rolls(0) });
    p.pets[0].nickname = '@everyone **Ribbon**';
    messages.push(renderGame(p, '123456789012345678', { view: 'collection' }), renderGame(p, '123456789012345678', { view: 'guide' }));
    for (const message of messages) {
        assert.deepEqual(message.attachments, []); assert.deepEqual(message.allowedMentions, { parse: [] });
        const embed = message.embeds[0].toJSON(); assert.ok(embed.description.length <= 4096);
        assert.ok(message.components.length <= 5);
        for (const row of message.components) for (const component of row.toJSON().components) assert.ok(component.custom_id.length <= 100);
    }
});

test('controller confirms a capture only after saving and renders the saved collection', async () => {
    const s = storage();
    await withProfile(s.client, 'guild', 'owner', p => {
        act(p, 'explore', { now, rng: rolls(0, 0, 1, 0) });
        p.encounter.hp = 0;
    });
    const e = s.data.get('microbemon:guild:owner').encounter;
    // Force an already caught state to test controller navigation without random outcomes.
    await withProfile(s.client, 'guild', 'owner', p => act(p, 'catch', { encounterId: e.id, revision: e.revision, now, rng: rolls(0) }));
    let message;
    await handleMicrobemon({ guildId: 'guild', user: { id: 'owner' }, deferUpdate: async () => {},
        editReply: async p => { message = p; }, followUp: async () => assert.fail('Valid collection should render') },
    s.client, ['owner', 'collection', '0']);
    assert.match(message.embeds[0].toJSON().description, /Level/);
    assert.equal(s.data.get('microbemon:guild:owner').pets.length, 1);
    s.fail();
    let errorMessage;
    await handleMicrobemon({ guildId: 'guild', user: { id: 'owner' }, deferUpdate: async () => {},
        editReply: async () => assert.fail('Do not confirm on failed save'), followUp: async p => { errorMessage = p; } },
    s.client, ['owner', 'collection', '0']);
    assert.match(errorMessage.content, /Could not save/);
});

test('all species questions have valid answers and correct note errors', () => {
    for (const species of SPECIES) {
        assert.equal(species.answers.length, 3);
        assert.ok(species.correct >= 0 && species.correct < 3);
        assert.ok(species.fact.length < 1024);
        assert.ok(TIERS.some(t => t.name === species.tier));
    }
    assert.match(SPECIES.find(s => s.id === 'toxoplasma').fact, /forms tissue cysts/);
    assert.equal(SPECIES.find(s => s.id === 'fasciolopsis').name, 'Fasciolopsis buski');
});

test('Microbemon routes load without exceeding Discord command limit', async () => {
    const { Collection } = await import('discord.js');
    const { loadCommands } = await import('../src/handlers/loaders/commandLoader.js');
    const { default: loadInteractions } = await import('../src/handlers/loaders/interactions.js');
    const client = { buttons: new Collection(), selectMenus: new Collection(), modals: new Collection() };
    await loadCommands(client); await loadInteractions(client);
    assert.ok(client.commands.size <= 100);
    assert.equal(client.buttons.get('microbemon').execute, handleMicrobemon);
    assert.equal(client.modals.get('microbemon').execute, handleMicrobemon);
    assert.ok(client.commands.get('test').data.toJSON().options.some(option => option.name === 'microbemon'));
});
