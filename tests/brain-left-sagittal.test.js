import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LAB_SETS, labQuestions, labModelImage, labModelsMessage, labModeMessage } from '../src/services/study/labModels.js';
import quiz from '../src/commands/Community/quiz.js';
import existingTest from '../src/commands/Community/test.js';
const manifest = JSON.parse(readFileSync(new URL('../study-data/lab-models/brain-left-sagittal.json', import.meta.url)));
const id = 'brain-left-sagittal';
test('left sagittal brain set contains all 26 requested structures under Nervous System', () => {
    const set = LAB_SETS.find(s => s.id === id);
    assert.equal(set.category, 'nervous');
    assert.equal(set.models.length, 26);
    assert.deepEqual(set.models.map(m => m.name), ['Parietal lobe', 'Frontal lobe', 'Corpus callosum', 'Septum pellucidum', 'Cingulate gyrus', 'Anterior commissure', 'Optic chiasma', 'Pituitary gland', 'Mammillary body', 'Hypothalamus', 'Pons', 'Midbrain', 'Medulla oblongata', 'Spinal cord', 'Cerebellum', 'Arbor vitae', 'Fourth ventricle', 'Cerebral aqueduct', 'Occipital lobe', 'Inferior colliculus', 'Superior colliculus', 'Pineal body (gland)', 'Thalamus', 'Intermediate mass', 'Choroid plexus', 'Fornix']);
    const options = labModelsMessage('u', 'nervous').components[0].toJSON().components[0].options;
    assert.ok(options.some(o => o.value === id && o.description.includes('1 original photo')));
    assert.ok(options.some(o => o.value === 'spinal-nerves'));
    assert.ok(labModeMessage('u', id).embeds[0].toJSON().description.includes('26 structures studied from one original photo'));
});
test('each identification card uses the unaltered source and supports multiple choice and typed synonyms', () => {
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions(id, mode);
        assert.equal(questions.length, 26);
        assert.equal(new Set(questions.map(q => q.id)).size, 26);
        for (const question of questions) {
            const photo = labModelImage(question);
            assert.ok(photo);
            const bytes = readFileSync(photo.path);
            assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sourceImageSha256);
            assert.ok(question.requiresModelImage);
            assert.ok(question.question.length > 30);
            if (mode === 'multiple_choice') {
                assert.equal(question.options.length, 4);
                assert.equal(new Set(question.options).size, 4);
                assert.equal(question.options[question.correct[0]], question.modelName);
            } else {
                assert.equal(question.type, 'fill_blank');
                assert.ok(question.answers.length >= 1);
                assert.equal(question.options, undefined);
            }
        }
    }
});
test('/quiz opens the same study flow and usage allowance without taking a global slot', () => {
    assert.equal(quiz.data.toJSON().name, 'quiz');
    assert.equal(quiz.execute, existingTest.execute);
    assert.equal(quiz.guildOnly, true);
    assert.equal(quiz.data.toJSON().dm_permission, false);
});
