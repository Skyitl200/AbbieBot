import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAB_SETS, labModelsMessage, labModeMessage, labQuestions, labModelImage } from '../src/services/study/labModels.js';
import { gradeQuestion } from '../src/services/study/questions.js';

const roster = ['Anterior semicircular canal', 'Lateral semicircular canal', 'Posterior semicircular canal', 'Utricle', 'Saccule', 'Vestibule', 'Cochlea', 'Ampulla', 'Vestibular nerve'];
const data = JSON.parse(readFileSync(new URL('../study-data/lab-models/inner-ear.json', import.meta.url), 'utf8'));

test('inner ear is available in the nervous-system lab with the exact nine requested structures', () => {
    const set = LAB_SETS.find(set => set.id === 'inner-ear');
    assert.equal(set.category, 'nervous');
    assert.equal(set.title, '3D Structure of the Inner Ear');
    assert.deepEqual(set.models.map(model => model.name), roster);
    assert.equal(data.sourceImageFile, 'inner-ear-original.jpg');
    assert.match(data.source, /user-provided/i);
    assert.match(data.source, /Quizlet/);
    const menu = labModelsMessage('owner', 'nervous');
    assert.ok(menu.components[0].toJSON().components[0].options.some(option => option.value === 'inner-ear'));
    const modes = labModeMessage('owner', 'inner-ear').components[0].toJSON().components[0].options;
    assert.deepEqual(modes.map(option => option.value), ['multiple_choice', 'typed']);
});

test('both inner-ear answer modes identify a marker without exposing the answer in prompts or filenames', () => {
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('inner-ear', mode);
        assert.equal(questions.length, 9);
        assert.equal(new Set(questions.map(q => q.id)).size, 9);
        for (const question of questions) {
            const model = data.models.find(model => model.id === question.labModelId);
            assert.ok(model);
            assert.equal(question.requiresModelImage, true);
            assert.equal(question.question, 'What structure is indicated by the marker?');
            assert.match(model.expectedImageFile, /^inner-ear\/ie-0[1-9]\.png$/);
            if (mode === 'multiple_choice') {
                assert.equal(question.type, 'multiple_choice');
                assert.equal(question.options.length, 4);
                assert.equal(new Set(question.options).size, 4);
                assert.equal(question.options[question.correct[0]], model.name);
                assert.equal(gradeQuestion(question, question.correct), true);
            } else {
                assert.equal(question.type, 'fill_blank');
                assert.equal(question.options, undefined);
                for (const answer of model.questions[0].typedAnswers) assert.equal(gradeQuestion(question, answer), true, answer);
                for (const other of roster.filter(name => name !== model.name)) assert.equal(gradeQuestion(question, other), false, `${model.name} must reject ${other}`);
            }
        }
    }
    const typed = labQuestions('inner-ear', 'typed');
    assert.equal(gradeQuestion(typed.find(q => q.modelName === roster[0]), 'superior semicircular canal'), true);
    assert.equal(gradeQuestion(typed.find(q => q.modelName === roster[1]), 'horizontal semicircular canal'), true);
    assert.equal(gradeQuestion(typed.find(q => q.modelName === roster[2]), 'inferior semicircular canal'), false);
    assert.equal(gradeQuestion(typed.find(q => q.modelName === 'Vestibular nerve'), 'cochlear nerve'), false);
});

test('all inner-ear questions resolve to their own shipped neutral image filenames', () => {
    for (const [index, model] of data.models.entries()) {
        assert.equal(model.expectedImageFile, `inner-ear/ie-${String(index + 1).padStart(2, '0')}.png`);
        const image = labModelImage({ labModelId: model.id });
        assert.ok(image, model.expectedImageFile);
        const bytes = readFileSync(image.path);
        assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    }
});
