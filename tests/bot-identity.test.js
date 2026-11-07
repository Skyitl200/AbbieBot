import test from 'node:test';
import assert from 'node:assert/strict';
import { synchronizeBotIdentity } from '../src/services/botIdentity.js';
import { botConfig } from '../src/config/bot.js';

function fixture(username = 'AbbieBot', nicknames = ['AbbieBot', 'Abbie Bot', null, 'Custom name', 'StudyBot']) {
    const renamed = [], users = [];
    const guilds = nicknames.map((nickname, i) => ({ id: String(i), members: { me: { nickname, async setNickname(value) { renamed.push([i, value]); } } } }));
    return { renamed, users, client: { user: { username, async setUsername(value) { users.push(value); this.username = value; } }, guilds: { cache: new Map(guilds.map(g => [g.id, g])) } } };
}

test('StudyBot updates account identity and old server nicknames, preserving custom names', async () => {
    const f = fixture();
    await synchronizeBotIdentity(f.client, botConfig.name);
    assert.deepEqual(f.users, ['StudyBot']);
    assert.deepEqual(f.renamed, [[0, 'StudyBot'], [1, 'StudyBot']]);
    assert.equal(botConfig.embeds?.footer?.text || botConfig.embed?.footer?.text, 'StudyBot');
});

test('an already renamed account does not repeat the rate-limited username write', async () => {
    const f = fixture('StudyBot', [null, 'StudyBot']);
    await synchronizeBotIdentity(f.client);
    assert.deepEqual(f.users, []);
    assert.deepEqual(f.renamed, []);
});

test('account and nickname failures do not prevent remaining identity updates', async () => {
    const f = fixture('AbbieBot', ['AbbieBot', 'Titan Bot']);
    f.client.user.setUsername = async () => { throw new Error('rate limited'); };
    f.client.guilds.cache.get('0').members.me.setNickname = async () => { throw new Error('missing permission'); };
    await synchronizeBotIdentity(f.client);
    assert.deepEqual(f.renamed, [[1, 'StudyBot']]);
});
