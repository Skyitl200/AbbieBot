import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLfgPost, subjectThumbnail } from '../src/services/lfg/lfgPost.js';
import { LFG_CHANNEL_ID } from '../src/services/lfg/channelAccess.js';

const lfgContext = () => ({ guildId: 'guild', channelId: LFG_CHANNEL_ID, guild: { id: 'guild' } });

test('LFG card includes subject art and a voice-invite link in one message', () => {
    const post = buildLfgPost({
        hostName: 'Student', hostAvatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
        subject: { label: 'Anatomy & Physiology II', emoji: '<:AP2:1557576103256784896>' },
        description: 'Review the heart @everyone', capacity: 4,
        channel: { id: '123456789012345678' }, inviteUrl: 'https://discord.gg/study'
    });
    const embed = post.embeds[0].toJSON();
    const button = post.components[0].toJSON().components[0];
    assert.equal(button.style, 5);
    assert.equal(button.url, 'https://discord.gg/study');
    assert.equal(button.label, 'Join Study Room');
    assert.equal(post.content, undefined);
    assert.equal(post.files, undefined);
    assert.deepEqual(post.allowedMentions, { parse: [] });
    assert.match(embed.thumbnail.url, /1557576103256784896/);
    assert.equal(embed.fields[0].value, '<#123456789012345678>');
    assert.match(embed.fields[1].value, /4/);
    assert.match(embed.author.name, /Student/);
});

test('subjects and programs get distinct thumbnails without missing local files', () => {
    assert.match(subjectThumbnail('🩺'), /1fa7a.png$/);
    assert.match(subjectThumbnail('🧑‍⚕️'), /1f9d1-200d-2695.png$/);
    assert.notEqual(subjectThumbnail('🦷'), subjectThumbnail('🩺'));
    assert.match(subjectThumbnail('<a:Study:123456789012345678>'), /\.gif\?size=256$/);
});

test('LFG offers seven subjects and all nine programs in separate valid dropdowns', async () => {
    const { buildLfgMenus, SUBJECTS, PROGRAMS } = await import('../src/services/lfg/lfgCatalog.js');
    const rows = buildLfgMenus('123456789012345678').map(row => row.toJSON());
    assert.equal(rows.length, 2);
    const subjects = rows[0].components[0];
    const programs = rows[1].components[0];
    assert.equal(subjects.custom_id, 'lfg_subject');
    assert.equal(programs.custom_id, 'lfg_program:123456789012345678');
    assert.equal(subjects.options.length, 7);
    assert.equal(programs.options.length, 9);
    assert.deepEqual(subjects.options.map(option => option.value).sort(),
        ['anatomy_1', 'anatomy_2', 'microbiology', 'chemistry', 'physics', 'math', 'teas'].sort());
    assert.equal(PROGRAMS.nursing.label, 'Nursing School (RN)');
    assert.equal(PROGRAMS.radiologic_technologist.label, 'X-Ray Technician School (Radiologic Technology)');
    assert.equal(PROGRAMS.physical_therapy_assistant.label, 'Physical Therapy Assistant School (PTA)');
    for (const choice of [...subjects.options, ...programs.options]) {
        const entry = SUBJECTS[choice.value] || PROGRAMS[choice.value];
        assert.equal(entry.image, `${choice.value}.png`);
        assert.ok(choice.label.length <= 100);
    }
});

test('program selection is registered and supports the longest requested name', async () => {
    const { default: handler } = await import('../src/interactions/selectMenus/lfg/lfgProgram.js');
    assert.equal(handler.name, 'lfg_program');
    let modal;
    await handler.execute({ ...lfgContext(),
        customId: 'lfg_program:123456789012345678',
        user: { id: '123456789012345678' },
        values: ['radiologic_technologist'],
        showModal: async value => { modal = value.toJSON(); },
        reply: async () => { assert.fail('Valid program must open its form'); }
    });
    assert.ok(modal.title.length <= 45);
    assert.equal(modal.custom_id, 'lfg_description:123456789012345678:program:radiologic_technologist');
});

test('uploaded artwork is attached to the correct subject and program cards', async () => {
    const { SUBJECTS, PROGRAMS } = await import('../src/services/lfg/lfgCatalog.js');
    const { readFileSync } = await import('node:fs');
    const entries = [...Object.entries(SUBJECTS), ...Object.entries(PROGRAMS)]
        .filter(([key]) => !['program', 'teas'].includes(key));
    assert.equal(entries.length, 15);
    for (const [key, subject] of entries) {
        const post = buildLfgPost({ hostName: 'Student', subject, description: 'Study together',
            capacity: 4, channel: { id: '123456789012345678' }, inviteUrl: 'https://discord.gg/study' });
        assert.equal(post.files.length, 1, key);
        assert.equal(post.files[0].name, subject.image);
        assert.equal(post.embeds[0].toJSON().thumbnail.url, `attachment://${subject.image}`);
        assert.deepEqual([...readFileSync(post.files[0].attachment).subarray(0, 8)],
            [137, 80, 78, 71, 13, 10, 26, 10]);
        assert.equal(post.components[0].toJSON().components[0].url, 'https://discord.gg/study');
    }
    const teas = buildLfgPost({ hostName: 'Student', subject: SUBJECTS.teas, description: 'Practice',
        capacity: 2, channel: { id: '123456789012345678' }, inviteUrl: 'https://discord.gg/study' });
    assert.equal(teas.files, undefined);
    assert.match(teas.embeds[0].toJSON().thumbnail.url, /1557576611115565076/);
});

test('description replaces the original private menu instead of adding a reply', async () => {
    const { default: modal } = await import('../src/interactions/modals/lfg/lfgDescription.js');
    const { pendingLfgDescriptions } = await import('../src/handlers/lfgSelectMenus.js');
    let prompt;
    await modal.execute({ ...lfgContext(),
        user: { id: 'cleanup-student' },
        fields: { getTextInputValue: () => 'Review anatomy' },
        isFromMessage: () => true,
        update: async payload => { prompt = payload; },
        reply: async () => assert.fail('Should reuse the existing message')
    }, null, ['cleanup-student', 'anatomy_1']);
    assert.deepEqual(prompt.embeds, []);
    assert.equal(prompt.components.length, 1);
    pendingLfgDescriptions.delete('cleanup-student');
});

test('successful LFG removes private setup only after publishing the public card', async () => {
    const { lfgCapacitySelectMenu, pendingLfgDescriptions } = await import('../src/handlers/lfgSelectMenus.js');
    const { unregisterLfgChannel } = await import('../src/services/lfg/lfgService.js');
    const calls = [];
    const room = { id: 'cleanup-room', name: 'Study Room', guild: { id: 'guild' },
        setUserLimit: async () => {}, permissionOverwrites: { edit: async () => {} },
        createInvite: async () => ({ url: 'https://discord.gg/study' }) };
    pendingLfgDescriptions.set('cleanup-student', { selectedSubject: 'anatomy_1', description: 'Review anatomy' });
    await lfgCapacitySelectMenu.execute({ ...lfgContext(),
        customId: 'lfg_capacity:cleanup-student', values: ['4'],
        user: { id: 'cleanup-student', tag: 'Student', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' },
        member: { displayName: 'Student', voice: { channel: room } },
        channel: { send: async payload => { assert.equal(payload.components.length, 1); calls.push('post'); } },
        update: async payload => { assert.deepEqual(payload.components, []); calls.push('acknowledge'); },
        deleteReply: async () => calls.push('dismiss'),
        reply: async () => assert.fail('Success must not create another reply')
    });
    assert.deepEqual(calls, ['post', 'acknowledge', 'dismiss']);
    assert.equal(pendingLfgDescriptions.has('cleanup-student'), false);
    unregisterLfgChannel(room.id);
});
