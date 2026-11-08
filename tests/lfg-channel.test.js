import test from 'node:test';
import assert from 'node:assert/strict';
import { lfgChannelAccess } from '../src/services/lfg/channelAccess.js';
import command from '../src/commands/LFG/lfg.js';
import { lfgSubjectSelectMenu, lfgProgramSelectMenu, lfgCapacitySelectMenu, pendingLfgDescriptions } from '../src/handlers/lfgSelectMenus.js';
import descriptionModal from '../src/interactions/modals/lfg/lfgDescription.js';

const fixture = (channelId = 'lfg-channel', channels = [{ id: 'lfg-channel', name: '🔎│lfg', type: 0 }]) => ({
    guildId: 'guild', channelId, inGuild: () => true,
    guild: { id: 'guild', channels: { cache: new Map(channels.map(c => [c.id, c])) } },
});

test('only the uniquely named LFG text channel is allowed, including decorated names', () => {
    assert.equal(lfgChannelAccess(fixture(), '').allowed, true);
    const wrong = lfgChannelAccess(fixture('general'), '');
    assert.equal(wrong.allowed, false);
    assert.match(wrong.message, /<#lfg-channel>/);
    assert.equal(lfgChannelAccess(fixture('lfg-channel', [{ id: 'lfg-channel', name: 'Looking-For-Group', type: 0 }]), '').allowed, true);
    assert.equal(lfgChannelAccess(fixture('thread'), '').allowed, false);
});

test('an explicit channel ID wins and ambiguous or absent channel names cannot bypass the restriction', () => {
    assert.equal(lfgChannelAccess(fixture('pinned'), 'pinned').allowed, true);
    assert.equal(lfgChannelAccess(fixture(), 'pinned').allowed, false);
    assert.equal(lfgChannelAccess(fixture('general', []), '').allowed, false);
    assert.equal(lfgChannelAccess(fixture('a', [{ id: 'a', name: 'lfg', type: 0 }, { id: 'b', name: 'lfg', type: 0 }]), '').allowed, false);
    assert.equal(lfgChannelAccess(fixture('voice', [{ id: 'voice', name: 'lfg', type: 2 }]), '').allowed, false);
    assert.equal(lfgChannelAccess({ inGuild: () => false }, 'pinned').allowed, false);
});

test('wrong-channel /lfg is rejected before member checks or quota work for every member', async () => {
    let reply;
    const interaction = { ...fixture('general'), async reply(payload) { reply = payload; },
        get member() { assert.fail('Must reject before subscriber or quota handling'); } };
    await command.execute(interaction);
    assert.equal(reply.flags, 64);
    assert.match(reply.content, /<#lfg-channel>/);
});

test('allowed-channel subscribers can still open the normal LFG setup', async () => {
    let reply;
    await command.execute({ ...fixture(), member: { roles: { cache: { has: () => true } } }, user: { id: 'student' }, async reply(payload) { reply = payload; } });
    assert.equal(reply.components.length, 2);
    assert.match(reply.embeds[0].toJSON().title, /Looking For Group/);
});

test('old creation controls and modals cannot mutate setup or publish in another channel', async () => {
    pendingLfgDescriptions.set('student', { selectedSubject: 'anatomy_1', description: 'Existing setup' });
    for (const handler of [lfgSubjectSelectMenu, lfgProgramSelectMenu, lfgCapacitySelectMenu, descriptionModal]) {
        let denied;
        await handler.execute({ ...fixture('general'), user: { id: 'student' },
            async reply(payload) { denied = payload; },
            get values() { assert.fail('Must check channel before accessing creation data'); },
            get member() { assert.fail('Must not modify the study room'); },
            get fields() { assert.fail('Must not mutate description'); } }, null, ['student','anatomy_1']);
        assert.equal(denied.flags, 64);
        assert.match(denied.content, /<#lfg-channel>/);
        assert.equal(pendingLfgDescriptions.get('student').description, 'Existing setup');
    }
    pendingLfgDescriptions.delete('student');
});
