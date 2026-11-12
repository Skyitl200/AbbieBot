import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQuestionBanks } from '../src/services/study/questions.js';
import { imageForQuestion, lecturePreview } from '../src/services/study/images.js';
import { questionMessage, resultMessage } from '../src/services/study/interface.js';
import { createStudySession } from '../src/services/study/sessions.js';
import { validateStudyImages } from '../scripts/validateStudyImages.js';

test('every authored question has a shipped, hash-verified lecture figure and valid source slide', async () => {
    const report = await validateStudyImages();
    assert.equal(report.questions, [...(await loadQuestionBanks()).values()].flat().length);
    assert.ok(report.images > 100);
});
test('questions automatically attach figures, as do explanations', async () => {
    const question = [...(await loadQuestionBanks()).values()].flat()[0];
    const session = createStudySession('image-guild', 'image-user', [question], 'random');
    const before = questionMessage(session);
    assert.ok(before.embeds[0].toJSON().image.url.startsWith('attachment://'));
    assert.ok(!before.components.some(row => row.toJSON().components.some(c => c.custom_id?.includes('study:image:'))));
    const image = imageForQuestion(question);
    const preview = lecturePreview(question);
    assert.equal(preview.embeds[0].toJSON().image.url, `attachment://${image.asset.file}`);
    assert.equal(preview.files[0].attachment, image.path);
    assert.deepEqual(preview.attachments, []);
    session.reward = { status: 'saved', amount: 10, balance: 1234 };
    const result = resultMessage(session, true);
    assert.equal(result.files.length, 1);
    assert.match(result.embeds[0].toJSON().description, /1,234 Merit Coins/);
    assert.equal(session.score, 0);
    assert.equal(session.revision, 0);
    assert.equal(imageForQuestion({ id: 'legacy-unmapped-question' }), null);
});

test('figure previews are private, enforce session ownership, and never award coins', async () => {
    const { handleStudyInteraction } = await import('../src/services/study/interface.js');
    const question = [...(await loadQuestionBanks()).values()].flat()[0];
    const session = createStudySession('preview-guild', 'preview-user', [question], 'random');
    const calls = [];
    const interaction = { user: { id: session.userId }, guildId: session.guildId,
        async deferReply(payload) { calls.push(['defer', payload]); this.deferred = true; },
        async editReply(payload) { calls.push(['edit', payload]); },
        async reply(payload) { calls.push(['reply', payload]); },
    };
    const args = ['image', session.userId, session.id, '0', String(session.revision)];
    await handleStudyInteraction(interaction, {}, args);
    assert.equal(calls[0][1].flags, 64);
    assert.equal(calls[1][1].files.length, 1);
    assert.equal(session.score, 0);
    assert.equal(session.answered, false);
    assert.equal(session.revision, 0);
    calls.length = 0;
    interaction.deferred = false;
    interaction.user.id = 'another-student';
    await handleStudyInteraction(interaction, {}, args);
    assert.match(calls[0][1].content, /another student/);
    assert.equal(calls[0][1].files, undefined);
});

test('returning to classes clears the previous lecture attachment', async () => {
    const { handleStudyInteraction } = await import('../src/services/study/interface.js');
    let payload;
    await handleStudyInteraction({ user: { id: 'student' }, async deferUpdate() {}, async editReply(p) { payload = p; } }, {}, ['classes', 'student']);
    assert.deepEqual(payload.attachments, []);
    assert.deepEqual(payload.files, []);
});

test('question images display without lecture reference text', async () => {
    const banks = await loadQuestionBanks();
    const question = [...banks.values()].flat().find(q => imageForQuestion(q));
    const session = createStudySession('reference-guild', 'reference-user', [question], 'random');
    for (const payload of [questionMessage(session), resultMessage(session, true)]) {
        const embed = payload.embeds[0].toJSON();
        assert.ok(embed.image.url.startsWith('attachment://'));
        assert.ok(!(embed.fields || []).some(field => /lecture reference|cited slide|RVCC/i.test(field.name + field.value)));
    }
});

test('paired lecture checks show one primary image without visible credits', async () => {
    const questions = [...(await loadQuestionBanks()).values()].flat();
    const primary = questions[0];
    const first = imageForQuestion(primary);
    const secondary = questions.find(q => imageForQuestion(q)?.asset.file !== first.asset.file);
    const paired = { ...primary, lectureChoice: { strategy: 'related_checks', secondaryId: secondary.id } };
    const session = createStudySession('paired-images', 'paired-user', [paired], 'random');
    for (const payload of [questionMessage(session), resultMessage(session, true)]) {
        assert.equal(payload.files.length, 1);
        assert.equal(payload.embeds.length, 1);
        assert.equal(payload.embeds[0].toJSON().image.url, `attachment://${first.asset.file}`);
        assert.ok(!(payload.embeds[0].toJSON().fields || []).some(field => /credit|OpenStax|CC BY/i.test(field.name + field.value)));
        assert.deepEqual(payload.attachments, []);
    }
    paired.lectureChoice.secondaryId = primary.id;
    assert.equal(lecturePreview(paired).files.length, 1, 'identical references attach only once');
});

test('specific lecture concepts receive their corresponding textbook illustrations', () => {
    const examples = [
        ['circulatory-0001', 'Position of the Heart in the Thorax'],
        ['joints-0031', 'Cartilaginous Joints'],
        ['skeletal-0476', 'Anatomy of a Long Bone'],
        ['nervous_tissue-0231', 'Receptor Types'],
        ['muscular-0338', 'Relaxation of a Muscle Fiber'],
    ];
    for (const [id, title] of examples) {
        const figure = imageForQuestion({ id });
        assert.equal(figure.asset.title, title, id);
        assert.equal(figure.source.kind, 'open-textbook');
        assert.equal(figure.asset.license, 'https://creativecommons.org/licenses/by/4.0/');
    }
});
