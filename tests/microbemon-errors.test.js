import test from 'node:test';
import assert from 'node:assert/strict';
import { openMicrobemon } from '../src/services/microbemon/controller.js';
import { newProfile } from '../src/services/microbemon/engine.js';
import { logger } from '../src/utils/logger.js';

function interaction(profile = newProfile()) {
    let writes = 0;
    const replies = [];
    return { replies, writes: () => writes, user: { id: 'owner', username: 'Student' }, guildId: 'guild',
        deferReply: async () => {}, editReply: async message => { replies.push(message); },
        client: { db: { pool: { connect: async () => ({ release() {}, query: async sql => {
            if (sql.startsWith('SELECT value')) return { rows: [{ value: profile }] };
            if (sql.includes('INSERT')) writes++;
            return { rows: [] };
        } }) } } } };
}

test('unavailable custom emoji retries the display without repeating the collection transaction', async () => {
    const i = interaction(); let attempts = 0;
    i.editReply = async message => {
        i.replies.push(message);
        if (++attempts === 1) throw Object.assign(new Error('Invalid emoji'), { code: 50035,
            rawError: { errors: { components: { 0: { components: { 0: { emoji: { _errors: [{ message: 'Invalid emoji' }] } } } } } } } });
    };
    await openMicrobemon(i);
    assert.equal(attempts, 2);
    assert.equal(i.writes(), 1);
    assert.ok(i.replies[1].embeds.length);
    for (const row of i.replies[1].components) for (const component of row.components) assert.ok(!component.emoji?.id);
});

test('display failures are distinguished from database failures and include details in one log message', async () => {
    const i = interaction(); const logs = []; const original = logger.warn;
    logger.warn = message => logs.push(message);
    try {
        let attempts = 0;
        i.editReply = async message => {
            i.replies.push(message);
            if (++attempts === 1) throw Object.assign(new Error('Attachment upload failed'), { code: 12345 });
        };
        await openMicrobemon(i);
        assert.match(i.replies.at(-1).content, /collection loaded.*could not be displayed/);
        assert.match(logs[0], /send Discord card.*12345.*Attachment upload failed/);
        assert.equal(attempts, 2, 'Other failures must not retry the original card');
    } finally { logger.warn = original; }
});

test('database failures never claim the saved collection loaded', async () => {
    const i = interaction();
    i.client.db.pool.connect = async () => { throw new Error('Connection unavailable'); };
    await openMicrobemon(i);
    assert.match(i.replies.at(-1).content, /could not load your saved collection/);
    assert.equal(i.writes(), 0);
});
