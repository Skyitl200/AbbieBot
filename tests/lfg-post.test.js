import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLfgPost, subjectThumbnail } from '../src/services/lfg/lfgPost.js';

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
    await handler.execute({
        customId: 'lfg_program:123456789012345678',
        user: { id: '123456789012345678' },
        values: ['radiologic_technologist'],
        showModal: async value => { modal = value.toJSON(); },
        reply: async () => { assert.fail('Valid program must open its form'); }
    });
    assert.ok(modal.title.length <= 45);
    assert.equal(modal.custom_id, 'lfg_description:123456789012345678:program:radiologic_technologist');
});
