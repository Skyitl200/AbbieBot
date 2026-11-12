import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudySession, skipStudyQuestion, nextStudyQuestion, submitStudyAnswer, checkStudyAction, chooseOrderItem } from '../src/services/study/sessions.js';
import { questionMessage, resultMessage, handleStudyInteraction } from '../src/services/study/interface.js';

const q = { id: 'skip-q', type: 'multiple_choice', question: 'Which structure?', options: ['One', 'Two', 'Three', 'Four'], correct: [0], explanation: 'One.', difficulty: 'easy' };
function fixture(questions = [q, { ...q, id: 'skip-q2' }]) {
    const session = createStudySession('skip-guild', `skip-user-${Math.random()}`, questions, 'random');
    const calls = [];
    const interaction = { guildId: session.guildId, user: { id: session.userId },
        async deferUpdate() { calls.push(['defer']); },
        async deferReply(p) { calls.push(['defer-private', p]); },
        async editReply(p) { calls.push(['edit', p]); },
        async followUp(p) { calls.push(['follow', p]); return { id: 'next-public' }; },
        async reply(p) { calls.push(['reply', p]); },
        webhook: { async editMessage(id, p) { calls.push(['public-edit', id, p]); } },
    };
    return { session, interaction, calls };
}

test('all question types offer Skip and Report with owner and revision tokens', () => {
    for (const question of [q, { ...q, type: 'fill_blank', answers: ['one'], options: undefined }, { ...q, type: 'ordering', correct: [0,1,2,3] }]) {
        const { session } = fixture([question]);
        const buttons = questionMessage(session).components.at(-1).toJSON().components;
        assert.deepEqual(buttons.map(b => b.label), ['Skip', 'Report']);
        assert.match(buttons[0].custom_id, new RegExp(`study:skip:${session.userId}:${session.id}:0:0`));
    }
});

test('skips do not score or reward, clear ordering on advance, and invalidate old controls', () => {
    const ordered = { ...q, type: 'ordering', correct: [0,1,2,3] };
    const { session } = fixture([ordered, q]);
    chooseOrderItem(session, 0);
    const revision = session.revision;
    skipStudyQuestion(session);
    assert.equal(session.score, 0);
    assert.equal(session.skipped, 1);
    assert.equal(session.moneyEarned, 0);
    assert.equal(session.reward, null);
    assert.throws(() => skipStudyQuestion(session), /already/);
    assert.throws(() => submitStudyAnswer(session, [0]), /already/);
    nextStudyQuestion(session);
    assert.deepEqual(session.order, []);
    assert.equal(session.index, 1);
    assert.throws(() => checkStudyAction(session, 0, revision), /expired/);
    submitStudyAnswer(session, [1]);
    const fields = resultMessage(session, false).embeds[0].toJSON().fields;
    assert.match(fields.find(f => f.name === 'Quiz Progress').value, /Incorrect: \*\*1\*\*\nSkipped: \*\*1/);
});

test('Skip advances immediately and duplicate or foreign clicks cannot skip again', async () => {
    const { session, interaction, calls } = fixture([q, q, q]);
    session.publicQuestionId = 'old-public';
    const args = ['skip', session.userId, session.id, '0', '0'];
    await handleStudyInteraction({ ...interaction, user: { id: 'spectator' } }, {}, args);
    assert.equal(session.index, 0);
    const noWallet = new Proxy({}, { get() { throw new Error('Skip must not touch a wallet'); } });
    await handleStudyInteraction(interaction, noWallet, args);
    assert.equal(session.index, 1);
    assert.equal(session.skipped, 1);
    assert.ok(calls.some(c => c[0] === 'public-edit' && c[1] === 'old-public' && c[2].components.length === 0));
    assert.ok(calls.some(c => c[0] === 'follow' && c[1].embeds[0].toJSON().title === 'Question 2 of 3'));
    await handleStudyInteraction(interaction, noWallet, args);
    assert.equal(session.index, 1);
    assert.equal(session.skipped, 1);
});

test('skipping the last question ends privately without revealing the answer or marking it incorrect', async () => {
    const { session, interaction, calls } = fixture([q]);
    session.publicQuestionId = 'last-public';
    await handleStudyInteraction(interaction, {}, ['skip', session.userId, session.id, '0', '0']);
    const summary = calls.find(c => c[0] === 'edit')[1];
    assert.equal(calls.find(c => c[0] === 'defer-private')[1].flags, 64);
    const embed = summary.embeds[0].toJSON();
    assert.match(embed.title, /Test Complete/);
    assert.match(embed.description, /Incorrect: \*\*0\*\*\nSkipped: \*\*1/);
    assert.equal(embed.fields, undefined);
    assert.equal(session.reward, null);
    assert.equal(session.score, 0);
});

test('skipped questions do not reduce the percentage for attempted questions', () => {
    const { session } = fixture();
    skipStudyQuestion(session);
    nextStudyQuestion(session);
    submitStudyAnswer(session, [0]);
    session.reward = { status: 'saved', amount: 10, balance: 10 };
    const completion = resultMessage(session, true).embeds[0].toJSON().fields.find(f => /Test Complete/.test(f.name));
    assert.match(completion.value, /1\/1 \(100%\)/);
});
