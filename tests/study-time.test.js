import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { newRecord, addCredit, addVoiceInterval, checkpointVoice, totalsFor, sumTotals, monthKey, tierFor } from '../src/services/studyTime/model.js';
import { creditActivity, recordsForGuild, saveVoice, profileKey } from '../src/services/studyTime/store.js';
import { eligibleVoice, trackVoiceState, startStudyTime, creditTestQuestion } from '../src/services/studyTime/tracking.js';
import { rankRecords, studyTimeMessage, monthlyLevelMessage, openMonthlyLevel, createStudyResourceMessage, handleStudyTime } from '../src/services/studyTime/interface.js';
import { withProfile } from '../src/services/microbemon/store.js';
import { newProfile } from '../src/services/microbemon/engine.js';

const now = Date.parse('2026-11-17T15:00:00Z');
// Transactional test adapter: serialized BEGIN, isolated JSON values, atomic
// COMMIT/ROLLBACK, conflict receipts, and the actual store query boundaries.
function database() {
    let data = new Map(), tail = Promise.resolve(), failPrefix;
    const client = new EventEmitter();
    client.studyTimeEnabled = true;
    client.db = { pool: { connect: async () => {
        let pending, unlock;
        const rows = () => pending || data;
        return { query: async (sql, params = []) => {
            if (sql === 'BEGIN') { const prior = tail; tail = new Promise(resolve => { unlock = resolve; }); await prior; pending = structuredClone(data); return { rows: [] }; }
            if (sql === 'COMMIT') { data = pending; pending = null; unlock(); unlock = null; return { rows: [] }; }
            if (sql === 'ROLLBACK') { pending = null; unlock?.(); unlock = null; return { rows: [] }; }
            if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
            if (sql.startsWith('SELECT value')) return { rows: rows().has(params[0]) ? [{ value: structuredClone(rows().get(params[0]).value) }] : [] };
            if (sql.startsWith('SELECT key, value')) return { rows: [...rows()].filter(([key]) => key.startsWith(params[0].slice(0, -1))).map(([key, item]) => ({ key, value: structuredClone(item.value) })) };
            if (sql.startsWith('UPDATE')) { for (const [key, row] of rows()) if (key.startsWith('study-time:')) row.value.voice = null; return { rows: [] }; }
            if (sql.trimStart().startsWith('INSERT')) {
                if (failPrefix && params[0].startsWith(failPrefix)) throw new Error('Simulated write failure');
                if (sql.includes('DO NOTHING') && rows().has(params[0])) return { rows: [] };
                rows().set(params[0], { value: JSON.parse(params[1]), expires: params[2] || null });
                return { rows: sql.includes('RETURNING key') ? [{ key: params[0] }] : [] };
            }
            assert.fail(`Unexpected SQL: ${sql}`);
        }, release() { unlock?.(); } };
    } } };
    return { client, read: key => structuredClone(data.get(key)?.value), fail: prefix => { failPrefix = prefix; }, clearFailure: () => { failPrefix = null; } };
}

function voice(guildId, userId, channelId, extra = {}) {
    return { guild: { id: guildId, afkChannelId: 'afk' }, channelId, member: { id: userId, user: { bot: false } }, ...extra };
}

test('voice credits split at Eastern month boundaries and retain exact elapsed time across DST', () => {
    const r = newRecord();
    addVoiceInterval(r, Date.parse('2026-11-01T03:59:30Z'), Date.parse('2026-11-01T04:00:30Z'));
    assert.equal(r.months['2026-10'].voice, 30000);
    assert.equal(r.months['2026-11'].voice, 30000);
    addVoiceInterval(r, Date.parse('2026-11-01T05:59:30Z'), Date.parse('2026-11-01T06:00:30Z'));
    assert.equal(r.months['2026-11'].voice, 90000);
    assert.equal(r.totals.voice, 120000);
    assert.equal(monthKey(Date.parse('2027-01-01T04:00Z')), '2026-12');
});

test('live totals include only the current voice lease, without mutating persisted values', () => {
    const r = newRecord(); checkpointVoice(r, 'room', now);
    assert.equal(totalsFor(r, 'month', now + 30000).voice, 30000);
    assert.equal(totalsFor(r, 'month', now + 3600000).voice, 120000);
    assert.equal(r.totals.voice, 0);
    checkpointVoice(r, null, now + 60000);
    assert.equal(r.totals.voice, 60000);
});

test('concurrent duplicate deliveries add one credit; unique actions and guilds remain independent', async () => {
    const d = database();
    const results = await Promise.all(Array.from({ length: 15 }, () => creditActivity(d.client, 'g', 'u', 'microbemon', 'interaction-1', now)));
    assert.equal(results.filter(Boolean).length, 1);
    await Promise.all(Array.from({ length: 5 }, (_, i) => creditActivity(d.client, 'g', 'u', 'test', `question-${i}`, now)));
    await creditActivity(d.client, 'other', 'u', 'links', 'interaction-1', now);
    const r = d.read(profileKey('g', 'u'));
    assert.equal(r.totals.microbemon, 30000); assert.equal(r.totals.test, 150000);
    assert.equal(d.read(profileKey('other', 'u')).totals.links, 20000);
    assert.equal((await recordsForGuild(d.client, 'g')).length, 1);
});

test('a failed activity transaction rolls back its receipt and can be retried safely', async () => {
    const d = database(); d.fail('study-time:');
    await assert.rejects(creditActivity(d.client, 'g', 'u', 'test', 'question', now), /write failure/);
    d.clearFailure(); assert.equal(await creditActivity(d.client, 'g', 'u', 'test', 'question', now), true);
    assert.equal(d.read(profileKey('g', 'u')).totals.test, 30000);
});

test('Microbemon save and study credit commit or roll back together', async () => {
    const d = database(); d.fail('study-time:');
    const options = { studyActivity: { source: 'microbemon', receipt: 'game-click', at: now } };
    await assert.rejects(withProfile(d.client, 'g', 'u', p => { p.lastEncounter = now; }, options), /write failure/);
    assert.equal(d.read('microbemon:g:u'), undefined);
    d.clearFailure();
    await withProfile(d.client, 'g', 'u', p => { p.lastEncounter = now; }, options);
    assert.equal(d.read('microbemon:g:u').lastEncounter, now);
    assert.equal(d.read(profileKey('g', 'u')).totals.microbemon, 30000);
});

test('question retries count once, with later questions earning their own 30 seconds', async () => {
    const d = database(); const session = { guildId: 'g', userId: 'u', rewardId: 'session-id', index: 0 };
    await creditTestQuestion(session, d.client); await creditTestQuestion(session, d.client);
    session.index++; await creditTestQuestion(session, d.client);
    assert.equal(d.read(profileKey('g', 'u')).totals.test, 60000);
});

test('voice joins, moves and leaves count continuously; mute updates do not double count', async () => {
    const d = database();
    await trackVoiceState(voice('g', 'u', null), voice('g', 'u', 'a'), d.client, now);
    await trackVoiceState(voice('g', 'u', 'a'), voice('g', 'u', 'b'), d.client, now + 30000);
    await trackVoiceState(voice('g', 'u', 'b'), voice('g', 'u', 'b', { selfMute: true }), d.client, now + 45000);
    await trackVoiceState(voice('g', 'u', 'b'), voice('g', 'u', null), d.client, now + 60000);
    assert.equal(d.read(profileKey('g', 'u')).totals.voice, 60000);
    assert.equal(eligibleVoice(voice('g', 'u', 'afk')), false);
    assert.equal(eligibleVoice(voice('g', 'u', 'a', { selfDeaf: true })), true);
    assert.equal(eligibleVoice(voice('g', 'u', 'a', { member: { user: { bot: true } } })), false);
});

test('restart clears stale voice timestamps instead of counting downtime', async () => {
    const d = database();
    const before = Date.now();
    await saveVoice(d.client, 'g', 'u', 'a', before - 3600000);
    d.client.studyTimeEnabled = false;
    d.client.guilds = { cache: new Map([['g', { id: 'g', voiceStates: { cache: new Map([['u', voice('g', 'u', 'a')]]) } }]]) };
    try {
        await startStudyTime(d.client);
        const r = d.read(profileKey('g', 'u'));
        assert.equal(r.totals.voice, 0);
        assert.ok(r.voice.at >= before);
    } finally { d.client.emit('invalidated'); }
});

test('monthly and all-time rankings, personal tiers and progress match the reference layout', () => {
    const r = newRecord(); addCredit(r, 'voice', 65 * 3600000, now);
    const old = newRecord(); addCredit(old, 'voice', 200 * 3600000, Date.parse('2026-10-10T15:00Z'));
    const rows = [{ userId: 'u', record: r }, { userId: 'old', record: old }];
    assert.equal(rankRecords(rows, 'month', now)[0].userId, 'u');
    assert.equal(rankRecords(rows, 'all', now)[0].userId, 'old');
    const tier = tierFor(65 * 3600000); assert.equal(tier.current.name, 'Master'); assert.equal(tier.next.name, 'Grandmaster'); assert.equal(tier.rank, 8);
    const card = studyTimeMessage(rows, 'u', { view: 'stats', at: now }); const embed = card.embeds[0].toJSON();
    assert.match(embed.title, /November 2026/);
    assert.equal(embed.fields.find(f => f.name === 'Promotion in').value, '15h 0m');
    assert.deepEqual(card.allowedMentions, { parse: [] });
});

test('leaderboards paginate larger servers and keep Discord payloads within limits', () => {
    const rows = Array.from({ length: 53 }, (_, i) => { const r = newRecord(); addCredit(r, 'test', (i + 1) * 30000, now); return { userId: `${1000 + i}`, record: r }; });
    const card = studyTimeMessage(rows, '1000', { at: now, page: 99 }); const embed = card.embeds[0].toJSON();
    assert.match(embed.footer.text, /Page 6\/6/);
    assert.equal(embed.description.split('\n').length, 3);
    for (const row of card.components) for (const b of row.toJSON().components) assert.ok(b.custom_id.length <= 100);
    assert.ok(embed.description.length < 4096);
});

test('tracked resource clicks add 20 seconds with duplicate-delivery protection', async () => {
    const d = database(); const card = await createStudyResourceMessage(d.client, 'g', 'Lab video', 'https://example.com/video');
    const args = card.components[0].toJSON().components[0].custom_id.split(':').slice(1);
    const i = { id: 'click-1', guildId: 'g', user: { id: 'u' }, deferred: true, deferReply: async () => {}, editReply: async () => {}, followUp: async p => assert.fail(p.content) };
    await handleStudyTime(i, d.client, args); await handleStudyTime(i, d.client, args);
    assert.equal(d.read(profileKey('g', 'u')).totals.links, 20000);
    i.id = 'click-2'; await handleStudyTime(i, d.client, args);
    assert.equal(d.read(profileKey('g', 'u')).totals.links, 40000);
    await assert.rejects(createStudyResourceMessage(d.client, 'g', 'Unsafe', 'javascript:alert(1)'), /HTTPS/);
});

test('another member cannot modify an owner-bound leaderboard card', async () => {
    let response;
    await handleStudyTime({ guildId: 'g', user: { id: 'other' }, reply: async p => { response = p; } }, {}, ['owner', 'leaderboard', 'month', '0']);
    assert.equal(response.flags, 64); assert.match(response.content, /your own/);
});

test('tracking refuses volatile fallback storage', async () => {
    await assert.rejects(creditActivity({ db: { useFallback: true } }, 'g', 'u', 'test', 'q', now), /persistent database/);
});

test('voice tracking still runs when join-to-create is disabled', async () => {
    const { default: event } = await import('../src/events/voiceStateUpdate.js');
    const d = database(); d.client.db.get = async () => ({ enabled: false, triggerChannels: [] });
    await event.execute(voice('g', 'u', null), voice('g', 'u', 'room'), d.client);
    assert.equal(d.read(profileKey('g', 'u')).voice.channelId, 'room');
});

test('resource publishing requires Manage Server and does not write on denial', async () => {
    const { openStudyTime } = await import('../src/services/studyTime/interface.js');
    let message;
    await openStudyTime({ guildId: 'g', user: { id: 'u' }, memberPermissions: { has: () => false },
        options: { getString: name => name === 'view' ? 'resource' : null },
        deferReply: async () => {}, editReply: async p => { message = p; }, client: {} });
    assert.match(message.content, /Manage Server/);
});

test('disconnected gateways pause voice checkpoints instead of trusting stale voice caches', async () => {
    const d = database(); d.client.isReady = () => false;
    d.client.guilds = { cache: new Map([['g', { id: 'g', voiceStates: { cache: new Map([['u', voice('g', 'u', 'a')]]) } }]]) };
    try {
        await startStudyTime(d.client);
        assert.equal(d.client.studyTimeVoicePaused, true);
        await trackVoiceState(voice('g', 'u', null), voice('g', 'u', 'a'), d.client, now);
        assert.equal(d.read(profileKey('g', 'u')), undefined);
    } finally { d.client.emit('invalidated'); }
});


test('monthly level card uses previous calendar month, tier rank and hours to promotion', () => {
    const record = newRecord();
    addCredit(record, 'voice', 65.75 * 3600000, now);
    addCredit(record, 'test', 145 * 3600000, Date.parse('2026-10-15T12:00:00Z'));
    const data = monthlyLevelMessage(record, 'u', now).embeds[0].toJSON();
    assert.equal(data.title, '☕ Monthly Level Statistics (November 2026)');
    const panel = data.fields[0].value;
    assert.ok(panel.startsWith('```ansi\n'));
    for (const text of ['Current monthly level', 'Last monthly level', 'Level rank', 'Level promotion in', 'Master (60–80h)', 'Study Sage (140–200h)', '8/11', '14.3 hours until Grandmaster']) assert.ok(panel.includes(text));
    assert.ok(panel.includes('\u001b[1;34m'));
    assert.ok(panel.includes('\u001b[1;33m'));
    assert.equal(data.color, undefined);
});
test('monthly history handles January rollover, missing history and highest level', () => {
    const at = Date.parse('2027-01-01T05:00:00Z'), record = newRecord();
    addCredit(record, 'voice', 200 * 3600000, at);
    addCredit(record, 'voice', 20 * 3600000, Date.parse('2026-12-31T23:00:00Z'));
    const fields = monthlyLevelMessage(record, 'u', at).embeds[0].data.fields;
    assert.ok(fields[0].value.includes('Exam Expert (20–40h)'));
    assert.match(fields[0].value, /Highest level reached/);
    const empty = monthlyLevelMessage(undefined, 'u', at).embeds[0].data.fields;
    assert.match(empty[0].value, /No study time recorded last month/);
    assert.ok(empty[0].value.includes('1.0 hours until Budding Bookworm'));
});
test('/stats exposes me and bot, and me rejects direct messages before loading storage', async () => {
    const command = (await import('../src/commands/Core/stats.js')).default;
    assert.deepEqual(command.data.toJSON().options.map(o => o.name), ['me', 'bot']);
    let response;
    await command.execute({ options: { getSubcommand: () => 'me' }, deferReply: async () => {}, editReply: async value => { response = value; } });
    assert.match(response.content, /inside a server/);
});
test('/stats me loads the invoking member from persistent server records', async () => {
    const { client } = database();
    await creditActivity(client, 'g', 'u', 'test', 'stats-question', now);
    let response;
    await openMonthlyLevel({ client, guildId: 'g', user: { id: 'u', username: 'Student' }, deferReply: async () => {}, editReply: async value => { response = value; } });
    assert.equal(response.embeds[0].data.author.name, 'Student');
    assert.equal(response.embeds[0].data.description, '<@u>');
    assert.equal(response.embeds[0].data.fields.length, 1);
});
