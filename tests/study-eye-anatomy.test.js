import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAB_SETS, labModelsMessage, labModeMessage, labQuestions, labModelImage } from '../src/services/study/labModels.js';
import { gradeQuestion } from '../src/services/study/questions.js';

const data = JSON.parse(readFileSync(new URL('../study-data/lab-models/eye-anatomy.json', import.meta.url), 'utf8'));
const roster = ['Lens', 'Ciliary body', 'Ora serrata', 'Cornea', 'Retina', 'Choroid', 'Sclera', 'Optic nerve', 'Optic disc (blind spot)', 'Central artery and vein of the retina', 'Posterior cavity', 'Pupil', 'Iris', 'Sclera', 'Posterior cavity', 'Macula lutea', 'Fovea centralis', 'Cornea'];
const playable = data.models.filter(model => model.verificationStatus !== 'pending');

test('eye anatomy keeps the requested 18-view roster and registers verified cards under Special Senses', () => {
    assert.deepEqual(data.models.map(model => model.name), roster);
    assert.equal(new Set(roster).size, 15);
    assert.equal(new Set(data.models.map(model => model.id)).size, 18);
    const set = LAB_SETS.find(set => set.id === 'eye-anatomy');
    assert.equal(set.category, 'special-senses');
    assert.equal(set.title, '3D Model of Eye Anatomy');
    assert.deepEqual(set.models.map(model => model.id), playable.map(model => model.id));
    assert.ok(playable.length >= 16);
    assert.deepEqual(set.pendingStructures, data.models.filter(model => model.verificationStatus === 'pending').map(model => model.name));
    assert.match(data.source, /user-provided/i);
    assert.match(data.source, /crop/i);
    const menu = labModelsMessage('owner', 'special-senses').components[0].toJSON().components[0];
    assert.ok(menu.options.some(option => option.value === 'eye-anatomy'));
    const modes = labModeMessage('owner', 'eye-anatomy').components[0].toJSON().components[0].options;
    assert.deepEqual(modes.map(option => option.value), ['multiple_choice', 'typed']);
    for (const model of data.models.filter(model => model.verificationStatus === 'pending')) {
        assert.match(model.verificationReason, /labeled/i);
        assert.match(labModeMessage('owner', 'eye-anatomy').embeds[0].toJSON().description, new RegExp(model.name));
        assert.equal(set.models.some(active => active.id === model.id), false);
        assert.equal(labModelImage({ labModelId: model.id }), null);
    }
});

test('eye anatomy supports distinct multiple-choice and typed modes without answer leaks', () => {
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('eye-anatomy', mode);
        assert.equal(questions.length, playable.length);
        assert.equal(new Set(questions.map(question => question.id)).size, playable.length);
        for (const question of questions) {
            const model = playable.find(model => model.id === question.labModelId);
            assert.ok(model);
            assert.equal(question.requiresModelImage, true);
            assert.equal(question.question, 'What structure is indicated by the marker?');
            assert.match(model.expectedImageFile, /^eye-anatomy\/eye-\d{2}\.png$/);
            if (mode === 'multiple_choice') {
                assert.equal(question.options.length, 4);
                assert.equal(new Set(question.options).size, 4);
                assert.equal(question.options[question.correct[0]], model.name);
                assert.equal(gradeQuestion(question, question.correct), true);
            } else {
                assert.equal(question.type, 'fill_blank');
                assert.equal(question.options, undefined);
                for (const answer of model.questions[0].typedAnswers) assert.equal(gradeQuestion(question, answer), true, `${model.id}: ${answer}`);
                for (const other of playable.filter(other => other.name !== model.name)) {
                    for (const answer of other.questions[0].typedAnswers) assert.equal(gradeQuestion(question, answer), false, `${model.name} must reject ${answer}`);
                }
            }
        }
    }
});

test('eye aliases distinguish retinal layers, front structures, optic nerve and the paired retinal vessels', () => {
    const questions = labQuestions('eye-anatomy', 'typed');
    const vessels = questions.find(question => question.modelName === 'Central artery and vein of the retina');
    for (const answer of ['central retinal vessels', 'central retinal artery and vein']) assert.equal(gradeQuestion(vessels, answer), true);
    for (const answer of ['central retinal artery', 'central retinal vein', 'optic nerve', 'retina']) assert.equal(gradeQuestion(vessels, answer), false);
    for (const name of ['Sclera', 'Posterior cavity', 'Cornea']) {
        const views = questions.filter(question => question.modelName === name);
        assert.equal(views.length, 2);
        for (const view of views) for (const answer of views[0].answers) assert.equal(gradeQuestion(view, answer), true);
    }
    const disc = questions.find(question => question.modelName === 'Optic disc (blind spot)');
    assert.equal(gradeQuestion(disc, 'optic disk'), true);
    assert.equal(gradeQuestion(disc, 'blind spot'), true);
    assert.equal(gradeQuestion(disc, 'optic nerve'), false);
    for (const cavity of questions.filter(question => question.modelName === 'Posterior cavity')) {
        assert.equal(gradeQuestion(cavity, 'vitreous chamber'), true);
        assert.equal(gradeQuestion(cavity, 'posterior chamber'), false);
    }
});

test('playable eye cards resolve to distinct cropped PNG images with neutral filenames', () => {
    const images = new Set();
    for (const [index, model] of data.models.entries()) {
        assert.equal(model.expectedImageFile, `eye-anatomy/eye-${String(index + 1).padStart(2, '0')}.png`);
        if (model.verificationStatus === 'pending') continue;
        const image = labModelImage({ labModelId: model.id });
        assert.ok(image, model.expectedImageFile);
        const bytes = readFileSync(image.path);
        assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        assert.ok(bytes.readUInt32BE(16) <= 534, 'Each card must show one segment of the joined photograph');
        assert.ok(bytes.readUInt32BE(20) <= 440);
        images.add(image.path);
    }
    assert.equal(images.size, playable.length);
});
