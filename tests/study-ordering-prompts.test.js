import test from 'node:test';
import assert from 'node:assert/strict';
import { displayedQuestionPrompt } from '../src/services/study/prompts.js';
import { loadQuestionBanks, gradeQuestion } from '../src/services/study/questions.js';
import { createStudySession } from '../src/services/study/sessions.js';
import { questionMessage } from '../src/services/study/interface.js';

const ordered = (question, first = 'Cornea') => ({ id: 'ordering-hint-test', type: 'ordering', question, options: [first, 'Middle', 'End'], correct: [0,1,2], explanation: 'The sequence follows normal forward flow.', difficulty: 'medium' });

test('ordering prompts omit explicit first-entry hints while preserving the task and direction', () => {
    const cases = [
        ['Put these stages in forward order. Start with cornea.', 'Put these stages in forward order.'],
        ['Order these selected stages, starting with cornea.', 'Order these selected stages.'],
        ['Order these selected stages, beginning with cornea.', 'Order these selected stages.'],
        ['Arrange the efferent pathway, beginning at the CNS and ending at the target organ.', 'Arrange the efferent pathway.'],
        ['Order the incoming-light route from cornea toward the retina, beginning with cornea.', 'Order the incoming-light route toward the retina.'],
    ];
    for (const [before, after] of cases) assert.equal(displayedQuestionPrompt(ordered(before)), after);
    const escaped = ordered('Order from G1 (interphase) toward division.', 'G1 (interphase)');
    assert.equal(displayedQuestionPrompt(escaped), 'Order toward division.');
});

test('meaningful direction, event boundaries, non-ordering prompts, and explanations are retained', () => {
    for (const text of ['Order these layers from deep to superficial.', 'Arrange these volumes from smallest to largest.', 'Arrange the cytotoxic sequence, beginning after recognition.']) {
        assert.equal(displayedQuestionPrompt(ordered(text)), text);
    }
    const mc = { ...ordered('Which stage begins with cornea?'), type: 'multiple_choice' };
    assert.equal(displayedQuestionPrompt(mc), mc.question);
});

test('all 1,296 lecture ordering cards remove start hints without changing answers or source records', async () => {
    const questions = [...(await loadQuestionBanks()).values()].flat().filter(q => q.type === 'ordering');
    assert.equal(questions.length, 1296);
    let changed = 0;
    for (const q of questions) {
        const original = JSON.stringify(q);
        const shown = displayedQuestionPrompt(q);
        assert.doesNotMatch(shown, /\.\s*Start\s+(?:with|at)\b|,\s*(?:starting|beginning)\s+(?:with|at)\b/i, q.id);
        assert.ok(shown.length > 20, q.id);
        assert.equal(gradeQuestion(q, [...q.correct]), true, q.id);
        assert.equal(JSON.stringify(q), original, q.id);
        if (shown !== q.question) changed++;
    }
    assert.ok(changed > 1100);
    const q = questions.find(q => /Start with/.test(q.question));
    const session = createStudySession('ordering-no-hint', 'ordering-user', [q], 'random');
    const rendered = questionMessage(session).embeds[0].toJSON().description;
    assert.ok(rendered.startsWith(displayedQuestionPrompt(q)));
    assert.doesNotMatch(rendered, /Start with/i);
});
