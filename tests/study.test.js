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
        async followUp(p) { calls.push(['followUp', p]); },
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

test('actual banks are valid and their incompleteness is detected', async () => {
    const banks = await loadQuestionBanks();
    const total = [...banks.values()].reduce((n, questions) => n + questions.length, 0);
    if (total < 13800) await assert.rejects(loadQuestionBanks(undefined, { complete: true }), /expected 600/);
    else await loadQuestionBanks(undefined, { complete: true });
});

test('completed banks each supply 600 different questions in all three formats', async () => {
    const banks = await loadQuestionBanks();
    for (const topicId of ['anatomical_directions', 'basic_chemistry', 'living_cells', 'tissues', 'integumentary', 'skeletal', 'joints', 'muscular', 'nervous_tissue', 'central_nervous', 'special_senses', 'endocrine', 'blood_cells', 'circulatory', 'autonomic_nervous', 'immune', 'urinary']) {
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
    assert.ok(client.commands.size <= 100, `Discord only permits 100 commands, got ${client.commands.size}`);
    const command = client.commands.get('test').data.toJSON();
    assert.equal(command.options[0].name, 'other-subjects');
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
    assert.ok(menu.options.some(option => option.value === 'urinary' && /600/.test(option.description)));
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

test('every question format earns ten coins once and displays the wallet and progress', async () => {
    const wallet = walletFixture();
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
        assert.equal(session.moneyEarned, 10);
        const message = interaction.calls.find(call => call[0] === 'editReply')[1].embeds[0].toJSON();
        assert.match(message.description, /\+10 Merit Coins/);
        assert.match(message.description, /New Balance/);
        assert.ok(message.fields.some(field => field.name === 'Quiz Progress' && /Incorrect: \*\*0/.test(field.value)));
    }
    assert.equal(wallet.balance(), 3417);
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
    assert.equal(session.moneyEarned, 0);
    assert.equal(wallet.balance(), 3397);
    assert.throws(() => nextStudyQuestion(session), /not saved yet/);
    assert.match(interaction.calls.at(-1)[1].components[0].toJSON().components[0].label, /Retry coins/);
    await handleStudyInteraction(fakeInteraction(''), wallet.client, ['reward', 'u', session.id, '0', String(session.revision)]);
    assert.equal(session.reward.status, 'saved');
    assert.equal(session.moneyEarned, 10);
    assert.equal(wallet.balance(), 3397);
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
    assert.equal(wallet.balance(), 3407);
    assert.equal(first.moneyEarned, 10);
    assert.equal(second.moneyEarned, 10);
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
