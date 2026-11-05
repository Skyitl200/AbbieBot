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
