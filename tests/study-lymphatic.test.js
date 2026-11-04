import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQuestionBanks } from '../src/services/study/questions.js';
import { imageForQuestion } from '../src/services/study/images.js';
const answer = q => q.type === 'fill_blank' ? q.answers[0] : q.correct.map(i => q.options[i]).join(' → ');

test('Lymphatic provides 600 introductory questions in the three supported formats', async () => {
    const bank = (await loadQuestionBanks()).get('lymphatic');
    assert.equal(bank.length, 600);
    for (const acronym of ['MALT', 'BALT']) assert.ok(bank.some(q => q.question === `Which statement correctly describes ${acronym}?`));
    assert.equal(new Set(bank.map(q => q.question.toLowerCase())).size, 600);
    assert.equal(bank.filter(q => q.type === 'multiple_choice').length, 380);
    assert.equal(bank.filter(q => q.type === 'fill_blank').length, 160);
    assert.equal(bank.filter(q => q.type === 'ordering').length, 60);
    for (const q of bank) {
        assert.ok(['easy', 'medium'].includes(q.difficulty), q.id);
        assert.doesNotMatch(q.question, /select all|calculate|according to the slides/i, q.id);
        assert.equal(q.source.file, 'Lymphatic System Chapter 21 part 2.pptx');
        assert.ok(q.source.slides.every(n => n >= 5 && n <= 30), q.id);
        if (q.source.kind === 'clinical_application') assert.ok(q.source.rationale);
        if (q.type === 'ordering') assert.equal(q.options.length, 3, q.id);
    }
});

test('lymphatic keys preserve fluid identity, regional drainage, and organ-specific immune roles', async () => {
    const bank = (await loadQuestionBanks()).get('lymphatic');
    const expected = [
        ['A lymph node filters ____ rather than blood as its main fluid.', 'lymph'],
        ['B cells mature principally in red bone ____.', 'marrow'],
        ['The major maturation site for T cells is the ____.', 'thymus'],
        ['The node paracortex is especially rich in ____ cells.', 'T'],
        ['Lymphoid follicles are especially associated with ____ lymphocytes.', 'B'],
        ['Afferent vessels carry lymph ____ a lymph node.', 'into'],
        ['Efferent vessels carry lymph ____ from a node.', 'away'],
        ['The thoracic duct usually empties on the ____ side of the neck.', 'left'],
        ['Peyer\'s patches are especially associated with the ____.', 'ileum'],
        ['The pharyngeal tonsil lies in the ____.', 'nasopharynx'],
        ['The removed organ in splenectomy is the ____.', 'spleen'],
        ['Which splenic-pulp pairing is correct?', 'Red pulp: blood-cell clearance; white pulp: lymphoid responses'],
        ['Which route distinguishes drainage of the right foot from the right arm?', 'Foot: thoracic duct route; arm: right upper lymphatic route'],
    ];
    for (const [prompt, key] of expected) {
        const q = bank.find(q => q.question === prompt);
        assert.ok(q, prompt);
        assert.equal(answer(q), key, q.id);
    }
});

test('lymphatic study corrects simplified slide descriptions and avoids diagnostic absolutes', async () => {
    const bank = (await loadQuestionBanks()).get('lymphatic');
    const checks = [
        ['Initial lymphatic capillaries begin as ____-ended vessels.', /^blind$/],
        ['Does the spleen lack a connective-tissue capsule entirely?', /^No, it has a capsule/],
        ['Are most T cells in a node arranged simply as a uniform ring around every B-cell follicle?', /paracortex/],
        ['Are red pulp and white pulp simply both located inside every splenic lymphoid nodule?', /distinct splenic tissue regions/],
        ['Is BALT equally prominent and permanently organized in every healthy adult?', /varies and can develop/],
        ['What separates reactive node enlargement from a definite diagnosis of cancer?', /does not establish malignancy/],
        ['Does the right lymphatic duct normally drain the entire right half of the body?', /right lower body usually drains through the thoracic duct/],
        ['Does age-related thymic involution mean every adult immediately loses all T cells?', /mature T cells persist/],
    ];
    for (const [prompt, pattern] of checks) {
        const q = bank.find(q => q.question === prompt);
        assert.ok(q, prompt);
        assert.match(answer(q), pattern, q.id);
        assert.equal(q.source.kind, 'clinical_application', q.id);
    }
});

test('all lymphatic ordering keys follow independent drainage and process landmark ranks', async () => {
    const bank = (await loadQuestionBanks()).get('lymphatic');
    const ranks = {
        'Interstitial fluid': 0, 'Initial lymphatic capillary': 1, 'Collecting lymphatic vessel': 2,
        'Afferent vessel': 3, 'Lymph node': 4, 'Subcapsular sinus': 4, 'Cortical sinuses': 5,
        'Medullary sinuses': 6, 'Efferent vessel': 7, 'Downstream collecting vessels': 8,
        'Regional lymphatic trunk': 9, 'Terminal lymphatic duct': 10, 'Venous blood': 11,
        'Lumbar trunks': 5, 'Cisterna chyli': 6, 'Thoracic duct': 7, 'Left venous angle': 8,
        'Left brachiocephalic vein': 9, 'Superior vena cava': 10, 'Right atrium': 11,
        'Intestinal lipid uptake': 0, 'Chylomicron formation': 1, 'Lacteal entry': 2,
        'Collecting intestinal lymphatics': 3, 'Intestinal trunk': 5,
        'Right-arm interstitial fluid': 0, 'Initial lymphatic capillaries': 1,
        'Collecting arm lymphatics': 2, 'Right axillary nodes': 3, 'Right subclavian trunk': 4,
        'Collecting left-arm lymphatics': 1, 'Left axillary nodes': 2, 'Left subclavian trunk': 3,
        'Right head-and-neck lymphatics': 1, 'Right cervical nodes': 2, 'Right jugular trunk': 3,
        'Right lymphatic duct': 7, 'Right venous angle': 8, 'Right brachiocephalic vein': 9,
        'Left head-and-neck lymphatics': 1, 'Left cervical nodes': 2, 'Left jugular trunk': 3,
        'Superficial leg lymphatics': 1, 'Inguinal nodes': 2, 'Deeper pelvic node chains': 3,
        'Microbial material in tissue': 0, 'Dendritic-cell antigen capture': 1,
        'Travel in afferent lymph': 2, 'Arrival in the draining node': 3, 'T-cell activation': 4,
        'Particle recognition': 0, 'Particle attachment': 1, 'Particle engulfment': 2,
        'Enclosure in a phagosome': 3, 'Intracellular digestion': 4,
        'Antigen recognition': 0, 'B-cell activation': 1, 'Clonal proliferation': 2,
        'Plasma-cell differentiation': 3, 'Antibody secretion': 4,
        'Marrow-derived T-lineage precursor': 0, 'Blood transport to thymus': 1,
        'Entry into thymic tissue': 2, 'Development and selection': 3, 'Mature T-cell exit': 4,
        'Antigen crosses the mucosal barrier': 0, 'Antigen capture by a presenting cell': 1,
        'Presentation to a matching lymphocyte': 2, 'Lymphocyte activation': 3, 'Clonal expansion': 4,
        'Splenic artery': 0, 'Smaller splenic arterial branches': 1, 'Splenic pulp vascular beds': 2,
        'Small splenic veins': 3, 'Splenic vein': 4, 'Blood capillary fluid filtration': -1,
        'Initial lymphatic entry': 1, 'Transport in larger lymphatic channels': 2, 'Venous return of lymph': 3,
    };
    for (const q of bank.filter(q => q.type === 'ordering')) {
        const order = q.correct.map(i => ranks[q.options[i]]);
        assert.ok(order.every(Number.isFinite), q.id);
        assert.ok(order.every((r, i) => !i || r > order[i - 1]), `${q.id}: ${answer(q)}`);
    }
});

test('every Lymphatic question has a source-linked figure; actual cited figures are preferred', async () => {
    const bank = (await loadQuestionBanks()).get('lymphatic');
    const slidesWithFigures = new Set([8, 9, 10, 11, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 27, 29]);
    for (const q of bank) {
        const figure = imageForQuestion(q);
        assert.ok(figure, q.id);
        assert.equal(figure.source.file, q.source.file, q.id);
        if (q.source.slides.some(s => slidesWithFigures.has(s))) {
            assert.equal(figure.match, 'cited-slide', q.id);
            assert.ok(q.source.slides.includes(figure.source.slide), q.id);
        }
    }
});
