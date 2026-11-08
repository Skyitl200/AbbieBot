import test from 'node:test';
import assert from 'node:assert/strict';
import { lfgChannelAccess, LFG_CHANNEL_ONLY_MESSAGE, LFG_CHANNEL_ID } from '../src/services/lfg/channelAccess.js';
import command from '../src/commands/LFG/lfg.js';
import { lfgSubjectSelectMenu, lfgProgramSelectMenu, lfgCapacitySelectMenu, pendingLfgDescriptions } from '../src/handlers/lfgSelectMenus.js';
import descriptionModal from '../src/interactions/modals/lfg/lfgDescription.js';

const fixture = (channelId = LFG_CHANNEL_ID) => ({ guildId: 'guild', channelId, inGuild: () => true, guild: { id: 'guild' } });

test('only the exact user-provided LFG channel ID is accepted, without relying on names or server cache', () => {
    assert.equal(lfgChannelAccess(fixture()).allowed, true);
    assert.equal(lfgChannelAccess({ ...fixture(), channel: { name: 'anything' } }).allowed, true);
    assert.equal(lfgChannelAccess({ ...fixture('other-channel'), channel: { name: 'LFG' } }).allowed, false);
    assert.equal(lfgChannelAccess({ guildId: 'guild', channel: { id: LFG_CHANNEL_ID } }).allowed, true);
    assert.equal(lfgChannelAccess({ inGuild: () => false, channelId: LFG_CHANNEL_ID }).allowed, false);
    assert.equal(lfgChannelAccess(fixture('thread-in-lfg')).allowed, false);
    assert.equal(lfgChannelAccess(fixture('general')).message, LFG_CHANNEL_ONLY_MESSAGE);
});

test('wrong-channel /lfg is rejected before member checks or quota work for every member', async () => {
    let reply;
    const interaction = { ...fixture('general'), async reply(payload) { reply = payload; },
        get member() { assert.fail('Must reject before subscriber or quota handling'); } };
    await command.execute(interaction);
    assert.equal(reply.flags, 64);
    assert.equal(reply.content, LFG_CHANNEL_ONLY_MESSAGE);
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
        assert.equal(denied.content, LFG_CHANNEL_ONLY_MESSAGE);
        assert.equal(pendingLfgDescriptions.get('student').description, 'Existing setup');
    }
    pendingLfgDescriptions.delete('student');
});
