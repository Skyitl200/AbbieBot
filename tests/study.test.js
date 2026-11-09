import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gradeQuestion, validateQuestion, loadQuestionBanks, selectQuestions } from '../src/services/study/questions.js';
import { STUDY_TOPICS } from '../src/services/study/topics.js';
import {
    createStudySession, getStudySession, checkStudyAction, submitStudyAnswer,
    nextStudyQuestion, chooseOrderItem, undoOrderItem,
} from '../src/services/study/sessions.js';
import { classMessage, classCategoriesMessage, countMessage, topicMessage, questionMessage, resultMessage, handleStudyInteraction } from '../src/services/study/interface.js';

import { STUDY_CLASSES, categoryToken, loadClassCategories, loadClassQuestions } from '../src/services/study/catalog.js';
import { settleStudyReward } from '../src/services/study/rewards.js';

const topic = STUDY_TOPICS[10];
const base = { id: 'ans-001', difficulty: 'easy', question: 'Which division promotes rest and digestion?',
    explanation: 'The parasympathetic division promotes maintenance functions.',
    source: { file: topic.source, slides: [18, 21], kind: 'slide' } };
const mc = { ...base, type: 'multiple_choice', options: ['Sympathetic', 'Parasympathetic', 'Somatic'], correct: [1] };
const blank = { ...base, id: 'ans-002', type: 'fill_blank', question: 'The ____ division promotes rest and digestion.', answers: ['parasympathetic', 'parasympathetic division'] };
const multi = { ...base, id: 'ans-003', type: 'select_all', question: 'Which are autonomic effectors?',
    options: ['Cardiac muscle', 'Smooth muscle', 'Skeletal muscle', 'Glands'], correct: [0, 1, 3] };
const order = { ...base, id: 'ans-004', type: 'ordering', question: 'Arrange the efferent pathway from the CNS to the target.',
    options: ['Target organ', 'Preganglionic neuron', 'Postganglionic neuron'], correct: [1, 2, 0] };

test('the three supported question types validate and grade actual answers', () => {
    for (const q of [mc, blank, order]) validateQuestion(q, topic);
    assert.equal(gradeQuestion(mc, [1]), true);
    assert.equal(gradeQuestion(mc, [0]), false);
    assert.equal(gradeQuestion(blank, '  PARASYMPATHETIC   division '), true);
    assert.equal(gradeQuestion(blank, 'sympathetic'), false);
    assert.throws(() => validateQuestion(multi, topic), /unsupported question type/);
    for (const answer of [[0, 1], [1, 1], [9]]) assert.equal(gradeQuestion(mc, answer), false);
    assert.equal(gradeQuestion(order, [1, 2, 0]), true);
    assert.equal(gradeQuestion(order, [0, 2, 1]), false);
});

test('rejects invalid answers, absent provenance, duplicate options, and slide-based wording', () => {
    for (const change of [
        { correct: [99] }, { correct: [1, 2] }, { source: null }, { options: ['Same', ' same '] },
        { question: 'Based on the slides, which division is active?' },
        { source: { ...base.source, kind: 'clinical_application' } },
    ]) assert.throws(() => validateQuestion({ ...mc, ...change }, topic));
    assert.throws(() => validateQuestion({ ...multi, correct: [0, 1, 2, 3] }, topic));
    assert.throws(() => validateQuestion({ ...order, correct: [1, 2] }, topic));
});

test('urinary terminology is enforced', () => {
    const urinary = STUDY_TOPICS.find(t => t.id === 'urinary');
    const q = { ...blank, question: 'The ____ artery branches from the arcuate artery.', answers: ['interlobular'], source: { ...base.source, file: urinary.source } };
    assert.throws(() => validateQuestion(q, urinary));
    q.answers = ['interlobular (also known as cortical radiate artery)'];
    validateQuestion(q, urinary);
    q.answers.push('interlobular', 'interlobular artery');
    validateQuestion(q, urinary);
    assert.throws(() => validateQuestion({ ...q, question: 'The interlobular artery branches from the ____ artery.' }, urinary));
    validateQuestion({ ...mc, question: 'Which vessels receive blood from the cortical radiate veins?', source: q.source }, urinary);
});

test('stale buttons, duplicate answers, premature next, and expired sessions are rejected', () => {
    const session = createStudySession('guild', 'student', [mc, blank], topic.id);
    assert.equal(getStudySession('guild', 'another-student', session.id), null);
    assert.equal(getStudySession('another-guild', 'student', session.id), null);
    assert.throws(() => nextStudyQuestion(session));
    checkStudyAction(session, '0', '0');
    assert.equal(submitStudyAnswer(session, [1]), true);
    assert.throws(() => submitStudyAnswer(session, [1]));
    assert.throws(() => checkStudyAction(session, '0', '0'));
    nextStudyQuestion(session);
    assert.equal(session.index, 1);
    assert.equal(session.score, 1);
    assert.throws(() => checkStudyAction(session, '0', '1'));
    assert.equal(getStudySession('guild', 'student', session.id, session.expiresAt), null);
});

test('new test invalidates prior session; ordering supports undo without revealing the correct order', () => {
    const old = createStudySession('g', 'u', [mc], topic.id);
    const session = createStudySession('g', 'u', [order], topic.id);
    assert.equal(getStudySession('g', 'u', old.id), null);
    assert.notDeepEqual(session.displayOrder, order.correct);
    chooseOrderItem(session, 1);
    assert.throws(() => chooseOrderItem(session, 1));
    assert.throws(() => chooseOrderItem(session, 99));
    undoOrderItem(session);
    assert.deepEqual(session.order, []);
    for (const item of order.correct) chooseOrderItem(session, item);
    assert.equal(submitStudyAnswer(session, session.order), true);
    assert.throws(() => undoOrderItem(session));
});

test('session selection samples without repeating or mutating the source bank', () => {
    const questions = Array.from({ length: 20 }, (_, i) => ({ ...mc, id: `q-${i}` }));
    const banks = new Map([[topic.id, questions]]);
    const selected = selectQuestions(banks, topic.id, 5);
    assert.equal(selected.length, 5);
    assert.equal(new Set(selected.map(q => q.id)).size, 5);
    assert.equal(questions[0].id, 'q-0');
    assert.throws(() => selectQuestions(banks, topic.id, 6));
    assert.throws(() => selectQuestions(banks, 'missing', 5));
    assert.throws(() => selectQuestions(new Map(), topic.id, 5));
});

test('all 23 topics fit Discord menu and every question UI serializes within limits', () => {
    assert.equal(STUDY_TOPICS.length, 23);
    const menu = topicMessage('123', new Map()).components[0].toJSON().components[0];
    assert.equal(menu.options.length, 24);
    for (const q of [mc, blank, order]) {
        const session = createStudySession('g', 'u', [q], topic.id);
        const message = questionMessage(session);
        for (const embed of message.embeds) assert.ok(embed.toJSON().description.length <= 4096);
        for (const row of message.components) for (const component of row.toJSON().components) assert.ok(component.custom_id.length <= 100);
        if (q.type === 'ordering') {
            for (const value of q.correct) chooseOrderItem(session, value);
            const components = questionMessage(session).components.flatMap(row => row.toJSON().components);
            assert.equal(components.find(c => c.label === 'Submit order').type, 2);
        }
    }
});

function fakeInteraction(customId, extras = {}) {
    const calls = [];
    return { guildId: 'g', user: { id: 'u' }, customId, calls,
        async reply(p) { calls.push(['reply', p]); this.replied = true; },
        async followUp(p) { calls.push(['followUp', p]); return { id: 'question-message' }; },
        async deferUpdate() { this.deferred = true; },
        async editReply(p) { calls.push(['editReply', p]); },
        async showModal(p) { calls.push(['showModal', p.toJSON()]); }, ...extras };
}

test('interaction handler enforces ownership and submits a modal answer', async () => {
    const session = createStudySession('g', 'u', [blank], topic.id);
    const args = ['blank', 'u', session.id, '0', '0'];
    const foreign = fakeInteraction('', { user: { id: 'other' } });
    await handleStudyInteraction(foreign, {}, args);
    assert.match(foreign.calls[0][1].content, /another student/);
    const interaction = fakeInteraction('');
    await handleStudyInteraction(interaction, {}, args);
    assert.equal(interaction.calls[0][0], 'showModal');
    const modal = fakeInteraction('', { fields: { getTextInputValue: () => 'parasympathetic' } });
    await handleStudyInteraction(modal, {}, ['typed', ...args.slice(1)]);
    assert.equal(session.score, 1);
    assert.match(modal.calls[0][1].embeds[0].toJSON().title, /^Correct/);
});

test('ordering interactions ignore stale selections and grade only the complete sequence', async () => {
    const session = createStudySession('g', 'u', [order], topic.id);
    const args = action => [action, 'u', session.id, '0', String(session.revision)];
    const stale = args('order');
    await handleStudyInteraction(fakeInteraction('', { values: ['1'] }), {}, stale);
    await handleStudyInteraction(fakeInteraction('', { values: ['2'] }), {}, stale);
    assert.deepEqual(session.order, [1]);
    for (const value of [2, 0]) await handleStudyInteraction(fakeInteraction('', { values: [String(value)] }), {}, args('order'));
    await handleStudyInteraction(fakeInteraction(''), {}, args('ordered'));
    assert.equal(session.score, 1);
});

test('bank validation reports missing content and rejects duplicated prompts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'study-banks-'));
    const url = pathToFileURL(`${directory}/`);
    try {
        const banks = await loadQuestionBanks(url);
        assert.equal(banks.size, 23);
        await assert.rejects(loadQuestionBanks(url, { complete: true }), /expected 600/);
        await writeFile(join(directory, `${topic.id}.json`), JSON.stringify([mc, { ...mc, id: 'another' }]));
        await assert.rejects(loadQuestionBanks(url), /duplicate/);
        await writeFile(join(directory, `${topic.id}.json`), JSON.stringify([{ ...mc, source: { ...mc.source, slides: [999] } }]));
        await assert.rejects(loadQuestionBanks(url), /source slide exceeds/);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('all 23 authored topics meet the complete 13,800-question target', async () => {
    const banks = await loadQuestionBanks(undefined, { complete: true });
    assert.equal(banks.size, 23);
    assert.equal([...banks.values()].reduce((n, questions) => n + questions.length, 0), 13800);
});

test('completed banks each supply 600 different questions in all three formats', async () => {
    const banks = await loadQuestionBanks();
    for (const topicId of ['anatomical_directions', 'basic_chemistry', 'living_cells', 'tissues', 'integumentary', 'skeletal', 'joints', 'muscular', 'nervous_tissue', 'central_nervous', 'special_senses', 'endocrine', 'blood_cells', 'circulatory', 'blood_vessels', 'lymphatic', 'respiratory', 'digestive', 'fluid_balance', 'reproductive', 'autonomic_nervous', 'immune', 'urinary']) {
        const bank = banks.get(topicId);
        assert.equal(bank.length, 600, topicId);
        const selected = selectQuestions(banks, topicId, 600);
        assert.equal(selected.length, 600, topicId);
        assert.equal(new Set(selected.map(question => question.id)).size, 600, topicId);
        for (const type of ['multiple_choice', 'fill_blank', 'ordering']) assert.ok(selected.some(question => question.type === type), `${topicId}: ${type}`);
    }
});

test('Basic Chemistry replaces calculation drills with introductory A&P concepts', async () => {
    const bank = (await loadQuestionBanks()).get('basic_chemistry');
    const replacements = bank.filter(q => {
        const number = Number(q.id.split('-').at(-1));
        return number >= 331 && number <= 420;
    });
    assert.equal(replacements.length, 90);
    assert.ok(replacements.every(q => q.type === 'multiple_choice' && q.difficulty === 'easy'));
    for (const q of bank) {
        assert.doesNotMatch(q.question, /\bconvert \d|conversion factor|\bcalculate\b|log10|mass\/volume percentage|Using molarity|mg\/dL\. Using|One deciliter is/i, q.id);
    }
    const facts = [
        ['Which particle in an atom has a positive charge?', 'Proton'],
        ['Which particle in an atom has a negative charge?', 'Electron'],
        ['Why is water described as a polar molecule?', 'Its charge is distributed unevenly'],
        ['Why are buffers useful in the blood?', 'They help resist large changes in pH'],
        ['Which large nutrient group is commonly used for readily available energy?', 'Carbohydrates'],
        ['What are the building blocks of proteins?', 'Amino acids'],
        ['What is the main role of DNA in a cell?', 'Storing genetic information'],
        ['Which base is used in RNA in place of thymine?', 'Uracil'],
    ];
    for (const [prompt, expected] of facts) {
        const q = bank.find(item => item.question === prompt);
        assert.ok(q, prompt);
        assert.equal(q.options[q.correct[0]], expected, q.id);
    }
});

test('Living Cells transport, division-count, and sequence keys agree with their explicit models', async () => {
    const bank = (await loadQuestionBanks()).get('living_cells');
    const exercises = bank.filter(q => {
        const number = Number(q.id.split('-').at(-1));
        return number >= 331 && number <= 420;
    });
    assert.equal(exercises.length, 90);
    let numerical = 0;
    let categorical = 0;
    let sequences = 0;
    for (const q of exercises) {
        const prompt = q.question;
        const answer = q.options[q.correct[0]];
        const match = pattern => {
            const result = prompt.match(pattern);
            assert.ok(result, `${q.id}: model inputs need review`);
            return result;
        };
        let expected;
        if (prompt.startsWith('An equal-pressure model')) {
            const [, inside, outside] = match(/Inside is (\d+) mOsm\/L and outside is (\d+) mOsm\/L/);
            assert.equal(answer, Number(outside) > Number(inside) ? 'Out of the cell' : 'Into the cell', q.id);
            categorical++;
            continue;
        } else if (prompt.startsWith('An ideal nonlysing cell')) {
            const [, volume, inside] = match(/initial volume (\d+) fL at (\d+) mOsm\/L/);
            const outside = Number(match(/reservoir stays at (\d+) mOsm\/L/)[1]);
            expected = Number(volume) * Number(inside) / outside;
        } else if (prompt.includes('each exporting 3 Na+')) expected = Number(match(/makes (\d+) complete cycles/)[1]) * 3;
        else if (prompt.includes('each importing 2 K+')) expected = Number(match(/makes (\d+) complete cycles/)[1]) * 2;
        else if (prompt.startsWith('Considering the pump alone')) expected = Number(match(/each of (\d+) Na\+\/K\+/)[1]) * (3 - 2);
        else if (prompt.startsWith('One cell starts a lineage')) expected = 2 ** Number(match(/after (\d+) complete round/)[1]);
        else if (prompt.includes('how many chromosomes are counted')) {
            const baseline = Number(match(/starting with (\d+) chromosomes/)[1]);
            assert.equal(baseline, 46, q.id);
            expected = prompt.includes('anaphase before cytokinesis') ? 2 * baseline : baseline;
        } else if (prompt.includes('how many double-stranded nuclear DNA molecules')) {
            const baseline = Number(match(/starting with (\d+) unreplicated chromosomes/)[1]);
            assert.equal(baseline, 46, q.id);
            expected = prompt.includes('G1') ? baseline : 2 * baseline;
        } else if (prompt.startsWith('During DNA replication') || prompt.startsWith('A nuclear DNA transcription template')) {
            const template = match(/3′-([ATGC]+)-5′/)[1];
            const transcription = prompt.startsWith('A nuclear DNA transcription template');
            const bases = { A: transcription ? 'U' : 'T', T: 'A', G: 'C', C: 'G' };
            assert.equal(answer, `5′-${[...template].map(base => bases[base]).join('')}-3′`, q.id);
            sequences++;
            continue;
        } else if (prompt.startsWith('An mRNA segment')) expected = Number(match(/has (\d+) nucleotides/)[1]) / 3;
        else if (prompt.startsWith('An idealized cubic cell model')) {
            const side = Number(match(/side length (\d+) µm/)[1]);
            expected = prompt.includes('surface-area-to-volume ratio') ? 6 / side : 6 * side ** 2;
        } else if (prompt.startsWith('A neutral solute crosses')) {
            const [, inside, outside] = match(/is (\d+) mM inside and (\d+) mM outside/);
            const direction = Number(outside) > Number(inside) ? 'Into the cell' : Number(inside) > Number(outside) ? 'Out of the cell' : 'No initial net movement';
            assert.equal(answer, direction, q.id);
            categorical++;
            continue;
        } else assert.fail(`${q.id}: unrecognized cell-model exercise`);
        const quantity = option => {
            const value = Number(option.match(/^-?[\d.]+/)?.[0]);
            assert.ok(Number.isFinite(value) && value >= 0, q.id);
            return value;
        };
        const equal = value => Math.abs(value - expected) < 1e-10 * Math.max(1, Math.abs(expected));
        assert.ok(equal(quantity(answer)), q.id);
        for (let i = 0; i < q.options.length; i++) if (!q.correct.includes(i)) assert.ok(!equal(quantity(q.options[i])), `${q.id}: equivalent numeric distractor`);
        numerical++;
    }
    assert.equal(numerical, 54);
    assert.equal(categorical, 20);
    assert.equal(sequences, 16);
});

test('tissue and skin depth-sequence keys agree with anatomical reference order', async () => {
    const banks = await loadQuestionBanks();
    const references = [
        ['integumentary', 'deep-to-superficial stratum order', ['Stratum basale', 'Stratum spinosum', 'Stratum granulosum', 'Stratum lucidum', 'Stratum corneum'], 16],
        ['integumentary', 'specified superficial-to-deep skin section', ['Outer epidermis', 'Basal epidermal region', 'Papillary dermis', 'Reticular dermis', 'Hypodermis', 'Underlying deep fascia'], 15],
        ['integumentary', 'burn-depth categories ranked', ['Superficial epidermal injury', 'Partial dermal injury', 'Full dermal-thickness injury', 'Injury extending into deeper muscle'], 6],
        ['tissues', 'specified apical-to-basal cross-section', ['Lumen', 'Apical cell membrane', 'Epithelial cytoplasm', 'Basal cell membrane', 'Basal supporting membrane', 'Underlying lamina propria'], 15],
        ['tissues', 'nutrient route from underlying blood', ['Capillary lumen', 'Capillary wall', 'Connective-tissue interstitium', 'Epithelial supporting basal matrix', 'Basal epithelial cell surface'], 10],
    ];
    let checked = 0;
    for (const [topicId, phrase, reference, expectedCount] of references) {
        const questions = banks.get(topicId).filter(q => q.question.includes(phrase));
        assert.equal(questions.length, expectedCount, phrase);
        for (const q of questions) {
            const ranks = q.options.map(option => reference.indexOf(option));
            assert.ok(ranks.every(rank => rank >= 0), q.id);
            if (q.type === 'ordering') {
                const selected = q.correct.map(index => ranks[index]);
                assert.deepEqual(selected, [...ranks].sort((a, b) => a - b), q.id);
            } else {
                assert.equal(q.type, 'multiple_choice', q.id);
                assert.equal(ranks[q.correct[0]], Math.min(...ranks), q.id);
            }
            checked++;
        }
    }
    assert.equal(checked, 62);
});

test('skeletal spatial, lineage, growth-interface, and repair keys follow their stated reference models', async () => {
    const bank = (await loadQuestionBanks()).get('skeletal');
    const references = [
        ['five-zone growth-interface scheme', ['Resting cartilage region', 'Proliferative cartilage region', 'Hypertrophic cartilage region', 'Calcified-cartilage region', 'Ossification region'], 10],
        ['proximal-to-distal regional order', ['Proximal epiphysis', 'Proximal metaphysis', 'Diaphysis', 'Distal metaphysis', 'Distal epiphysis'], 10],
        ['selected osteoblast-lineage progression', ['Mesenchymal progenitor', 'Osteogenic precursor', 'Active osteoblast', 'Embedded osteocyte'], 6],
        ['onset order of secondary fracture-repair phases', ['Fracture hematoma', 'Early inflammatory recruitment', 'Soft fibrocartilaginous callus', 'Bony callus', 'Remodeled lamellar repair tissue'], 10],
    ];
    let checked = 0;
    for (const [phrase, reference, expectedCount] of references) {
        const selected = bank.filter(q => q.question.includes(phrase));
        assert.equal(selected.length, expectedCount, phrase);
        for (const q of selected) {
            const positions = q.options.map(option => reference.indexOf(option));
            assert.ok(positions.every(position => position >= 0), q.id);
            if (q.type === 'ordering') {
                assert.deepEqual(q.correct.map(index => positions[index]), [...positions].sort((a, b) => a - b), q.id);
            } else {
                assert.equal(q.type, 'multiple_choice', q.id);
                assert.equal(positions[q.correct[0]], Math.min(...positions), q.id);
            }
            checked++;
        }
    }
    assert.equal(checked, 36);
});

test('Joints angle calculations and spatial ordering keys match independent reference rules', async () => {
    const bank = (await loadQuestionBanks()).get('joints');
    const calculations = bank.filter(q => /angle change\?|additional abduction occurs\?/.test(q.question));
    assert.equal(calculations.length, 30);
    for (const q of calculations) {
        const match = q.question.match(/from (\d+)° to (\d+)°/);
        assert.ok(match, q.id);
        const difference = Math.abs(Number(match[2]) - Number(match[1]));
        assert.equal(q.options[q.correct[0]], `${difference}°`, q.id);
        assert.equal(q.options.filter(option => option === `${difference}°`).length, 1, q.id);
    }
    const angular = bank.filter(q => q.type === 'ordering' && /during uninterrupted/.test(q.question));
    assert.equal(angular.length, 30);
    for (const q of angular) {
        const values = q.options.map(option => Number.parseInt(option, 10));
        const descending = /during uninterrupted flexion/.test(q.question);
        const expected = [...values].sort((a, b) => descending ? b - a : a - b);
        assert.deepEqual(q.correct.map(index => values[index]), expected, q.id);
    }
    const depthReference = ['Subchondral bone', 'Calcified articular cartilage', 'Tidemark boundary', 'Deep noncalcified cartilage zone', 'Middle cartilage zone', 'Superficial cartilage zone', 'Joint cavity'];
    const depth = bank.filter(q => /mature articular-surface depth model/.test(q.question));
    assert.equal(depth.length, 15);
    for (const q of depth) {
        const ranks = q.options.map(option => depthReference.indexOf(option));
        assert.ok(ranks.every(rank => rank >= 0), q.id);
        assert.deepEqual(q.correct.map(index => ranks[index]), [...ranks].sort((a, b) => a - b), q.id);
    }
});

test('Muscular System causal and structural ordering keys follow independently specified reference models', async () => {
    const bank = (await loadQuestionBanks()).get('muscular');
    const references = [
        ['selected NMJ activation milestones', ['Motor-terminal action potential arrives', 'Presynaptic voltage-gated calcium channels open', 'Calcium enters the motor terminal', 'Acetylcholine is released by vesicle fusion', 'Acetylcholine diffuses across the cleft', 'Acetylcholine binds muscle nicotinic receptors', 'Receptor cation channels open', 'A local end-plate potential develops'], 28],
        ['selected skeletal excitation-to-cross-bridge milestones', ['Muscle action potential propagates on sarcolemma', 'Excitation travels down T-tubules', 'T-tubule voltage sensors change conformation', 'SR ryanodine calcium-release channels open', 'Calcium is released into sarcoplasm', 'Calcium binds troponin C', 'Tropomyosin shifts to expose actin sites', 'An available energized myosin head binds actin'], 28],
        ['one selected cross-bridge cycle', ['ATP binds an attached myosin head', 'Myosin detaches from actin', 'ATP hydrolysis re-energizes the myosin head', 'Energized myosin binds an available actin site', 'Phosphate release accompanies the force-generating stroke'], 10],
        ['selected cessation-to-relaxation milestones', ['Motor terminal stops releasing new acetylcholine', 'Residual cleft acetylcholine is cleared', 'Repeated end-plate-driven excitation ceases', 'SR reuptake lowers cytosolic calcium', 'Thin-filament sites return toward their blocked state'], 10],
        ['muscle structural hierarchy', ['Whole skeletal muscle', 'Muscle fascicle', 'Individual muscle fiber', 'Intracellular myofibril', 'Sarcomere'], 10],
        ['selected nested muscle coverings', ['Epimysium around whole muscle', 'Perimysium around a fascicle', 'Endomysium around one fiber', 'Sarcolemma of that fiber'], 6],
        ['three-phase single-twitch model', ['Latent period', 'Rising-tension contraction phase', 'Declining-tension relaxation phase'], 3],
        ['selected skeletal-muscle regeneration milestones', ['Activated satellite-lineage progenitor', 'Proliferating myoblasts', 'Differentiating aligned myoblasts', 'Fused multinucleated myotube', 'Maturing muscle fiber'], 10],
    ];
    let checked = 0;
    for (const [phrase, reference, expectedCount] of references) {
        const selected = bank.filter(q => q.question.includes(phrase));
        assert.equal(selected.length, expectedCount, phrase);
        for (const q of selected) {
            const ranks = q.options.map(option => reference.indexOf(option));
            assert.ok(ranks.every(rank => rank >= 0), q.id);
            if (q.type === 'ordering') {
                assert.deepEqual(q.correct.map(index => ranks[index]), [...ranks].sort((a, b) => a - b), q.id);
            } else {
                assert.equal(q.type, 'multiple_choice', q.id);
                assert.equal(ranks[q.correct[0]], Math.min(...ranks), q.id);
            }
            checked++;
        }
    }
    assert.equal(checked, 105);
});

test('Nervous Tissue sequence, voltage, threshold, and firing-rate keys match independent reference rules', async () => {
    const bank = (await loadQuestionBanks()).get('nervous_tissue');
    const references = [
        ['selected phases of a standard neuronal action-potential waveform', ['Initial resting voltage', 'Threshold crossing', 'Rapid depolarizing upstroke', 'Positive spike peak', 'Repolarizing downstroke', 'Afterhyperpolarization', 'Return toward resting voltage'], 21],
        ['selected ionotropic chemical-synapse milestones', ['Presynaptic action potential arrives', 'Presynaptic voltage-gated calcium channels open', 'Calcium enters the presynaptic terminal', 'Transmitter-containing vesicles fuse with membrane', 'Released transmitter diffuses through the cleft', 'Transmitter binds the postsynaptic receptor', 'Postsynaptic ion-channel conductance changes', 'A postsynaptic voltage response develops'], 28],
        ['simplified polysynaptic somatic reflex pathway', ['Sensory receptor is activated', 'Afferent neuron conveys input', 'CNS circuit integrates the input', 'Efferent neuron conveys output', 'Skeletal-muscle effector responds'], 10],
        ['conventional information-flow regions of a typical multipolar neuron', ['Dendritic receptive region', 'Soma integration region', 'Axon initial segment', 'Axon shaft', 'Axon terminal'], 10],
        ['selected forward saltatory-propagation milestones', ['A spike develops at node A', 'Local current spreads through the intervening internodal region', 'Node B reaches its regenerative threshold', 'A spike develops at node B'], 6],
    ];
    let sequenceCount = 0;
    for (const [phrase, reference, expectedCount] of references) {
        const selected = bank.filter(q => q.question.includes(phrase));
        assert.equal(selected.length, expectedCount, phrase);
        for (const q of selected) {
            const ranks = q.options.map(option => reference.indexOf(option));
            assert.ok(ranks.every(rank => rank >= 0), q.id);
            if (q.type === 'ordering') {
                assert.deepEqual(q.correct.map(index => ranks[index]), [...ranks].sort((a, b) => a - b), q.id);
            } else {
                assert.equal(q.type, 'multiple_choice', q.id);
                assert.equal(ranks[q.correct[0]], Math.min(...ranks), q.id);
            }
            sequenceCount++;
        }
    }
    assert.equal(sequenceCount, 75);
    const signedChanges = bank.filter(q => q.question.includes('signed membrane-voltage change'));
    assert.equal(signedChanges.length, 10);
    for (const q of signedChanges) {
        const match = q.question.match(/from (-?\d+) mV to (-?\d+) mV/);
        assert.ok(match, q.id);
        const difference = Number(match[2]) - Number(match[1]);
        assert.equal(q.options[q.correct[0]], `${difference >= 0 ? '+' : ''}${difference} mV`, q.id);
    }
    const thresholdMargins = bank.filter(q => q.question.includes('additional depolarization would reach'));
    assert.equal(thresholdMargins.length, 10);
    for (const q of thresholdMargins) {
        const match = q.question.match(/present voltage is (-?\d+) mV.*threshold is (-?\d+) mV/);
        assert.ok(match, q.id);
        assert.equal(q.options[q.correct[0]], `${Number(match[2]) - Number(match[1])} mV`, q.id);
    }
    const rates = bank.filter(q => q.question.includes('mean firing rate in spikes per second'));
    assert.equal(rates.length, 10);
    for (const q of rates) {
        const match = q.question.match(/counts (\d+) complete action potentials during a (\d+)-second/);
        assert.ok(match, q.id);
        assert.equal(q.options[q.correct[0]], `${Number(match[1]) / Number(match[2])} spikes/s`, q.id);
    }
});

test('Central Nervous System sequence keys match anatomical reference models', async () => {
    const bank = (await loadQuestionBanks()).get('central_nervous');
    const references = [
        ['selected traditional CSF route', ['Lateral ventricle', 'Interventricular foramen', 'Third ventricle', 'Cerebral aqueduct', 'Fourth ventricle', 'Median or lateral aperture', 'Subarachnoid space', 'Arachnoid granulation'], 28],
        ['selected cranial coverings and interfaces', ['Skull', 'Periosteal cranial dura', 'Meningeal cranial dura', 'Potential subdural interface', 'Arachnoid mater', 'Subarachnoid space', 'Pia mater'], 21],
        ['increasing conventional cranial-nerve numbering', ['Olfactory nerve', 'Oculomotor nerve', 'Trigeminal nerve', 'Facial nerve', 'Glossopharyngeal nerve'], 10],
        ['five-component somatic reflex-arc model', ['Sensory receptor', 'Afferent sensory neuron', 'CNS integration center', 'Efferent motor neuron', 'Skeletal-muscle effector'], 10],
        ['rostral-to-caudal brain-stem-to-cord sequence', ['Midbrain', 'Pons', 'Medulla oblongata', 'Spinal cord'], 6],
    ];
    let checked = 0;
    for (const [phrase, reference, expectedCount] of references) {
        const selected = bank.filter(q => q.question.includes(phrase));
        assert.equal(selected.length, expectedCount, phrase);
        for (const q of selected) {
            const ranks = q.options.map(option => reference.indexOf(option));
            assert.ok(ranks.every(rank => rank >= 0), q.id);
            if (q.type === 'ordering') {
                assert.deepEqual(q.correct.map(index => ranks[index]), [...ranks].sort((a, b) => a - b), q.id);
            } else {
                assert.equal(q.type, 'multiple_choice', q.id);
                assert.equal(ranks[q.correct[0]], Math.min(...ranks), q.id);
            }
            checked++;
        }
    }
    assert.equal(checked, 75);
});

test('Central Nervous System preserves corrected source claims and standard reference facts', async () => {
    const bank = (await loadQuestionBanks()).get('central_nervous');
    const checkpoints = [
        ['CSF obtained in a lumbar puncture', 'Subarachnoid space'],
        ['usual relationship of the radial and axillary nerves', 'Both arise from the posterior cord'],
        ['Where does the C8 spinal nerve usually exit', 'Between C7 and T1'],
        ['structures develop mainly from the metencephalon', 'Pons and cerebellum'],
        ['principal precursor of the medulla oblongata', 'Myelencephalon'],
        ['usual total number of left-right spinal nerve pairs', `${[8, 12, 5, 5, 1].reduce((sum, n) => sum + n, 0)} pairs`],
        ['main cranial input and output routes in the pupillary light-reflex model', 'CN II afferent; CN III efferent'],
        ['ventricles lie directly upstream', 'The lateral and third ventricles'],
    ];
    for (const [phrase, expected] of checkpoints) {
        const matching = bank.filter(q => q.type === 'multiple_choice' && q.question.includes(phrase) && !q.question.endsWith('Which statement fits this situation?'));
        assert.equal(matching.length, 1, phrase);
        const q = matching[0];
        assert.equal(q.options[q.correct[0]], expected, q.id);
    }
});

test('Special Senses pathway and spatial keys follow independent reference models', async () => {
    const bank = (await loadQuestionBanks()).get('special_senses');
    const references = [
        ['simplified nonfoveal incoming-light route', ['Cornea', 'Anterior-chamber aqueous', 'Pupil aperture', 'Posterior-chamber aqueous', 'Lens', 'Vitreous', 'Inner neural retinal layers', 'Photoreceptor outer segments'], 28],
        ['selected airborne-sound-to-oval-window mechanical chain', ['Auricle', 'External acoustic meatus', 'Tympanic membrane', 'Malleus', 'Incus', 'Stapes', 'Oval window'], 21],
        ['selected activation milestones of a rod phototransduction response', ['Photon activates rhodopsin', 'Transducin-PDE signaling lowers cGMP', 'cGMP-gated cation channels close', 'Rod membrane hyperpolarizes', 'Rod glutamate release decreases'], 10],
        ['selected retinal-to-brain information-flow elements', ['Photoreceptor', 'Retinal bipolar cell', 'Retinal ganglion cell', 'Optic nerve axon', 'Optic tract axon'], 10],
        ['selected superior-to-inferior cochlear compartments', ['Scala vestibuli', 'Scala media', 'Basilar membrane', 'Scala tympani'], 6],
    ];
    let checked = 0;
    for (const [phrase, reference, expectedCount] of references) {
        const selected = bank.filter(q => q.question.includes(phrase));
        assert.equal(selected.length, expectedCount, phrase);
        for (const q of selected) {
            const ranks = q.options.map(option => reference.indexOf(option));
            assert.ok(ranks.every(rank => rank >= 0), q.id);
            if (q.type === 'ordering') {
                assert.deepEqual(q.correct.map(index => ranks[index]), [...ranks].sort((a, b) => a - b), q.id);
            } else {
                assert.equal(q.type, 'multiple_choice', q.id);
                assert.equal(ranks[q.correct[0]], Math.min(...ranks), q.id);
            }
            checked++;
        }
    }
    assert.equal(checked, 75);
});

test('Special Senses preserves corrected photoreceptor, fluid, optical, and vestibular answer keys', async () => {
    const bank = (await loadQuestionBanks()).get('special_senses');
    const checkpoints = [
        ['Which rod state is expected in darkness', 'Relatively open cGMP-gated channels and a relatively depolarized receptor'],
        ['selectively affecting crossing nasal-retinal fibers', 'Temporal visual-field information from both eyes'],
        ['Which membrane separates scala vestibuli from scala media', 'Vestibular membrane'],
        ['which major endolymph cation', 'Potassium'],
        ['especially associated with horizontal-plane linear acceleration', 'Utricle'],
        ['especially associated with vertical-plane linear acceleration', 'Saccule'],
        ['Which sensory ridge occupies a semicircular ampulla', 'Crista ampullaris'],
        ['During ordinary near accommodation', 'Ciliary contraction reduces zonular tension and permits a rounder lens'],
        ['sample is assigned to the inside of the membranous labyrinth', 'Endolymph'],
        ['Which cochlear place-code relationship is correct', 'Higher frequencies favor the base and lower frequencies favor more apical regions'],
    ];
    for (const [phrase, expected] of checkpoints) {
        const selected = bank.filter(q => q.type === 'multiple_choice' && q.question.includes(phrase) && !q.question.endsWith('Which statement fits this situation?'));
        assert.equal(selected.length, 1, phrase);
        const q = selected[0];
        assert.equal(q.options[q.correct[0]], expected, q.id);
    }
});

test('Endocrine sequence keys match independent axis and anatomical reference models', async () => {
    const bank = (await loadQuestionBanks()).get('endocrine');
    const references = [
        ['simplified aldosterone-mediated RAAS response branch', ['Renal perfusion falls', 'Renin is released', 'Renin forms angiotensin I from angiotensinogen', 'ACE forms angiotensin II', 'Angiotensin II stimulates the adrenal cortex', 'Aldosterone is released', 'Distal renal sodium reabsorption increases', 'Sodium-associated extracellular volume conservation is supported'], 28],
        ['selected thyroid-axis response-and-feedback cycle', ['Hypothalamus releases TRH', 'Portal blood delivers TRH to the anterior pituitary', 'Anterior pituitary releases TSH', 'TSH stimulates thyroid follicular receptors', 'Thyroid hormones enter the circulation', 'Thyroid hormones act on hypothalamic and pituitary feedback targets', 'Further TRH-TSH drive is restrained'], 21],
        ['selected forward HPA secretory milestones', ['Hypothalamus releases CRH', 'Portal blood delivers CRH to the anterior pituitary', 'Anterior pituitary releases ACTH', 'ACTH stimulates adrenal cortical cells', 'Adrenal cortex releases cortisol'], 10],
        ['selected ADH synthesis-to-release-pool pathway', ['Hypothalamic neuron synthesizes ADH', 'ADH-containing material travels down the axon', 'ADH is stored in posterior pituitary terminals', 'Terminal stimulation triggers release machinery', 'ADH enters the bloodstream'], 10],
        ['selected adrenal covering and cortical zones', ['Adrenal capsule', 'Zona glomerulosa', 'Zona fasciculata', 'Zona reticularis'], 6],
    ];
    let checked = 0;
    for (const [phrase, reference, expectedCount] of references) {
        const selected = bank.filter(q => q.question.includes(phrase));
        assert.equal(selected.length, expectedCount, phrase);
        for (const q of selected) {
            const ranks = q.options.map(option => reference.indexOf(option));
            assert.ok(ranks.every(rank => rank >= 0), q.id);
            if (q.type === 'ordering') {
                assert.deepEqual(q.correct.map(index => ranks[index]), [...ranks].sort((a, b) => a - b), q.id);
            } else {
                assert.equal(q.type, 'multiple_choice', q.id);
                assert.equal(ranks[q.correct[0]], Math.min(...ranks), q.id);
            }
            checked++;
        }
    }
    assert.equal(checked, 75);
});

test('Endocrine source corrections preserve feedback, synthesis, and regulator distinctions', async () => {
    const bank = (await loadQuestionBanks()).get('endocrine');
    const checkpoints = [
        ['stores hypothalamically synthesized ADH and releases it from axon terminals', 'Posterior pituitary'],
        ['Which pair provides major direct regulators of aldosterone secretion', 'Angiotensin II and extracellular potassium'],
        ['which pair fits primary thyroid failure', 'Low free T4 with elevated TSH'],
        ['which pair fits primary thyroid hormone overproduction', 'High free T4 with suppressed TSH'],
        ['Which simplified pattern is compatible with central hypothyroidism', 'Low free T4 with an inappropriately low or normal TSH'],
        ['Which wording correctly describes the PTH-related renal vitamin D step', 'Renal activation of a vitamin D precursor to calcitriol'],
        ['Which definition distinguishes Cushing disease', 'Pituitary ACTH-driven glucocorticoid excess'],
        ['Which term names the syndrome of sustained pathological glucocorticoid excess', 'Cushing syndrome'],
        ['Which statement correctly classifies thyroid hormone receptor signaling', 'T3 is amino-acid-derived yet acts through intracellular nuclear receptors'],
        ['Which pregnancy-related hormone is associated with connective-tissue remodeling', 'Relaxin'],
    ];
    for (const [phrase, expected] of checkpoints) {
        const selected = bank.filter(q => q.type === 'multiple_choice' && q.question.includes(phrase) && !q.question.endsWith('Which statement fits this situation?'));
        assert.equal(selected.length, 1, phrase);
        const q = selected[0];
        assert.equal(q.options[q.correct[0]], expected, q.id);
    }
});

test('Blood Cells sequence keys follow independent production, recycling, and clotting models', async () => {
    const bank = (await loadQuestionBanks()).get('blood_cells');
    const references = [
        ['selected hypoxia-to-erythrocyte-production milestones', ['Renal oxygen delivery falls', 'Kidneys release erythropoietin', 'Erythropoietin reaches red marrow', 'Erythroid precursors receive survival and proliferation signals', 'Precursors accumulate hemoglobin and mature', 'Late erythroblasts lose their nuclei', 'Reticulocytes enter circulation', 'Mature erythrocytes join the circulating pool'], 28],
        ['selected heme-catabolism-to-fecal-pigment milestones', ['Macrophage engulfs an aged erythrocyte', 'Heme is separated during hemoglobin breakdown', 'Heme-ring catabolism produces biliverdin', 'Biliverdin is converted to bilirubin', 'Liver handles and conjugates bilirubin', 'Conjugated bilirubin enters bile', 'Intestinal processing yields fecal pigment derivatives'], 21],
        ['selected local hemostatic plug-formation milestones', ['Vessel wall injury exposes adhesive matrix', 'Platelets adhere to the injury surface', 'Adherent platelets activate', 'Activated platelets aggregate', 'Fibrin helps stabilize the developing plug'], 10],
        ['selected primary anti-D sensitization-then-reexposure model', ['D-positive red cells enter a previously unsensitized D-negative person', 'D antigen is recognized by the immune system', 'An antigen-specific B-cell response develops', 'Immune anti-D IgG becomes available', 'Later D-positive cells encounter pre-existing anti-D'], 10],
        ['selected prothrombin-to-fibrin reaction milestones', ['Prothrombinase activates prothrombin', 'Thrombin activity increases', 'Thrombin cleaves fibrinogen', 'Fibrin strands form'], 6],
    ];
    let checked = 0;
    for (const [phrase, reference, expectedCount] of references) {
        const selected = bank.filter(q => q.question.includes(phrase));
        assert.equal(selected.length, expectedCount, phrase);
        for (const q of selected) {
            const ranks = q.options.map(option => reference.indexOf(option));
            assert.ok(ranks.every(rank => rank >= 0), q.id);
            if (q.type === 'ordering') {
                assert.deepEqual(q.correct.map(index => ranks[index]), [...ranks].sort((a, b) => a - b), q.id);
            } else {
                assert.equal(q.type, 'multiple_choice', q.id);
                assert.equal(ranks[q.correct[0]], Math.min(...ranks), q.id);
            }
            checked++;
        }
    }
    assert.equal(checked, 75);
});

test('Blood Cells hematocrit, binding-capacity, and differential counts recompute correctly', async () => {
    const bank = (await loadQuestionBanks()).get('blood_cells');
    const hematocrit = bank.filter(q => q.question.includes('simplified centrifuged sample has'));
    assert.equal(hematocrit.length, 4);
    for (const q of hematocrit) {
        const match = q.question.match(/has ([\d.]+) mL of packed erythrocytes in ([\d.]+) mL/);
        assert.ok(match, q.id);
        assert.equal(q.options[q.correct[0]], `${Number(match[1]) / Number(match[2]) * 100}%`, q.id);
    }
    const capacity = bank.filter(q => q.question.includes('hemoglobin tetramers each have four functional'));
    assert.equal(capacity.length, 3);
    for (const q of capacity) {
        const match = q.question.match(/(\d+) hemoglobin tetramers/);
        assert.ok(match, q.id);
        assert.equal(q.options[q.correct[0]], `${Number(match[1]) * 4} oxygen molecules`, q.id);
    }
    const differential = bank.filter(q => q.question.includes('A count model reports'));
    assert.equal(differential.length, 3);
    for (const q of differential) {
        const match = q.question.match(/reports (\d+) leukocytes\/µL, of which (\d+)%/);
        assert.ok(match, q.id);
        assert.equal(q.options[q.correct[0]], `${Number(match[1]) * Number(match[2]) / 100} neutrophils/µL`, q.id);
    }
});

test('Blood Cells typing and corrected source facts preserve component-specific distinctions', async () => {
    const bank = (await loadQuestionBanks()).get('blood_cells');
    const checkpoints = [
        ['commonly used adult platelet reference range', 'About 150,000-450,000 per microliter'],
        ['Which combination belongs in the buffy coat', 'Leukocytes and platelets'],
        ['Which antibody class can cross the placenta', 'IgG'],
        ['Which donor plasma type has the broadest conventional ABO compatibility', 'AB plasma'],
        ['agglutinate with anti-A and anti-B but not anti-D', 'AB negative'],
        ['agglutinate with anti-A and anti-D but not anti-B', 'A positive'],
        ['agglutinate with anti-B but not anti-A or anti-D', 'B negative'],
        ['agglutinate only with anti-D, not anti-A or anti-B', 'O positive'],
        ['Which factor deficiency defines the usual inherited hemophilia A model', 'Factor VIII deficiency'],
    ];
    for (const [phrase, expected] of checkpoints) {
        const selected = bank.filter(q => q.type === 'multiple_choice' && q.question.includes(phrase) && !q.question.endsWith('Which statement fits this situation?'));
        assert.equal(selected.length, 1, phrase);
        const q = selected[0];
        assert.equal(q.options[q.correct[0]], expected, q.id);
    }
});

test('every authored question renders valid Discord payloads with hidden answers', async () => {
    const banks = await loadQuestionBanks();
    for (const [topicId, questions] of banks) for (const question of questions) {
        const session = createStudySession('render', 'student', [question], topicId);
        const message = questionMessage(session);
        const embed = message.embeds[0].toJSON();
        assert.ok(embed.description.length <= 4096, question.id);
        assert.ok(!embed.fields?.some(field => /correct answer/i.test(field.name)), question.id);
        assert.ok(message.components.length <= 5, question.id);
        for (const row of message.components) for (const component of row.toJSON().components) {
            assert.ok(component.custom_id.length <= 100, question.id);
            if (component.options) {
                assert.ok(component.options.length <= 25, question.id);
                for (const option of component.options) assert.ok(option.label.length <= 100, question.id);
            }
        }
    }
});

test('test replaces quiz within the 100-command limit and all interaction routes load', async () => {
    const { Collection } = await import('discord.js');
    const { loadCommands } = await import('../src/handlers/loaders/commandLoader.js');
    const { default: loadInteractions } = await import('../src/handlers/loaders/interactions.js');
    const client = { buttons: new Collection(), selectMenus: new Collection(), modals: new Collection() };
    await loadCommands(client);
    await loadInteractions(client);
    assert.ok(client.commands.has('test'));
    assert.ok(!client.commands.has('quiz'));
    assert.ok([...client.commands.values()].filter(command => !command.guildOnly).length <= 100, 'Discord permits 100 global commands');
    const command = client.commands.get('test').data.toJSON();
    assert.deepEqual(command.options ?? [], [], '/test should have no slash-command options');
    for (const type of ['buttons', 'selectMenus', 'modals']) assert.equal(client[type].get('study').execute, handleStudyInteraction);
    for (const name of ['quiz', 'quiznext']) assert.ok(client.buttons.has(name), `Legacy button missing: ${name}`);
    for (const name of ['quiz-subject-select', 'quiz-category-select', 'quiz-count-select']) assert.ok(client.selectMenus.has(name), `Legacy menu missing: ${name}`);
});


test('default /test opens all lecture, lab, TEAS and nursing classes with emojis', async () => {
    const { default: command } = await import('../src/commands/Community/test.js');
    const calls = [];
    await command.execute({ user: { id: 'u' }, options: { getBoolean: () => false }, async deferReply() {}, async editReply(payload) { calls.push(payload); } });
    const menu = calls[0].components[0].toJSON().components[0];
    assert.equal(menu.custom_id, 'study:class:u');
    assert.deepEqual(menu.options.map(option => option.label), STUDY_CLASSES.map(course => course.label));
    assert.equal(menu.options.length, 8);
    assert.ok(menu.options.every(option => option.emoji));
    const topics = topicMessage('u', new Map()).components[0].toJSON().components[0];
    assert.equal(topics.options.length, 24);
    assert.ok(topics.options.every(option => option.emoji));
    assert.match(topicMessage('u', new Map()).embeds[0].toJSON().title, /Lecture/);
    const counts = countMessage('u', 'Urinary System', 600, 'study:count:u:urinary').components[0].toJSON().components[0];
    assert.deepEqual(counts.options.map(option => Number(option.value)), [1, 5, 20, 50, 150, 600]);
    assert.ok(counts.options.every(option => option.emoji && option.description));
    assert.equal(selectQuestions(new Map([[topic.id, [mc]]]), topic.id, 1).length, 1);
});

test('A&P Lecture selection opens the new banks, then count selection', async () => {
    const interaction = fakeInteraction('', { values: ['ap_lecture'] });
    await handleStudyInteraction(interaction, {}, ['class', 'u']);
    const menu = interaction.calls.at(-1)[1].components[0].toJSON().components[0];
    assert.equal(menu.custom_id, 'study:topic:u');
    assert.ok(menu.options.some(option => option.value === 'urinary' && option.description === STUDY_TOPICS.find(topic => topic.id === 'urinary').description));
    const length = fakeInteraction('', { values: ['urinary'] });
    await handleStudyInteraction(length, {}, ['topic', 'u']);
    assert.equal(length.calls.at(-1)[1].components[0].toJSON().components[0].options[0].value, '1');
});

test('saved class categories are isolated by lecture/lab aliases and retain their categories', async () => {
    const calls = [];
    const saved = { id: 42, question: 'Which organism is studied here?', option_a: 'First', option_b: 'Second', option_c: 'Third', option_d: 'Fourth', correct_answer: 'B', explanation: 'The saved explanation.', difficulty: 'easy' };
    const client = { db: { pool: { async query(sql, params) {
        calls.push([sql, params]);
        return { rows: sql.startsWith('SELECT *') ? [saved] : [{ category: "Bacteria; do not execute", count: 10 }] };
    } } } };
    const categories = await loadClassCategories(client, 'micro_lecture');
    assert.deepEqual(calls[0][1][0], ['microbiologylecture', 'microbiology']);
    const token = categories[0].token;
    const questions = await loadClassQuestions(client, 'micro_lecture', token, 5);
    assert.equal(questions[0].explanation, saved.explanation);
    assert.deepEqual(questions[0].correct, [1]);
    assert.equal(calls.at(-1)[1][1], 'Bacteria; do not execute');
    assert.ok(!calls.at(-1)[0].includes('Bacteria;'));
    await loadClassCategories(client, 'micro_lab');
    assert.deepEqual(calls.at(-1)[1][0], ['microbiologylab', 'microbiologylaboratory']);
    await loadClassCategories(client, 'ap_lab');
    assert.ok(!calls.at(-1)[1][0].includes('anatomyphysiology'));
    await assert.rejects(loadClassQuestions(client, 'micro_lab', 'bad-token', 5), /Unknown class category/);
    const interaction = fakeInteraction('', { values: ['micro_lecture'] });
    await handleStudyInteraction(interaction, client, ['class', 'u']);
    assert.equal(interaction.calls.at(-1)[1].components[0].toJSON().components[0].custom_id, 'study:category:u:micro_lecture');
    const count = fakeInteraction('', { values: [token] });
    await handleStudyInteraction(count, client, ['category', 'u', 'micro_lecture']);
    assert.equal(count.calls.at(-1)[1].components[0].toJSON().components[0].custom_id, `study:coursecount:u:micro_lecture:${token}`);
    const start = fakeInteraction('', { values: ['1'] });
    await handleStudyInteraction(start, client, ['coursecount', 'u', 'micro_lecture', token]);
    assert.match(start.calls.at(-1)[1].embeds[0].toJSON().description, /Which organism/);
});

test('large saved category catalogs paginate within Discord limits and empty classes remain visible', () => {
    const categories = Array.from({ length: 61 }, (_, i) => ({ label: `Category ${i}`, count: 10, token: categoryToken(`Category ${i}`) }));
    const tokens = new Set();
    for (let page = 0; page < 3; page++) {
        const message = classCategoriesMessage('123456789012345678', 'chem_lab', categories, page);
        const options = message.components[0].toJSON().components[0].options;
        assert.ok(options.length <= 25);
        assert.ok(options.every(option => option.emoji));
        options.filter(option => option.value !== 'random').forEach(option => tokens.add(option.value));
        for (const row of message.components) for (const component of row.toJSON().components) assert.ok(component.custom_id.length <= 100);
    }
    assert.equal(tokens.size, 61);
    assert.match(classCategoriesMessage('u', 'ap_lab', []).embeds[0].toJSON().description, /No saved questions/);
    assert.ok(classMessage('u').components[0].toJSON().components[0].options.some(option => option.value === 'ap_lab'));
});

function walletFixture(initial = 3387) {
    let data = { wallet: initial, bank: 500, inventory: { book: 2 } };
    let writes = 0;
    const client = { db: {
        async get() { return structuredClone(data); },
        async set(key, value) { data = structuredClone(value); writes++; return true; },
    } };
    return { client, balance: () => data.wallet, data: () => data, writes: () => writes };
}

test('every question format earns 5–30 coins once and displays the wallet and progress', async () => {
    const wallet = walletFixture();
    let total = 0;
    for (const q of [mc, blank, order]) {
        const session = createStudySession('g', 'u', [q], topic.id);
        let action; let extras = {}; let choice;
        if (q.type === 'multiple_choice') { action = 'choice'; choice = String(q.correct[0]); }
        else if (q.type === 'fill_blank') { action = 'typed'; extras.fields = { getTextInputValue: () => q.answers[0] }; }
        else { action = 'ordered'; q.correct.forEach(value => chooseOrderItem(session, value)); }
        const args = [action, 'u', session.id, '0', String(session.revision), choice];
        const interaction = fakeInteraction('', extras);
        await Promise.all([
            handleStudyInteraction(interaction, wallet.client, args),
            handleStudyInteraction(fakeInteraction('', extras), wallet.client, args),
        ]);
        assert.equal(session.score, 1);
        assert.equal(session.moneyEarned, session.reward.amount);
    assert.ok(session.reward.amount >= 5 && session.reward.amount <= 30);
        const message = interaction.calls.find(call => call[0] === 'editReply')[1].embeds[0].toJSON();
        assert.ok(message.description.includes(`+${session.reward.amount} Merit Coins`));
        total += session.reward.amount;
        assert.match(message.description, /New Balance/);
        assert.ok(message.fields.some(field => field.name === 'Quiz Progress' && /Incorrect: \*\*0/.test(field.value)));
    }
    assert.equal(wallet.balance(), 3387 + total);
    assert.equal(wallet.writes(), 3);
    assert.equal(wallet.data().bank, 500);
    assert.equal(wallet.data().inventory.book, 2);
});

test('wrong answers show the current balance without awarding coins', async () => {
    const wallet = walletFixture();
    const session = createStudySession('g', 'u', [mc], topic.id);
    const interaction = fakeInteraction('');
    await handleStudyInteraction(interaction, wallet.client, ['choice', 'u', session.id, '0', '0', '0']);
    assert.equal(session.score, 0);
    assert.equal(session.moneyEarned, 0);
    assert.equal(wallet.balance(), 3387);
    assert.equal(wallet.writes(), 0);
    assert.match(interaction.calls.at(-1)[1].embeds[0].toJSON().description, /3,387 Merit Coins/);
});

test('coin-save failures are retryable without regrading or duplicate awards after a lost response', async () => {
    const wallet = walletFixture();
    const originalSet = wallet.client.db.set;
    let fail = true;
    wallet.client.db.set = async (...args) => {
        await originalSet(...args);
        if (fail) { fail = false; throw new Error('response lost after commit'); }
        return true;
    };
    const session = createStudySession('g', 'u', [mc, blank], topic.id);
    const interaction = fakeInteraction('');
    await handleStudyInteraction(interaction, wallet.client, ['choice', 'u', session.id, '0', '0', '1']);
    assert.equal(session.reward.status, 'failed');
    const originalAmount = session.reward.amount;
    assert.equal(session.moneyEarned, 0);
    assert.equal(wallet.balance(), 3387 + session.reward.amount);
    assert.throws(() => nextStudyQuestion(session), /not saved yet/);
    assert.match(interaction.calls.at(-1)[1].components[0].toJSON().components[0].label, /Retry coins/);
    await handleStudyInteraction(fakeInteraction(''), wallet.client, ['reward', 'u', session.id, '0', String(session.revision)]);
    assert.equal(session.reward.status, 'saved');
    assert.equal(session.reward.amount, originalAmount);
    assert.equal(session.moneyEarned, session.reward.amount);
    assert.ok(session.reward.amount >= 5 && session.reward.amount <= 30);
    assert.equal(wallet.balance(), 3387 + session.reward.amount);
    assert.equal(wallet.writes(), 1);
    assert.equal(session.score, 1);
    nextStudyQuestion(session);
    assert.equal(session.index, 1);
});

test('read failure never resets an existing wallet and concurrent study credits preserve both awards', async () => {
    const wallet = walletFixture();
    const originalGet = wallet.client.db.get;
    wallet.client.db.get = async () => { throw new Error('offline'); };
    const first = createStudySession('g', 'u', [mc], topic.id);
    submitStudyAnswer(first, [1]);
    await settleStudyReward(first, wallet.client);
    assert.equal(wallet.writes(), 0);
    assert.equal(first.moneyEarned, 0);
    wallet.client.db.get = originalGet;
    const second = createStudySession('g', 'u', [mc], topic.id);
    submitStudyAnswer(second, [1]);
    await Promise.all([settleStudyReward(first, wallet.client), settleStudyReward(second, wallet.client)]);
    assert.equal(wallet.balance(), 3387 + first.reward.amount + second.reward.amount);
    assert.equal(first.moneyEarned, first.reward.amount);
    assert.equal(second.moneyEarned, second.reward.amount);
});

test('database fallback never reports persistent coins and DM practice can still advance', async () => {
    const wallet = walletFixture(); wallet.client.db.useFallback = true;
    const session = createStudySession('g', 'u', [mc], topic.id);
    submitStudyAnswer(session, [1]);
    await settleStudyReward(session, wallet.client);
    assert.equal(session.reward.status, 'failed');
    assert.equal(wallet.writes(), 0);
    assert.ok(!resultMessage(session, true).embeds[0].toJSON().description.includes('You earned'));
    const dm = createStudySession(null, 'u', [mc, blank], topic.id);
    submitStudyAnswer(dm, [1]);
    await settleStudyReward(dm, wallet.client);
    nextStudyQuestion(dm);
    assert.equal(dm.index, 1);
});


test('all authored banks use only the three active formats with no select-all instructions', async () => {
    const banks = await loadQuestionBanks();
    for (const [id, questions] of banks) for (const q of questions) {
        assert.ok(['multiple_choice', 'fill_blank', 'ordering'].includes(q.type), q.id);
        assert.doesNotMatch(q.question, /select all that apply|select both correct|select every correct/i, q.id);
        if (q.type === 'multiple_choice') assert.equal(q.correct.length, 1, q.id);
    }
    await assert.rejects(async () => validateQuestion(multi, topic), /unsupported question type/);
});

test('introductory Circulatory sequence keys match flow, conduction, and wall reference models', async () => {
    const bank = (await loadQuestionBanks()).get('circulatory');
    assert.equal(bank.length, 600);
    assert.ok(bank.every(q => ['easy', 'medium'].includes(q.difficulty)));
    assert.ok(bank.filter(q => q.type === 'ordering').every(q => q.options.length >= 3 && q.options.length <= 5));
    const references = [
        ['blood flow from body veins to lung capillaries', ['Vena cava', 'Right atrium', 'Tricuspid valve', 'Right ventricle', 'Pulmonary valve', 'Pulmonary trunk', 'Pulmonary artery', 'Lung capillaries'], 28],
        ['blood flow from the pulmonary veins toward body tissues', ['Pulmonary vein', 'Left atrium', 'Mitral valve', 'Left ventricle', 'Aortic valve', 'Aorta', 'Systemic capillaries'], 21],
        ['normal cardiac conduction route', ['SA node', 'AV node', 'AV bundle', 'Bundle branches', 'Purkinje fibers'], 10],
        ['one simple cardiac-cycle model beginning with ventricular filling', ['Ventricular filling', 'Atrial systole', 'Isovolumetric contraction', 'Ventricular ejection', 'Isovolumetric relaxation'], 10],
        ['heart-wall structures from outside toward the chamber lining', ['Pericardial cavity', 'Epicardium', 'Myocardium', 'Endocardium'], 6],
    ];
    let checked = 0;
    for (const [phrase, reference, count] of references) {
        const selected = bank.filter(q => q.question.includes(phrase));
        assert.equal(selected.length, count, phrase);
        for (const q of selected) {
            const ranks = q.options.map(option => reference.indexOf(option));
            assert.ok(ranks.every(rank => rank >= 0), q.id);
            if (q.type === 'ordering') assert.deepEqual(q.correct.map(index => ranks[index]), [...ranks].sort((a, b) => a - b), q.id);
            else assert.equal(ranks[q.correct[0]], Math.min(...ranks), q.id);
            checked++;
        }
    }
    assert.equal(checked, 75);
});

test('introductory Circulatory arithmetic supplies formulas and has independently correct keys', async () => {
    const bank = (await loadQuestionBanks()).get('circulatory');
    const output = bank.filter(q => q.question.startsWith('Cardiac output ='));
    assert.equal(output.length, 5);
    for (const q of output) {
        const match = q.question.match(/heart rate is (\d+) beats\/min and stroke volume is (\d+) mL\/beat/);
        assert.ok(match, q.id);
        assert.equal(q.options[q.correct[0]], `${Number(match[1]) * Number(match[2])} mL/min`, q.id);
    }
    const stroke = bank.filter(q => q.question.startsWith('Stroke volume ='));
    assert.equal(stroke.length, 3);
    for (const q of stroke) {
        const match = q.question.match(/volumes are (\d+) mL and (\d+) mL/);
        assert.ok(match, q.id);
        assert.equal(q.options[q.correct[0]], `${Number(match[1]) - Number(match[2])} mL/beat`, q.id);
    }
});

test('public questions keep answers and rewards private and reject spectators', async () => {
    const posted = [];
    const start = fakeInteraction('', { values: ['1'], async followUp(payload) { posted.push(payload); return { id: 'public-question' }; } });
    await handleStudyInteraction(start, {}, ['count', 'u', topic.id]);
    assert.equal(posted.length, 1);
    assert.equal(posted[0].flags, 0);
    const control = posted[0].components.flatMap(row => row.toJSON().components)[0];
    const args = control.custom_id.split(':').slice(1);
    const session = getStudySession('g', 'u', args[2]);
    assert.equal(session.publicQuestionId, 'public-question');
    const stranger = fakeInteraction('', { user: { id: 'spectator' } });
    await handleStudyInteraction(stranger, {}, args);
    assert.equal(session.answered, false);
    assert.equal(stranger.calls[0][1].flags, 64);
    const edits = [];
    const q = session.questions[0];
    const answer = fakeInteraction('', { webhook: { async editMessage(id, payload) { edits.push([id, payload]); } },
        fields: { getTextInputValue: () => q.answers?.[0] } });
    let answerArgs;
    if (q.type === 'ordering') {
        q.correct.forEach(value => chooseOrderItem(session, value));
        answerArgs = ['ordered', 'u', session.id, '0', String(session.revision)];
    } else answerArgs = [q.type === 'fill_blank' ? 'typed' : 'choice', 'u', session.id, '0', String(session.revision), String(q.correct?.[0])];
    await handleStudyInteraction(answer, walletFixture().client, answerArgs);
    assert.deepEqual(edits, [['public-question', { components: [] }]]);
    const feedback = answer.calls.find(([type]) => type === 'followUp')[1];
    assert.equal(feedback.flags, 64);
    assert.match(feedback.embeds[0].toJSON().title, /Correct/);
});

test('multiple choice letters match shuffled answer buttons and preserve grading values', () => {
    const question = { ...mc, options: ['First', 'Second', 'Third', 'Fourth'], correct: [2] };
    const session = createStudySession('letters-guild', 'letters-user', [question], topic.id);
    const payload = questionMessage(session);
    const buttons = payload.components.flatMap(row => row.toJSON().components);
    assert.deepEqual(buttons.map(button => button.label), ['A', 'B', 'C', 'D']);
    session.displayOrder.forEach((value, index) => {
        assert.ok(payload.embeds[0].toJSON().description.includes(`**${String.fromCharCode(65 + index)}.** ${question.options[value]}`));
        assert.equal(buttons[index].custom_id.split(':').at(-1), String(value));
    });
});

test('ordering questions also use letters in options, selection menus, and chosen order', () => {
    const session = createStudySession('order-letters', 'u', [order], topic.id);
    const first = session.displayOrder[0];
    let message = questionMessage(session);
    assert.ok(message.embeds[0].toJSON().description.includes(`**A.** ${order.options[first]}`));
    const menu = message.components[0].toJSON().components[0];
    assert.equal(menu.options[0].label, `A. ${order.options[first]}`);
    assert.equal(menu.options[0].value, String(first));
    chooseOrderItem(session, first);
    message = questionMessage(session);
    assert.match(message.embeds[0].toJSON().description, /\*\*Your order:\*\* A/);
});

test('Merit Coin weights cover 5 through 30 and strictly favor every higher amount', async () => {
    const { rollMeritReward } = await import('../src/utils/meritRewards.js');
    const counts = new Map();
    for (let roll = 0; roll < 351; roll++) {
        const amount = rollMeritReward(max => { assert.equal(max, 351); return roll; });
        counts.set(amount, (counts.get(amount) || 0) + 1);
    }
    assert.equal(counts.size, 26);
    for (let amount = 5; amount <= 30; amount++) assert.equal(counts.get(amount), amount - 4);
});

async function withLabPhotoFixtures(run) {
    const { mkdir, copyFile, access, unlink } = await import('node:fs/promises');
    const { LAB_MODELS } = await import('../src/services/study/labModels.js');
    const directory = new URL('../study-assets/lab-models/', import.meta.url);
    await mkdir(directory, { recursive: true });
    const created = [];
    try {
        for (const model of LAB_MODELS) {
            const target = new URL(model.expectedImageFile, directory);
            try { await access(target); }
            catch {
                await copyFile(new URL('../study-assets/843e25e2bf357a44015b.jpg', import.meta.url), target);
                created.push(target);
            }
        }
        await run();
    } finally { for (const target of created) await unlink(target); }
}

test('Anatomy Lab opens category → grouped model set → answer mode without a database', async () => withLabPhotoFixtures(async () => {
    const course = fakeInteraction('', { values: ['ap_lab'] });
    await handleStudyInteraction(course, {}, ['class', 'u']);
    const category = course.calls.at(-1)[1].components[0].toJSON().components[0];
    assert.equal(category.custom_id, 'study:labcategory:u');
    assert.equal(category.options[0].label, 'Reproductive System');
    const models = fakeInteraction('', { values: ['reproductive'] });
    await handleStudyInteraction(models, {}, ['labcategory', 'u']);
    const picker = models.calls.at(-1)[1].components[0].toJSON().components[0];
    assert.equal(picker.options.length, 2);
    assert.ok(picker.options.some(option => option.value === 'male-reproductive' && option.label === '3D Model of Male Reproductive System'));
    assert.equal(picker.options[0].label, 'Early Development Models');
    assert.equal(picker.options[0].value, 'early-development');
    const mode = fakeInteraction('', { values: ['early-development'] });
    await handleStudyInteraction(mode, {}, ['labmodels', 'u']);
    const modes = mode.calls.at(-1)[1].components[0].toJSON().components[0];
    assert.equal(modes.custom_id, 'study:labmode:u:early-development');
    assert.deepEqual(modes.options.map(option => option.value), ['multiple_choice', 'typed']);
    for (const answerMode of ['multiple_choice', 'typed']) {
        const start = fakeInteraction('', { values: [answerMode] });
        await handleStudyInteraction(start, {}, ['labmode', 'u', 'early-development']);
        const publicQuestion = start.calls.find(([type]) => type === 'followUp')[1];
        assert.equal(publicQuestion.flags, 0);
        const control = publicQuestion.components[0].toJSON().components[0];
        const args = control.custom_id.split(':').slice(1);
        const session = getStudySession('g', 'u', args[2]);
        assert.equal(session.classId, 'ap_lab');
        assert.equal(new Set(session.questions.map(q => q.labModelId)).size, 8);
        if (answerMode === 'typed') {
            assert.equal(control.label, 'Enter answer');
            assert.ok(session.questions.every(q => q.type === 'fill_blank' && !q.options));
            const question = session.questions.find(q => q.labModelId === 'implantation');
            assert.equal(gradeQuestion(question, 'IMPLANTATION'), true);
            assert.equal(gradeQuestion(question, 'myometrium'), false);
        } else {
            assert.deepEqual(publicQuestion.components[0].toJSON().components.map(button => button.label), ['A', 'B', 'C', 'D']);
        }
    }
}));

test('lab model selection and mode reject invalid values and foreign users', async () => {
    const { labQuestions, labModeMessage, LAB_MODELS } = await import('../src/services/study/labModels.js');
    assert.throws(() => labQuestions('0,0', 'typed'), /Unknown model/);
    assert.throws(() => labQuestions('8', 'typed'), /Unknown model/);
    assert.throws(() => labQuestions('', 'typed'), /Unknown model/);
    assert.throws(() => labQuestions('0', 'invalid'), /Unknown answer mode/);
    const all = labModeMessage('123456789012345678', '0,1,2,3,4,5,6,7');
    for (const row of all.components) for (const component of row.toJSON().components) assert.ok(component.custom_id.length <= 100);
    assert.equal(LAB_MODELS.length, 8);
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('0,1,2,3,4,5,6,7', mode);
        assert.ok(questions.length >= 8);
        for (const q of questions) {
            assert.ok(q.explanation);
            assert.ok(q.labModelId);
            if (mode === 'typed') assert.ok(q.answers.length);
            else { assert.equal(q.options.length, 4); assert.equal(gradeQuestion(q, q.correct), true); }
        }
    }
    const stranger = fakeInteraction('', { user: { id: 'someone-else' }, values: ['0'] });
    await handleStudyInteraction(stranger, {}, ['labmodels', 'u']);
    assert.match(stranger.calls[0][1].content, /another student/);
});

test('typed lab questions open a modal and award coins once for a valid synonym', async () => {
    const { labQuestions } = await import('../src/services/study/labModels.js');
    const question = labQuestions('4', 'typed')[0];
    const session = createStudySession('g', 'u', [question], 'lab_reproductive');
    session.publicQuestionId = 'lab-public-question';
    const modal = fakeInteraction('');
    await handleStudyInteraction(modal, {}, ['blank', 'u', session.id, '0', '0']);
    assert.equal(modal.calls[0][0], 'showModal');
    const wallet = walletFixture();
    const interaction = fakeInteraction('', {
        fields: { getTextInputValue: () => '2 cell stage' },
        webhook: { async editMessage(id, payload) { assert.equal(id, 'lab-public-question'); assert.deepEqual(payload.components, []); } },
    });
    const args = ['typed', 'u', session.id, '0', '0'];
    await handleStudyInteraction(interaction, wallet.client, args);
    await handleStudyInteraction(fakeInteraction(''), wallet.client, args);
    assert.equal(session.score, 1);
    assert.equal(wallet.writes(), 1);
    assert.ok(session.moneyEarned >= 5 && session.moneyEarned <= 30);
    assert.equal(interaction.calls.find(([type]) => type === 'followUp')[1].flags, 64);
});

test('grouped set contains exactly eight stage-only questions in both modes', async () => {
    const { labQuestions, labModeMessage, LAB_MODELS } = await import('../src/services/study/labModels.js');
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('early-development', mode);
        assert.equal(questions.length, 8);
        assert.equal(new Set(questions.map(q => q.labModelId)).size, 8);
        assert.ok(questions.every(q => q.requiresModelImage && /^What(?: (?:is|has)|'s)/.test(q.question)));
        for (const q of questions) {
            const display = questionMessage(createStudySession('stages', 'u', [q], 'lab_reproductive'));
            assert.ok(!display.embeds[0].toJSON().description.includes(`Model: ${q.modelName}`), 'Do not reveal the stage name before answering');
        }
    }
    assert.ok(LAB_MODELS.every(model => model.questions.length === 1));
    const menu = labModeMessage('u', 'early-development');
    assert.match(menu.embeds[0].toJSON().description, /all 8 photos/);
});

test('a stage-only quiz cannot publish an identification question without its photo', async () => {
    const { labModelImage } = await import('../src/services/study/labModels.js');
    if (labModelImage({ labModelId: 'oocyte' })) return;
    const start = fakeInteraction('', { values: ['multiple_choice'] });
    await handleStudyInteraction(start, {}, ['labmode', 'u', 'early-development']);
    assert.equal(start.calls.length, 1);
    assert.equal(start.calls[0][0], 'reply');
    assert.equal(start.calls[0][1].flags, 64);
    assert.match(start.calls[0][1].content, /needs its original photos/);
});

test('all eight installed original model photos attach inline in both answer modes', async () => {
    const { LAB_MODELS, labQuestions, labModelImage } = await import('../src/services/study/labModels.js');
    const { readFile } = await import('node:fs/promises');
    const { createHash } = await import('node:crypto');
    const hashes = new Set();
    for (const model of LAB_MODELS) {
        const image = labModelImage({ labModelId: model.id });
        assert.ok(image, `${model.id} must have its photo installed`);
        const bytes = await readFile(image.path);
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        const hash = createHash('sha256').update(bytes).digest('hex');
        assert.equal(hash, model.imageSha256, `${model.id} must use the exact original photo`);
        hashes.add(hash);
    }
    assert.equal(hashes.size, 8);
    for (const mode of ['multiple_choice', 'typed']) for (const question of labQuestions('early-development', mode)) {
        const message = questionMessage(createStudySession('original-images', 'u', [question], 'lab_reproductive'));
        const image = labModelImage(question);
        assert.equal(message.files.length, 1);
        assert.equal(message.files[0].attachment, image.path);
        assert.equal(message.embeds[0].toJSON().image.url, `attachment://${image.asset.file}`);
        assert.deepEqual(message.attachments, []);
    }
});

test('Quizlet-style lab prompts use dashes and accept spelling slips without confusing stages', async () => {
    const { labQuestions } = await import('../src/services/study/labModels.js');
    const questions = labQuestions('early-development', 'typed');
    const by = id => questions.find(q => q.labModelId === id);
    for (const [id, answer] of [
        ['oocyte', 'secondry oocyte'], ['sperm-entry', 'fertilizaton'],
        ['pronuclei', 'pronucelar stage'], ['zygote', 'zyogte'],
        ['two-cell', 'two cells'], ['four-cell', '4 cel stage'], ['four-cell', '4cells'], ['sixteen-cell', '16 cells'],
        ['sixteen-cell', 'sixteen cell stgae'], ['implantation', 'blastocyst - burrowing into endometruim'],
        ['implantation', 'Blastocyst → burrowing into the endometrium'],
    ]) assert.equal(gradeQuestion(by(id), answer), true, `${id}: ${answer}`);
    for (const [id, answer] of [
        ['two-cell', '4 cell stage'], ['four-cell', 'two cell stage'],
        ['sixteen-cell', '6 cell stage'], ['zygote', 'oocyte'],
        ['implantation', 'morula'], ['implantation', 'not implantation'],
        ['two-cell', '2 or 4 cell stage'], ['zygote', ''], ['zygote', 'anything'],
    ]) assert.equal(gradeQuestion(by(id), answer), false, `${id}: ${answer}`);
    for (const q of labQuestions('early-development', 'multiple_choice')) {
        assert.ok(!q.options.some(option => /→|->/.test(option)));
        assert.match(q.question, /^What(?: (?:is|has)|'s)/);
    }
    assert.equal(gradeQuestion(blank, 'parasympathetci'), false, 'Unrelated lecture grading remains unchanged');
});

test('model answers stay as short as the supplied Quizlet labels', async () => {
    const { LAB_MODELS } = await import('../src/services/study/labModels.js');
    const expected = [
        'Secondary oocyte - sperm breaking through',
        'Fertilization occurring - sperm entering oocyte',
        'Pronuclei - moving together', 'Zygote created - divides',
        '2 cell stage', '4 cell stage', '16 cell stage',
        'Blastocyst - burrowing into endometrium',
    ];
    assert.deepEqual(LAB_MODELS.map(m => m.questions[0].options[0]), expected);
    for (const model of LAB_MODELS) {
        const q = model.questions[0];
        assert.ok(q.options.every(answer => answer.length <= 50));
        assert.ok(q.explanation.length <= 90);
        assert.ok(q.typedAnswers.includes(q.options[0]));
    }
});

test('Respiratory Tract retains its 25-image set alongside the lungs set and both quiz modes attach cyan-arrow photos', async () => {
    const { labCategoryMessage, labModelsMessage, labModeMessage, labQuestions, labModelImage, LAB_SETS } = await import('../src/services/study/labModels.js');
    const { readFile } = await import('node:fs/promises');
    const { createHash } = await import('node:crypto');
    const categories = labCategoryMessage('u').components[0].toJSON().components[0].options;
    assert.ok(categories.some(category => category.label === 'Respiratory Tract' && category.value === 'respiratory'));
    const sets = labModelsMessage('u', 'respiratory').components[0].toJSON().components[0].options;
    assert.deepEqual(sets.map(set => set.label), ['3D Model of Larynx Posterior view', 'Upper Respiratory 3D Model', 'Lungs and Larynx 3D Model', 'Bronchial Tree 3D Model']);
    assert.ok(sets.some(set => set.value === 'upper-respiratory'));
    const mode = labModeMessage('u', 'upper-respiratory');
    assert.equal(mode.components[1].toJSON().components[0].custom_id, 'study:labcategory:u:respiratory');
    const models = LAB_SETS.find(set => set.id === 'upper-respiratory').models;
    assert.equal(models.length, 25);
    const hashes = new Set();
    for (const model of models) {
        const figure = labModelImage({ labModelId: model.id });
        assert.ok(figure);
        assert.match(figure.asset.file, /^ur-\d{2}\.png$/, 'Image filenames cannot reveal answers');
        const bytes = await readFile(figure.path);
        const hash = createHash('sha256').update(bytes).digest('hex');
        assert.equal(hash, model.imageSha256, 'Use the verified original-photo arrow overlay');
        hashes.add(hash);
    }
    assert.equal(hashes.size, 25);
    for (const answerMode of ['multiple_choice', 'typed']) {
        const start = fakeInteraction('', { values: [answerMode] });
        await handleStudyInteraction(start, {}, ['labmode', 'u', 'upper-respiratory']);
        const payload = start.calls.find(([type]) => type === 'followUp')[1];
        const args = payload.components[0].toJSON().components[0].custom_id.split(':').slice(1);
        const session = getStudySession('g', 'u', args[2]);
        assert.equal(session.questions.length, 25);
        assert.equal(session.topicId, 'lab_respiratory');
        assert.match(session.topicLabel, /Respiratory Tract.*Upper Respiratory/);
        assert.equal(payload.flags, 0);
        assert.equal(payload.files.length, 1);
        assert.match(payload.embeds[0].toJSON().image.url, /^attachment:\/\/ur-\d{2}\.png$/);
        assert.equal(session.questions.filter(q => q.questionKind === 'location').length, 3);
        assert.ok(session.questions.every(q => q.questionKind === 'location' || q.question === 'What structure is indicated by the arrow?'));
        if (answerMode === 'multiple_choice') assert.deepEqual(payload.components[0].toJSON().components.map(button => button.label), ['A', 'B', 'C', 'D']);
        else assert.equal(payload.components[0].toJSON().components[0].label, 'Enter answer');
    }
    const category = fakeInteraction('', { values: ['respiratory'] });
    await handleStudyInteraction(category, {}, ['labcategory', 'u']);
    assert.match(category.calls.at(-1)[1].embeds[0].toJSON().title, /Respiratory Tract/);
    assert.throws(() => labModelsMessage('u', 'unknown'), /Unknown lab category/);
    assert.equal(labQuestions('early-development', 'typed').length, 8, 'Existing reproductive set remains separate');
});

test('respiratory typed answers accept synonyms and typos while protecting nearby structures', async () => {
    const { labQuestions } = await import('../src/services/study/labModels.js');
    const questions = labQuestions('upper-respiratory', 'typed');
    const by = name => questions.find(q => q.modelName === name);
    for (const [name, answer] of [
        ['Pharyngeal tonsil', 'adenoids'], ['External nares', 'nostrils'],
        ['Internal nares', 'choanae'], ['Vestibular fold', 'false vocal fold'],
        ['Vocal fold', 'true vocal cord'], ['Esophagus', 'oesophagus'],
        ['Epiglottis', 'epiglotis'], ['Superior concha', 'superior turbinate'],
        ['Vestibule', 'nasal vestibule'],
    ]) assert.equal(gradeQuestion(by(name), answer), true, `${name}: ${answer}`);
    for (const [name, answer] of [
        ['Internal nares', 'external nares'], ['External nares', 'internal nares'],
        ['Superior concha', 'inferior concha'], ['Vocal fold', 'vestibular fold'],
        ['Vestibule', 'oral vestibule'], ['Trachea', 'esophagus'],
    ]) assert.equal(gradeQuestion(by(name), answer), false, `${name}: ${answer}`);
});

test('respiratory adjustments remove excluded terms and include pharynx-location practice without extra questions', async () => {
    const { LAB_SETS, labQuestions } = await import('../src/services/study/labModels.js');
    const set = LAB_SETS.find(set => set.id === 'upper-respiratory');
    assert.equal(set.models.length, 25);
    assert.ok(set.models.every(model => model.questions.length === 1), 'Exactly one question per image');
    assert.ok(!set.models.some(model => ['Soft palate', 'Cribriform plate of ethmoid', 'Fauces'].includes(model.name)));
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('upper-respiratory', mode);
        assert.equal(questions.length, 25);
        const locations = questions.filter(q => q.questionKind === 'location');
        assert.equal(locations.length, 3);
        for (const q of locations) {
            assert.ok(/behind the (?:nasal cavity|oral cavity|larynx)/.test(q.question));
            const correct = mode === 'typed' ? q.answers[0] : q.options[q.correct[0]];
            assert.equal(correct, q.modelName);
            assert.equal(gradeQuestion(q, mode === 'typed' ? correct : q.correct), true);
        }
        if (mode === 'multiple_choice') for (const q of questions) {
            assert.equal(q.options.length, 4);
            assert.equal(new Set(q.options).size, 4);
            assert.ok(!q.options.some(option => ['Soft palate', 'Cribriform plate of ethmoid', 'Fauces'].includes(option)));
        }
    }
});

for (const [manifest, count, width, height = 1024] of [['upper-respiratory', 25, 761], ['lungs-larynx', 17, 821], ['bronchial-tree', 7, 763], ['kidney', 19, 811], ['urinary-system', 6, 771], ['nephron-1', 18, 702], ['nephron-2', 11, 636], ['lower-urinary', 9, 618], ['larynx-posterior', 6, 768], ['stomach', 12, 768], ['upper-gi', 9, 740], ['digestive-system', 25, 532], ['stomach-layers', 10, 768], ['teeth', 10, 592], ['pancreas', 6, 1024, 827], ['ileum', 12, 655, 1002], ['liver', 11, 981], ['male-reproductive', 15, 825]]) {
    test(`${manifest} cards preserve original anatomy pixel-for-pixel outside their arrows`, async () => {
        const { PNG } = await import('pngjs');
        const { readFile } = await import('node:fs/promises');
        const { createHash } = await import('node:crypto');
        const data = JSON.parse(await readFile(new URL(`../study-data/lab-models/${manifest}.json`, import.meta.url), 'utf8'));
        const source = await readFile(new URL(`../study-assets/lab-models/${data.sourceImageFile}`, import.meta.url));
        assert.equal(createHash('sha256').update(source).digest('hex'), data.sourceImageSha256);
        const original = PNG.sync.read(source);
        assert.equal(original.width, width);
        assert.equal(original.height, height);
        assert.equal(data.models.length, count);
        if (manifest === 'upper-respiratory') assert.ok(!data.models.some(model => model.name === 'Fauces'));
        function nearPolygon(x, y, vertices) {
            let inside = false;
            for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
                const [ax, ay] = vertices[j], [bx, by] = vertices[i];
                if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
                const dx = bx - ax, dy = by - ay;
                const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
                if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= 1.5) return true;
            }
            return inside;
        }
        for (const model of data.models) {
            const raw = await readFile(new URL(`../study-assets/lab-models/${model.expectedImageFile}`, import.meta.url));
            assert.equal(createHash('sha256').update(raw).digest('hex'), model.imageSha256);
            const image = PNG.sync.read(raw);
            assert.equal(model.renderMethod, 'original-photo-arrow-overlay');
            assert.equal(image.width, original.width);
            assert.equal(image.height, original.height);
            let changed = 0;
            for (let pixel = 0; pixel < image.width * image.height; pixel++) {
                const i = pixel * 4;
                if (image.data[i] !== original.data[i] || image.data[i + 1] !== original.data[i + 1] || image.data[i + 2] !== original.data[i + 2]) {
                    changed++;
                    assert.ok((model.annotation.overlayPolygons || [model.annotation.overlayPolygon]).some(polygon => nearPolygon(pixel % image.width, Math.floor(pixel / image.width), polygon)), `${model.id}: anatomy changed outside arrow at pixel ${pixel}`);
                    const rgb = [...image.data.subarray(i, i + 3)];
                    assert.ok(rgb.every(value => value === 0) || rgb.join(',') === '0,229,255', 'Changes must contain only black outline or cyan pointer pixels');
                }
            }
            assert.ok(changed > 0 && changed < image.width * image.height * 0.02);
        }
    });

}

test('lungs and larynx set offers all 17 structures in both answer modes with original-image attachments', async () => {
    const { LAB_SETS, labQuestions, labModelImage, labModeMessage } = await import('../src/services/study/labModels.js');
    const set = LAB_SETS.find(set => set.id === 'lungs-larynx');
    assert.equal(set.models.length, 17);
    assert.equal(new Set(set.models.map(model => model.id)).size, 17);
    assert.ok(set.models.some(model => model.name === 'Thyrohyoid membrane'));
    assert.ok(set.models.some(model => model.name === 'Right middle lobe'));
    const mode = labModeMessage('u', set.id);
    assert.equal(mode.components[1].toJSON().components[0].custom_id, 'study:labcategory:u:respiratory');
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions(set.id, mode);
        assert.equal(questions.length, 17);
        for (const question of questions) {
            assert.ok(labModelImage(question));
            if (mode === 'multiple_choice') {
                assert.equal(question.options.length, 4);
                assert.equal(question.options[question.correct[0]], question.modelName);
            } else {
                assert.equal(question.type, 'fill_blank');
                assert.ok(question.answers.length > 0);
            }
        }
        assert.ok(!questions.some(q => q.modelName === 'Trachea'));
        const carina = questions.find(q => q.modelName === 'Carina');
        assert.ok(carina);
        assert.match(carina.question, /internal ridge/);
        if (mode === 'typed') {
            const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
            assert.ok(matchesLabAnswer('carina', carina.answers, carina.competingAnswers));
            assert.ok(matchesLabAnswer('corina', carina.answers, carina.competingAnswers));
            assert.ok(!matchesLabAnswer('trachea', carina.answers, carina.competingAnswers));
        }
    }
});


test('bronchial tree set supports seven pictured structures and bronchial aliases in both modes', async () => {
    const { labQuestions, labModelImage, labModeMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.equal(labModeMessage('u', 'bronchial-tree').components[1].toJSON().components[0].custom_id, 'study:labcategory:u:respiratory');
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('bronchial-tree', mode);
        assert.equal(questions.length, 7);
        for (const q of questions) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') {
                assert.equal(q.options.length, 4);
                assert.equal(q.options[q.correct[0]], q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, alias] of [['Left primary bronchus', 'left main bronchus'], ['Right primary bronchus', 'right mainstem bronchus'], ['Left secondary bronchi', 'left lobar bronchi'], ['Left tertiary bronchi', 'left segmental bronchi']]) {
                const q = questions.find(q => q.modelName === name);
                assert.ok(matchesLabAnswer(alias, q.answers, q.competingAnswers));
            }
            const left = questions.find(q => q.modelName === 'Left primary bronchus');
            assert.ok(!matchesLabAnswer('right primary bronchus', left.answers, left.competingAnswers));
        }
    }
});


test('Urinary System offers 19 kidney structures in both modes with vessel and collecting-system distinctions', async () => {
    const { labCategoryMessage, labModelsMessage, labQuestions, labModelImage, labModeMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labCategoryMessage('u').components[0].toJSON().components[0].options.some(o => o.value === 'urinary' && o.label === 'Urinary System'));
    assert.ok(labModelsMessage('u', 'urinary').components[0].toJSON().components[0].options.some(option => option.value === 'kidney'));
    assert.equal(labModeMessage('u', 'kidney').components[1].toJSON().components[0].custom_id, 'study:labcategory:u:urinary');
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('kidney', mode);
        assert.equal(questions.length, 19);
        assert.equal(new Set(questions.map(q => q.labModelId)).size, 19);
        for (const q of questions) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') {
                assert.equal(q.options.length, 4);
                assert.equal(q.options[q.correct[0]], q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, alias, wrong] of [['Interlobular artery', 'cortical radiate artery', 'interlobar artery'], ['Interlobular vein', 'cortical radiate vein', 'interlobar vein'], ['Major calyx', 'major calyces', 'minor calyx'], ['Minor calyx', 'minor calyces', 'major calyx'], ['Renal cortex', 'cortex', 'medulla']]) {
                const q = questions.find(q => q.modelName === name);
                assert.ok(matchesLabAnswer(alias, q.answers, q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong, q.answers, q.competingAnswers));
            }
        }
    }
});


test('extended urinary-system set groups six pictured structures in both answer modes', async () => {
    const { labQuestions, labModelImage, labModeMessage, labModelsMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'urinary').components[0].toJSON().components[0].options.some(o => o.value === 'urinary-system'));
    assert.equal(labModeMessage('u', 'urinary-system').components[1].toJSON().components[0].custom_id, 'study:labcategory:u:urinary');
    for (const mode of ['multiple_choice', 'typed']) {
        const qs = labQuestions('urinary-system', mode);
        assert.equal(qs.length, 6);
        assert.deepEqual(qs.map(q => q.modelName).sort(), ['Left kidney','Renal vein','Renal artery','Ureter','Urinary bladder','Urethra'].sort());
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') {
                assert.equal(q.options.length, 4);
                assert.equal(q.options[q.correct[0]], q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, wrong] of [['Ureter','urethra'], ['Urethra','ureter'], ['Renal artery','renal vein'], ['Left kidney','right kidney']]) {
                const q = qs.find(q => q.modelName === name);
                assert.ok(!matchesLabAnswer(wrong, q.answers, q.competingAnswers));
            }
        }
    }
});


test('Nephron Model 1 includes 18 pictured structures with short aliases and protected vessel and tubule distinctions', async () => {
    const { labQuestions, labModelImage, labModelsMessage, labModeMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'urinary').components[0].toJSON().components[0].options.some(o => o.value === 'nephron-1' && o.label === 'Nephron Model 1'));
    assert.equal(labModeMessage('u', 'nephron-1').components[1].toJSON().components[0].custom_id, 'study:labcategory:u:urinary');
    for (const mode of ['multiple_choice', 'typed']) {
        const qs = labQuestions('nephron-1', mode);
        assert.equal(qs.length, 18);
        assert.equal(new Set(qs.map(q => q.labModelId)).size, 18);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') {
                assert.equal(q.options.length, 4);
                assert.equal(q.options[q.correct[0]], q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, alias, wrong] of [['P.C.T.', 'proximal convoluted tubule', 'DCT'], ['D.C.T.', 'distal convoluted tubule', 'PCT'], ['Afferent arteriole', 'afferent', 'efferent arteriole'], ['Interlobular artery', 'cortical radiate artery', 'interlobar artery'], ["Bowman's capsule", 'glomerular capsule', 'glomerulus'], ['Renal corpuscle', 'renal corpuscle', 'glomerulus']]) {
                const q = qs.find(q => q.modelName === name);
                assert.ok(matchesLabAnswer(alias, q.answers, q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong, q.answers, q.competingAnswers));
            }
        }
    }
});


test('Nephron Model 2 groups eleven corpuscle details in both modes and protects nearby structures', async () => {
    const { labQuestions, labModelImage, labModeMessage, labModelsMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'urinary').components[0].toJSON().components[0].options.some(o => o.value === 'nephron-2'));
    assert.equal(labModeMessage('u', 'nephron-2').components[1].toJSON().components[0].custom_id, 'study:labcategory:u:urinary');
    for (const mode of ['multiple_choice', 'typed']) {
        const qs = labQuestions('nephron-2', mode);
        assert.equal(qs.length, 11);
        assert.equal(new Set(qs.map(q => q.labModelId)).size, 11);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') {
                assert.equal(q.options.length, 4);
                assert.equal(q.options[q.correct[0]], q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, alias, wrong] of [['Pedicels','foot processes','podocyte'], ['Capsule space','capsular space',"Bowman's capsule"], ['Podocyte nucleus','nucleus of podocyte','podocyte'], ['P.C.T.','proximal convoluted tubule','DCT'], ['D.C.T.','distal convoluted tubule','PCT'], ['Efferent arteriole','efferent','afferent arteriole']]) {
                const q = qs.find(q => q.modelName === name);
                assert.ok(matchesLabAnswer(alias, q.answers, q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong, q.answers, q.competingAnswers));
            }
        }
    }
});


test('lower urinary model has nine pictured structures and identifies the visible prostatic urethra', async () => {
    const { labQuestions, labModelImage, labModeMessage, labModelsMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'urinary').components[0].toJSON().components[0].options.some(o => o.value === 'lower-urinary' && o.label === '3D Model of the Ureters, Urinary Bladder, and Urethra'));
    assert.equal(labModeMessage('u', 'lower-urinary').components[1].toJSON().components[0].custom_id, 'study:labcategory:u:urinary');
    for (const mode of ['multiple_choice','typed']) {
        const qs = labQuestions('lower-urinary', mode);
        assert.equal(qs.length, 9);
        assert.equal(new Set(qs.map(q => q.labModelId)).size, 9);
        assert.ok(qs.some(q => q.modelName === 'Prostatic urethra'));
        assert.ok(!qs.some(q => q.modelName === 'Spongy urethra'));
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') {
                assert.equal(q.options.length, 4);
                assert.equal(q.options[q.correct[0]], q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, alias, wrong] of [['Ureteral openings','ureteric orifices','internal urethral orifice'],['Internal urethral sphincter','internal sphincter','internal urethral orifice'],['Prostatic urethra','prostatic part of urethra','spongy urethra'],['Detrusor muscle','detrusor','rugae']]) {
                const q=qs.find(q=>q.modelName===name);
                assert.ok(matchesLabAnswer(alias,q.answers,q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong,q.answers,q.competingAnswers));
            }
        }
    }
});


test('posterior larynx set contains six referenced structures and preserves the small-cartilage distinction', async () => {
    const { labQuestions, labModelImage, labModelsMessage, labModeMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'respiratory').components[0].toJSON().components[0].options.some(o => o.value === 'larynx-posterior'));
    assert.equal(labModeMessage('u', 'larynx-posterior').components[1].toJSON().components[0].custom_id, 'study:labcategory:u:respiratory');
    const startScreen = labModeMessage('u', 'larynx-posterior').embeds[0].toJSON().description;
    for (const name of ['Epiglottis','Cricoid cartilage','Arytenoid cartilage','Corniculate cartilage','Cuneiform cartilage','Hyoid bone']) assert.ok(startScreen.includes(name));
    for (const mode of ['multiple_choice','typed']) {
        const qs = labQuestions('larynx-posterior', mode);
        assert.equal(qs.length, 6);
        assert.equal(new Set(qs.map(q => q.labModelId)).size, 6);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') {
                assert.equal(q.options.length, 4);
                assert.equal(q.options[q.correct[0]], q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        const cuneiform = qs.find(q => q.modelName === 'Cuneiform cartilage');
        assert.match(cuneiform.question, /Quizlet/);
        assert.match(cuneiform.question, /circle/);
        assert.match(qs.find(q => q.modelName === 'Corniculate cartilage').question, /circled/);
        assert.match(cuneiform.explanation, /aryepiglottic fold/);
        if (mode === 'typed') {
            assert.ok(!matchesLabAnswer('corniculate cartilage', cuneiform.answers, cuneiform.competingAnswers));
            const corniculate=qs.find(q=>q.modelName==='Corniculate cartilage');
            assert.ok(!matchesLabAnswer('cuneiform cartilage', corniculate.answers, corniculate.competingAnswers));
        }
    }
});


test('Digestive System offers twelve stomach structures in both modes with precise regional distinctions', async () => {
    const { labQuestions, labModelImage, labModelsMessage, labModeMessage, labCategoryMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labCategoryMessage('u').components[0].toJSON().components[0].options.some(o=>o.value==='digestive' && o.label==='Digestive System'));
    assert.ok(labModelsMessage('u','digestive').components[0].toJSON().components[0].options.some(o=>o.value==='stomach'));
    assert.equal(labModeMessage('u','stomach').components[1].toJSON().components[0].custom_id,'study:labcategory:u:digestive');
    for (const mode of ['multiple_choice','typed']) {
        const qs=labQuestions('stomach',mode);
        assert.equal(qs.length,12);
        assert.equal(new Set(qs.map(q=>q.labModelId)).size,12);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode==='multiple_choice') {
                assert.equal(q.options.length,4);
                assert.equal(q.options[q.correct[0]],q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName,q.answers,q.competingAnswers));
        }
        assert.match(qs.find(q=>q.modelName==='Lower esophageal sphincter').question,/located at/);
        if (mode==='typed') {
            for (const [name,alias,wrong] of [['Lower esophageal sphincter','LES','cardia'],['Pyloric sphincter','pyloric valve','pyloric canal'],['Serosa','visceral peritoneum','rugae'],['Greater curvature','greater curvature of stomach','lesser curvature'],['Lesser curvature','lesser curvature','greater curvature'],['Body','gastric body','fundus']]) {
                const q=qs.find(q=>q.modelName===name);
                assert.ok(matchesLabAnswer(alias,q.answers,q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong,q.answers,q.competingAnswers));
            }
        }
    }
});


test('upper GI set provides nine identification-only image cards with the referenced fauces marker', async () => {
    const { labQuestions, labModelImage, labModelsMessage, labModeMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u','digestive').components[0].toJSON().components[0].options.some(o=>o.value==='upper-gi'));
    assert.equal(labModeMessage('u','upper-gi').components[1].toJSON().components[0].custom_id,'study:labcategory:u:digestive');
    for (const mode of ['multiple_choice','typed']) {
        const qs=labQuestions('upper-gi',mode);
        assert.equal(qs.length,9);
        assert.equal(new Set(qs.map(q=>q.labModelId)).size,9);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode==='multiple_choice') {
                assert.equal(q.options.length,4);
                assert.equal(q.options[q.correct[0]],q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName,q.answers,q.competingAnswers));
        }
        assert.match(qs.find(q=>q.modelName==='Fauces').question,/opening.*line/);
        if (mode==='typed') {
            for (const [name,alias,wrong] of [['Fauces','oropharyngeal isthmus','oropharynx'],['Laryngopharynx','hypopharynx','oropharynx'],['Oropharynx','oral pharynx','laryngopharynx'],['Hard palate','hard palate','soft palate'],['Esophagus','oesophagus','trachea']]) {
                const q=qs.find(q=>q.modelName===name);
                assert.ok(matchesLabAnswer(alias,q.answers,q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong,q.answers,q.competingAnswers));
            }
        }
    }
});


test('full digestive model provides all 25 location-only cards in both modes and protects neighboring structures', async () => {
    const { labQuestions, labModelImage, labModelsMessage, labModeMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u','digestive').components[0].toJSON().components[0].options.some(o=>o.value==='digestive-system'));
    assert.equal(labModeMessage('u','digestive-system').components[1].toJSON().components[0].custom_id,'study:labcategory:u:digestive');
    for (const mode of ['multiple_choice','typed']) {
        const qs=labQuestions('digestive-system',mode);
        assert.equal(qs.length,25);
        assert.equal(new Set(qs.map(q=>q.labModelId)).size,25);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode==='multiple_choice') {
                assert.equal(q.options.length,4);
                assert.equal(q.options[q.correct[0]],q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName,q.answers,q.competingAnswers));
        }
        if (mode==='typed') {
            for (const [name,alias,wrong] of [['Rectum','rectum','anal canal'],['Anal canal','anal canal','anus'],['Anus','anal opening','rectum'],['Jejunum','jejunum','ileum'],['Splenic flexure','left colic flexure','hepatic flexure'],['Hepatic flexure','right colic flexure','splenic flexure'],['Taenia coli','taeniae coli','haustra'],['Large intestine','large bowel','small intestine'],['Ileocecal valve','ileocaecal valve','appendix']]) {
                const q=qs.find(q=>q.modelName===name);
                assert.ok(matchesLabAnswer(alias,q.answers,q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong,q.answers,q.competingAnswers));
            }
        }
    }
});


test('stomach layers offers ten identification-only cards with separate muscle layers, pits and glands', async () => {
    const { labQuestions, labModelImage, labModelsMessage, labModeMessage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u','digestive').components[0].toJSON().components[0].options.some(o=>o.value==='stomach-layers' && o.label==='3D Model of Stomach Layers'));
    assert.equal(labModeMessage('u','stomach-layers').components[1].toJSON().components[0].custom_id,'study:labcategory:u:digestive');
    for (const mode of ['multiple_choice','typed']) {
        const qs=labQuestions('stomach-layers',mode);
        assert.equal(qs.length,10);
        assert.equal(new Set(qs.map(q=>q.labModelId)).size,10);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode==='multiple_choice') {
                assert.equal(q.options.length,4);
                assert.equal(q.options[q.correct[0]],q.modelName);
            } else assert.ok(matchesLabAnswer(q.modelName,q.answers,q.competingAnswers));
        }
        if (mode==='typed') {
            for (const [name,alias,wrong] of [['Muscularis mucosa','muscularis mucosae','muscularis externa'],['Mucosa','gastric mucosa','submucosa'],['Gastric pits','gastric pit','gastric glands'],['Gastric glands','fundic glands','gastric pits'],['Oblique muscularis','inner oblique layer','circular muscularis'],['Circular muscularis','circular muscle layer','longitudinal muscularis'],['Serosa','visceral peritoneum','submucosa']]) {
                const q=qs.find(q=>q.modelName===name);
                assert.ok(matchesLabAnswer(alias,q.answers,q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong,q.answers,q.competingAnswers));
            }
        }
    }
});

test('teeth set offers ten image identification cards in both answer modes', async () => {
    const { labQuestions, labModelsMessage, labModelImage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'digestive').components[0].toJSON().components[0].options.some(o => o.value === 'teeth' && o.label === '3D Model of Teeth'));
    for (const mode of ['multiple_choice', 'typed']) {
        const questions = labQuestions('teeth', mode);
        assert.equal(questions.length, 10);
        for (const q of questions) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') assert.equal(q.options[q.correct[0]], q.modelName);
            else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            const dentin = questions.find(q => q.modelName === 'Dentin');
            assert.ok(matchesLabAnswer('dentine', dentin.answers, dentin.competingAnswers));
            const root = questions.find(q => q.modelName === 'Root');
            assert.ok(!matchesLabAnswer('root canal', root.answers, root.competingAnswers));
            const canal = questions.find(q => q.modelName === 'Root canal');
            assert.ok(!matchesLabAnswer('pulp cavity', canal.answers, canal.competingAnswers));
        }
    }
});

test('pancreas set offers six digestive location cards with distinct ducts and papillae', async () => {
    const { labQuestions, labModelsMessage, labModelImage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'digestive').components[0].toJSON().components[0].options.some(o => o.value === 'pancreas' && o.label === '3D Model of Pancreas'));
    for (const mode of ['multiple_choice', 'typed']) {
        const qs = labQuestions('pancreas', mode);
        assert.equal(qs.length, 6);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') assert.equal(q.options[q.correct[0]], q.modelName);
            else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, alias, wrong] of [['Main pancreatic duct', 'duct of wirsung', 'accessory pancreatic duct'], ['Accessory pancreatic duct', 'duct of santorini', 'main pancreatic duct'], ['Minor duodenal papilla', 'minor papilla', 'major duodenal papilla'], ['Major duodenal papilla', 'major papilla', 'minor duodenal papilla']]) {
                const q = qs.find(q => q.modelName === name);
                assert.ok(matchesLabAnswer(alias, q.answers, q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong, q.answers, q.competingAnswers));
            }
        }
    }
});

test('ileum set offers twelve digestive location cards with aliases and an attributed duodenal gland label', async () => {
    const { labQuestions, labModelsMessage, labModelImage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'digestive').components[0].toJSON().components[0].options.some(o => o.value === 'ileum' && o.label === '3D Model of Ileum'));
    for (const mode of ['multiple_choice', 'typed']) {
        const qs = labQuestions('ileum', mode);
        assert.equal(qs.length, 12);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') assert.equal(q.options[q.correct[0]], q.modelName);
            else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        assert.match(qs.find(q => q.modelName === 'Duodenal gland').explanation, /normally occur in the duodenum, not the ileum/);
        if (mode === 'typed') {
            for (const [name, alias, wrong] of [['Absorptive cells', 'enterocytes', 'villi'], ['Intestinal gland', 'crypt of lieberkuhn', 'duodenal gland'], ['Muscularis mucosae', 'muscularis mucosa', 'mucosa'], ['Longitudinal muscularis', 'longitudinal muscle', 'circular muscularis']]) {
                const q = qs.find(q => q.modelName === name);
                assert.ok(matchesLabAnswer(alias, q.answers, q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong, q.answers, q.competingAnswers));
            }
        }
    }
});

test('liver set offers eleven digestive identification cards with distinct vessels, ducts and lobes', async () => {
    const { labQuestions, labModelsMessage, labModelImage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'digestive').components[0].toJSON().components[0].options.some(o => o.value === 'liver' && o.label === '3D Model of Liver'));
    for (const mode of ['multiple_choice', 'typed']) {
        const qs = labQuestions('liver', mode);
        assert.equal(qs.length, 11);
        assert.ok(!qs.some(q => q.modelName === 'Inferior vena cava'));
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') assert.equal(q.options[q.correct[0]], q.modelName);
            else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, alias, wrong] of [['Bile duct', 'common bile duct', 'common hepatic duct'], ['Hepatic portal vein', 'portal vein', 'hepatic artery'], ['Right lobe', 'right hepatic lobe', 'left lobe'], ['Quadrate lobe', 'quadrate lobe of liver', 'caudate lobe']]) {
                const q = qs.find(q => q.modelName === name);
                assert.ok(matchesLabAnswer(alias, q.answers, q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong, q.answers, q.competingAnswers));
            }
        }
    }
});

test('male reproductive set offers fifteen location cards with distinct erectile tissues and urethral regions', async () => {
    const { labQuestions, labModelsMessage, labModelImage } = await import('../src/services/study/labModels.js');
    const { matchesLabAnswer } = await import('../src/services/study/answerMatching.js');
    assert.ok(labModelsMessage('u', 'reproductive').components[0].toJSON().components[0].options.some(o => o.value === 'male-reproductive' && o.label === '3D Model of Male Reproductive System'));
    for (const mode of ['multiple_choice', 'typed']) {
        const qs = labQuestions('male-reproductive', mode);
        assert.equal(qs.length, 15);
        for (const q of qs) {
            assert.ok(labModelImage(q));
            if (mode === 'multiple_choice') assert.equal(q.options[q.correct[0]], q.modelName);
            else assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
        }
        if (mode === 'typed') {
            for (const [name, alias, wrong] of [['Ampulla', 'ampula', 'seminal vesicle'], ['Corpus cavernosum', 'corpora cavernosa', 'corpus spongiosum'], ['Corpus spongiosum', 'corpora spongiosa', 'corpus cavernosum'], ['Spongy urethra', 'penile urethra', 'prostatic urethra'], ['External urethral orifice', 'urethral meatus', 'spongy urethra'], ['Testis', 'testicle', 'epididymis']]) {
                const q = qs.find(q => q.modelName === name);
                assert.ok(matchesLabAnswer(alias, q.answers, q.competingAnswers));
                assert.ok(!matchesLabAnswer(wrong, q.answers, q.competingAnswers));
            }
        }
    }
});
