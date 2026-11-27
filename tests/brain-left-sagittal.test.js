import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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
    assert.ok(options.some(o => o.value === id && o.description.includes('26 images')));
    assert.ok(!options.some(o => o.value === 'spinal-nerves'));
    assert.ok(labModeMessage('u', id).embeds[0].toJSON().description.includes('all 26 photos studied together'));
});
test('each identification card has its own marked image and supports both answer modes', () => {
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions(id, mode);
        assert.equal(questions.length, 26);
        assert.equal(new Set(questions.map(q => q.id)).size, 26);
        for (const question of questions) {
            const photo = labModelImage(question);
            assert.ok(photo);
            const bytes = readFileSync(photo.path);
            const model = manifest.models.find(model => model.id === question.labModelId);
            assert.equal(createHash('sha256').update(bytes).digest('hex'), model.imageSha256);
            assert.notEqual(model.imageSha256, manifest.sourceImageSha256);
            assert.equal(question.question, model.questions[0].question);
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


test('all 26 cards preserve every original photo pixel outside the one pointer overlay', () => {
    assert.equal(new Set(manifest.models.map(m => m.expectedImageFile)).size, 26);
    const result = execFileSync('python', ['-c', `
from PIL import Image, ImageChops
from pathlib import Path
import json
root=Path.cwd();data=json.loads((root/'study-data/lab-models/brain-left-sagittal.json').read_text())
original=Image.open(root/'study-assets/lab-models'/data['sourceImageFile']).convert('RGB')
for model in data['models']:
 card=Image.open(root/'study-assets/lab-models'/model['expectedImageFile']).convert('RGB')
 assert card.size==original.size
 box=ImageChops.difference(original,card).getbbox();assert box
 limits=model['annotation']['overlayBounds']
 assert limits[0]<=box[0]<box[2]<=limits[2] and limits[1]<=box[1]<box[3]<=limits[3],model['name']
print('26 pixel-preserving overlays verified')
`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    assert.match(result, /26 pixel-preserving overlays verified/);
});


test('cerebellum highlights the full section while arbor vitae identifies multiple white branches', () => {
    const cerebellum = manifest.models.find(m => m.name === 'Cerebellum');
    const arbor = manifest.models.find(m => m.name === 'Arbor vitae');
    assert.equal(cerebellum.annotation.kind, 'whole-section-outline');
    assert.ok(cerebellum.annotation.outline.length > 10);
    assert.match(cerebellum.questions[0].question, /entire section/);
    assert.equal(arbor.annotation.kind, 'branching-network-markers');
    assert.equal(arbor.annotation.targets.length, 3);
    assert.match(arbor.questions[0].question, /branching network/);
    assert.notEqual(arbor.expectedImageFile, cerebellum.expectedImageFile);
});
