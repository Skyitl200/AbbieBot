import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQuestionBanks, selectQuestions, gradeQuestion } from '../src/services/study/questions.js';
import { buildLectureChoiceContext, prepareLectureChoice } from '../src/services/study/lectureChoices.js';
import { createStudySession } from '../src/services/study/sessions.js';
import { questionMessage } from '../src/services/study/interface.js';

let loaded;
const fixture = () => loaded ||= loadQuestionBanks().then(banks => ({ banks, contexts: buildLectureChoiceContext(banks) }));

test('all 9,495 lecture MC items prepare four or five distinct source-grounded choices without changing the banks', async () => {
    const { banks, contexts } = await fixture();
    const snapshot = JSON.stringify([...banks]);
    const allById = new Map([...banks.values()].flat().map(q => [q.id, q]));
    let checked = 0;
    for (const [topicId, questions] of banks) {
        const byId = new Map(questions.map(q => [q.id, q]));
        for (const original of questions) {
            const prepared = prepareLectureChoice(original, contexts, topicId);
            if (original.type !== 'multiple_choice') { assert.equal(prepared, original); continue; }
            checked++;
            assert.ok([4, 5].includes(prepared.options.length), original.id);
            assert.equal(new Set(prepared.options).size, prepared.options.length, original.id);
            assert.equal(prepared.correct.length, 1);
            assert.ok(gradeQuestion(prepared, prepared.correct), original.id);
            for (let i = 0; i < prepared.options.length; i++) if (!prepared.correct.includes(i)) assert.ok(!gradeQuestion(prepared, [i]), original.id);
            assert.ok(prepared.options.every(o => o.length <= 400), original.id);
            const size = prepared.question.length + prepared.options.reduce((n, o) => n + o.length + 12, 0);
            assert.ok(size < 3900, original.id);
            assert.ok(!prepared.options.some(o => /^(?:all|none) of the above$/i.test(o)), original.id);
            const proof = prepared.lectureChoice;
            if (proof.strategy === 'related_checks') {
                const secondary = byId.get(proof.secondaryId);
                assert.ok(secondary && secondary.id !== original.id, original.id);
                assert.ok(!/\b(?:shown|figure|diagram|image|arrow|photograph)\b/i.test(secondary.question), original.id);
                assert.equal(original.source.file, secondary.source.file);
                assert.ok(prepared.question.includes(original.question));
                assert.ok(prepared.question.includes(secondary.question));
                assert.equal(proof.primaryAnswers[0], original.options[original.correct[0]]);
                assert.equal(proof.secondaryAnswers[0], secondary.options[secondary.correct[0]]);
                assert.ok(original.options.includes(proof.primaryAnswers[1]) && !original.correct.some(i => original.options[i] === proof.primaryAnswers[1]));
                assert.ok(secondary.options.includes(proof.secondaryAnswers[1]) && !secondary.correct.some(i => secondary.options[i] === proof.secondaryAnswers[1]));
                assert.deepEqual(proof.parts, [[0, 0], [0, 1], [1, 0], [1, 1]]);
                assert.deepEqual(prepared.options, proof.parts.map(([a, b]) => `${proof.primaryAnswers[a]} | ${proof.secondaryAnswers[b]}`));
            } else {
                assert.equal(proof.optionConcepts[0], proof.concept);
                assert.equal(new Set(proof.optionConcepts).size, prepared.options.length);
                for (const [i, id] of proof.sourceIds.entries()) {
                    const source = allById.get(id);
                    assert.ok(source, `${original.id}: missing source ${id}`);
                    if (proof.strategy === 'related_terms') {
                        assert.ok(source.options.some(option => option.toLowerCase() === proof.optionConcepts[i].toLowerCase()));
                        assert.equal(prepared.options[i], proof.optionConcepts[i]);
                    } else {
                        assert.equal(source.options[source.correct[0]], proof.optionConcepts[i]);
                        assert.ok(source.explanation.toLowerCase().includes(prepared.options[i].toLowerCase()), original.id);
                    }
                }
            }
        }
    }
    assert.equal(checked, 9495);
    assert.equal(JSON.stringify([...banks]), snapshot);
});

test('closely related terms replace unrelated distractors and keep accurate defining answers', async () => {
    const { banks, contexts } = await fixture();
    const nervous = banks.get('nervous_tissue').find(q => q.id === 'nervous_tissue-0001');
    const q = prepareLectureChoice(nervous, contexts, 'nervous_tissue');
    assert.equal(q.options[0], 'Central nervous system');
    assert.ok([4, 5].includes(q.options.length));
    assert.ok(q.options.includes('Peripheral nervous system'));
    assert.ok(!q.options.includes('All-or-none principle'));
    const chest = prepareLectureChoice(banks.get('circulatory').find(q => q.id === 'circulatory-0001'), contexts, 'circulatory');
    assert.deepEqual(chest.options, ['Mediastinum', 'Pericardial cavity', 'Pleural cavity', 'Abdominopelvic cavity']);
    const fact = banks.get('basic_chemistry').find(q => q.id === 'basic_chemistry-0002');
    const prepared = prepareLectureChoice(fact, contexts, 'basic_chemistry');
    assert.match(prepared.options[0], /mass and occupies space/);
    assert.ok(!prepared.options.includes('It must be visible to have mass'));
});

test('lecture selection applies the policy in topic and mixed practice and displays A through E consistently', async () => {
    const { banks, contexts } = await fixture();
    for (const topic of ['random', 'circulatory', 'anatomical_directions']) {
        const selected = selectQuestions(banks, topic, 50);
        assert.equal(selected.length, 50);
        assert.ok(selected.filter(q => q.type === 'multiple_choice').every(q => [4, 5].includes(q.options.length)));
    }
    let q;
    for (const [topic, questions] of banks) {
        q = questions.filter(item => item.type === 'multiple_choice').map(item => prepareLectureChoice(item, contexts, topic)).find(item => item.options.length === 5);
        if (q) break;
    }
    assert.ok(q, 'At least one source-backed five-choice question is available');
    const session = createStudySession('g', 'u', [q], 'nervous_tissue');
    session.displayOrder = [1, 2, 3, 4, 0];
    const payload = questionMessage(session);
    const buttons = payload.components.flatMap(row => row.toJSON().components).filter(component => component.custom_id?.includes(':choice:'));
    assert.deepEqual(buttons.map(b => b.label), ['A', 'B', 'C', 'D', 'E']);
    assert.ok(gradeQuestion(q, [Number(buttons[4].custom_id.split(':').at(-1))]));
    assert.ok(buttons.slice(0, 4).every(b => !gradeQuestion(q, [Number(b.custom_id.split(':').at(-1))])));
    const description = payload.embeds[0].toJSON().description;
    for (const [i, value] of session.displayOrder.entries()) {
        assert.ok(description.includes(`**${String.fromCharCode(65 + i)}.** ${q.options[value]}`));
        assert.equal(Number(buttons[i].custom_id.split(':').at(-1)), value);
    }
});
