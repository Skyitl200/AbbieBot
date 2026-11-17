import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LAB_SETS, LAB_CATEGORIES, labCategoryMessage, labModelsMessage, labModeMessage, labQuestions, labModelImage } from '../src/services/study/labModels.js';
import { gradeQuestion } from '../src/services/study/questions.js';

const data = JSON.parse(readFileSync(new URL('../study-data/lab-models/sarcomere.json', import.meta.url), 'utf8'));
const roster = ['Z disc', 'Thick myofilament (containing myosin)', 'Thin myofilament (containing actin)', 'M line', 'I band (containing thin myofilament)', 'A band (containing thick myofilament)', 'H band (no overlap, just thick myofilament)', 'T tubule', 'Terminal cisternae', 'Triad'];

test('sarcomere adds the exact ten requested cards under Muscle', () => {
    assert.deepEqual(data.models.map(model => model.name), roster);
    assert.equal(new Set(data.models.map(model => model.id)).size, 10);
    const set = LAB_SETS.find(set => set.id === 'sarcomere');
    assert.equal(set.title, '3D Model of Sarcomere');
    assert.equal(set.category, 'muscular');
    assert.equal(set.models.length, 10);
    assert.equal(LAB_CATEGORIES.find(category => category.id === 'muscular').title, 'Muscle');
    const categories = labCategoryMessage('owner').components[0].toJSON().components[0].options;
    assert.ok(categories.some(option => option.value === 'muscular'));
    const sets = labModelsMessage('owner', 'muscular').components[0].toJSON().components[0].options;
    assert.ok(sets.some(option => option.value === 'sarcomere'));
    const modes = labModeMessage('owner', 'sarcomere').components[0].toJSON().components[0].options;
    assert.deepEqual(modes.map(option => option.value), ['multiple_choice', 'typed']);
    assert.match(data.source, /user-provided/i);
    assert.match(data.source, /reference worksheet/i);
});

test('sarcomere MC and typed questions preserve all ten identities and reject competing structures', () => {
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('sarcomere', mode);
        assert.equal(questions.length, 10);
        assert.equal(new Set(questions.map(question => question.id)).size, 10);
        for (const question of questions) {
            const model = data.models.find(model => model.id === question.labModelId);
            assert.ok(model);
            assert.equal(question.requiresModelImage, true);
            assert.ok(['What structure is indicated by the marker?', 'Which region is indicated by the bracket?', 'Which structure is indicated by the bracket?', 'Which group of structures is indicated by the bracket?'].includes(question.question));
            assert.match(model.expectedImageFile, /^sarcomere\/sarc-\d{2}\.jpg$/);
            if (mode === 'multiple_choice') {
                assert.equal(question.type, 'multiple_choice');
                assert.equal(question.options.length, 4);
                assert.equal(new Set(question.options).size, 4);
                assert.equal(question.options[question.correct[0]], model.name);
                assert.equal(gradeQuestion(question, question.correct), true);
            } else {
                assert.equal(question.type, 'fill_blank');
                assert.equal(question.options, undefined);
                for (const answer of model.questions[0].typedAnswers) assert.equal(gradeQuestion(question, answer), true, `${model.id}: ${answer}`);
                for (const other of data.models.filter(other => other.id !== model.id)) {
                    for (const answer of other.questions[0].typedAnswers) assert.equal(gradeQuestion(question, answer), false, `${model.name} must reject ${answer}`);
                }
            }
        }
    }
});

test('sarcomere aliases distinguish bands, filament types, Z and M lines, and triad components', () => {
    const typed = labQuestions('sarcomere', 'typed');
    const q = index => typed.find(question => question.labModelId === `sarcomere-${String(index).padStart(2, '0')}`);
    for (const answer of ['Z line', 'Z disk']) assert.equal(gradeQuestion(q(1), answer), true);
    assert.equal(gradeQuestion(q(1), 'M line'), false);
    assert.equal(gradeQuestion(q(2), 'myosin filament'), true);
    assert.equal(gradeQuestion(q(2), 'actin filament'), false);
    assert.equal(gradeQuestion(q(3), 'actin filament'), true);
    assert.equal(gradeQuestion(q(3), 'myosin filament'), false);
    assert.equal(gradeQuestion(q(7), 'H zone'), true);
    assert.equal(gradeQuestion(q(7), 'H band containing only thick myofilament'), true);
    const hBandChoice = labQuestions('sarcomere', 'multiple_choice').find(question => question.labModelId === 'sarcomere-07');
    assert.equal(hBandChoice.options[hBandChoice.correct[0]], 'H band (no overlap, just thick myofilament)');
    assert.equal(gradeQuestion(hBandChoice, hBandChoice.correct), true);
    for (const answer of ['A band', 'I band']) assert.equal(gradeQuestion(q(7), answer), false);
    assert.equal(gradeQuestion(q(8), 'transverse tubule'), true);
    assert.equal(gradeQuestion(q(9), 'terminal cisterna'), true);
    for (const answer of ['T tubule', 'terminal cisternae', 'dyad']) assert.equal(gradeQuestion(q(10), answer), false);
    assert.match(q(5).explanation, /thin filaments without overlapping thick/);
    assert.match(q(6).explanation, /full length.*including.*overlap/);
    assert.match(q(7).explanation, /thick filaments without overlapping thin/);
    assert.match(q(10).explanation, /one T tubule and two terminal cisternae/);
});

test('all ten sarcomere cards resolve to distinct shipped JPEGs with neutral filenames', () => {
    const hashes = new Set();
    for (const [index, model] of data.models.entries()) {
        assert.equal(model.expectedImageFile, `sarcomere/sarc-${String(index + 1).padStart(2, '0')}.jpg`);
        const image = labModelImage({ labModelId: model.id });
        assert.ok(image, model.expectedImageFile);
        const bytes = readFileSync(image.path);
        assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
        hashes.add(createHash('sha256').update(bytes).digest('hex'));
    }
    assert.equal(hashes.size, 10);
});
