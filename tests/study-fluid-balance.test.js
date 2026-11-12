import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQuestionBanks } from '../src/services/study/questions.js';
import { imageForQuestion, lecturePreview } from '../src/services/study/images.js';
const answer = q => q.type === 'fill_blank' ? q.answers[0] : q.correct.map(i => q.options[i]).join(' → ');
const find = (bank, prompt) => {
    const q = bank.find(q => q.question === prompt);
    assert.ok(q, prompt);
    return q;
};

test('Water & Fluid Balance provides 600 introductory questions with short ordering and no calculation drills', async () => {
    const bank = (await loadQuestionBanks()).get('fluid_balance');
    assert.equal(bank.length, 600);
    assert.equal(new Set(bank.map(q => q.question.toLowerCase())).size, 600);
    for (const [type, count] of [['multiple_choice', 380], ['fill_blank', 160], ['ordering', 60]]) assert.equal(bank.filter(q => q.type === type).length, count);
    for (const q of bank) {
        assert.ok(['easy', 'medium'].includes(q.difficulty), q.id);
        assert.doesNotMatch(q.question, /select all|calculate|according to the slides/i, q.id);
        assert.equal(q.source.file, 'Water Fluid Balance Chapter 25.pptx');
        assert.ok(q.source.slides.every(s => s >= 5 && s <= 33), q.id);
        if (q.source.kind === 'clinical_application') assert.ok(q.source.rationale, q.id);
        if (q.type === 'ordering') assert.equal(q.options.length, 3, q.id);
    }
});

test('fluid compartments, ions, and ADH origin keys agree with physiological reference facts', async () => {
    const bank = (await loadQuestionBanks()).get('fluid_balance');
    const expected = [
        ['The abbreviation for the fluid inside cells is ____.', 'ICF'],
        ['The abbreviation for fluid outside cells is ____.', 'ECF'],
        ['Blood plasma is classified as ____ fluid.', 'extracellular'],
        ['CSF and synovial fluid belong to specialized ____ fluid.', 'extracellular'],
        ['ADH is synthesized by neurons in the ____.', 'hypothalamus'],
        ['ADH is released into blood from the ____ pituitary.', 'posterior'],
        ['An aquaporin is a channel for ____.', 'water'],
        ['Aldosterone is produced in the adrenal ____.', 'cortex'],
        ['PTH is released by the ____ glands.', 'parathyroid'],
        ['Which major-cation pairing is correct?', 'ECF: sodium; ICF: potassium'],
    ];
    for (const [prompt, key] of expected) assert.equal(answer(find(bank, prompt)), key);
});

test('tonicity, ADH, and acid-base ordering keys follow independent causal ranks', async () => {
    const bank = (await loadQuestionBanks()).get('fluid_balance');
    const rank = {
        'Effective extracellular concentration rises': 0, 'An outward osmotic drive develops': 1,
        'Water leaves the cell': 2, 'Intracellular water decreases': 3, 'The cell shrinks': 4,
        'Effective extracellular concentration falls': 0, 'An inward osmotic drive develops': 1,
        'Water enters the cell': 2, 'Intracellular water increases': 3, 'The cell swells': 4,
        'ADH receptor activation': 0, 'Aquaporin-2 insertion': 1,
        'Increased collecting-duct water permeability': 2, 'Greater osmotic water reabsorption': 3,
        'Less water remains in final urine': 4,
        'Effective alveolar ventilation becomes inadequate': 0, 'Carbon dioxide removal falls below production': 1,
        'Arterial carbon dioxide rises': 2, 'Hydrogen-ion availability tends to rise': 3, 'Blood pH tends to fall': 4,
        'Effective alveolar ventilation exceeds metabolic need': 0, 'Carbon dioxide removal exceeds production': 1,
        'Arterial carbon dioxide falls': 2, 'Hydrogen-ion availability tends to fall': 3, 'Blood pH tends to rise': 4,
        'Filtered bicarbonate reacts with secreted hydrogen ions': 0, 'Luminal carbon dioxide is formed': 1,
        'Carbon dioxide enters the tubular cell': 2, 'Intracellular bicarbonate is reformed': 3,
        'Bicarbonate moves toward blood': 4,
    };
    const selected = bank.filter(q => q.type === 'ordering' && /cell response to an effectively hypertonic|cell response to an effectively hypotonic|ADH water-conserving response|primary carbon-dioxide-retention acidifying|primary excessive-ventilation alkalinizing|proximal-tubule bicarbonate reclamation/.test(q.question));
    assert.equal(selected.length, 18);
    for (const q of selected) {
        const ranks = q.correct.map(i => rank[q.options[i]]);
        assert.ok(ranks.every((r, i) => Number.isFinite(r) && (!i || r > ranks[i - 1])), q.id);
    }
});

test('fluid concentration, hormonal regulation, and compensation avoid misleading absolutes', async () => {
    const bank = (await loadQuestionBanks()).get('fluid_balance');
    const checks = [
        ['How does sodium concentration differ from total-body sodium amount?', /relative to water/],
        ['Can hyponatremia occur in low-, normal-, or high-volume clinical settings?', /does not uniquely identify volume status/],
        ['What distinguishes edema from an assurance of adequate circulation?', /does not guarantee/],
        ['Which paired renal effect does aldosterone normally favor?', /Sodium retention and potassium secretion/],
        ['How can PTH\'s renal effects on calcium and phosphate differ?', /conserves calcium while promoting phosphate excretion/],
        ['How does filtered-bicarbonate reclamation differ from new bicarbonate generation?', /Reclamation prevents loss; new generation accompanies net acid excretion/],
        ['Does an appropriate compensatory response prove that the primary disorder is cured?', /cause persists/],
        ['Does a low pH alone distinguish respiratory from metabolic acidosis?', /CO2, bicarbonate, and context/],
        ['Why is fast breathing alone insufficient to prove respiratory alkalosis?', /Depth and metabolic CO2 production/],
    ];
    for (const [prompt, pattern] of checks) assert.match(answer(find(bank, prompt)), pattern);
    assert.equal(answer(find(bank, 'Bicarbonate loss in diarrhea can cause ____ acidosis.')), 'metabolic');
    assert.equal(answer(find(bank, 'Loss of gastric acid can contribute to metabolic ____.')), 'alkalosis');
});

test('fluid slide clarifications distinguish blood pH, buffer capacity, tonicity, and calcium control', async () => {
    const bank = (await loadQuestionBanks()).get('fluid_balance');
    const checks = [
        ['Does the usual arterial blood pH range describe every fluid in the body?', /different fluids can have different normal pH/],
        ['Which reference range is commonly used for normal arterial blood pH?', /7\.35 to 7\.45/],
        ['Which definition corrects the use of volume in defining osmolality?', /per mass of solvent/],
        ['Does weak acid mean harmless in every amount and context?', /strength and amount are different/],
        ['What happens if an acid load exceeds a buffer\'s useful capacity?', /pH can change substantially/],
        ['Which description avoids overstating calcitonin\'s adult role?', /not the dominant routine adult regulator/],
        ['Does PTH have to bind directly to an osteoclast to promote bone resorption?', /other bone cells/],
        ['Does bicarbonate reclamation mean kidney cells lack every bicarbonate transporter?', /conversion and membrane transport work together/],
    ];
    for (const [prompt, pattern] of checks) {
        const q = find(bank, prompt);
        assert.match(answer(q), pattern, q.id);
        assert.equal(q.source.kind, 'clinical_application', q.id);
    }
});

test('fluid questions retain internal topic and figure provenance without displaying lecture references', async () => {
    const bank = (await loadQuestionBanks()).get('fluid_balance');
    const illustrated = new Set([5, 6, 7, 8, 9, 12, 14, 15, 19, 20, 21, 22, 23, 28, 29]);
    let cross = 0;
    const crossSources = new Set();
    for (const q of bank) {
        const figure = imageForQuestion(q);
        assert.ok(figure, q.id);
        if (figure.match === 'figure-content') {
            assert.ok(!q.figure_slide && !q.figure_source, `Authored reference preserved: ${q.id}`);
            assert.ok(figure.asset.caption || figure.asset.alt || figure.asset.occurrences?.length, q.id);
            continue;
        }
        assert.equal(figure.source.file, q.figure_source || q.source.file, q.id);
        if (q.figure_slide) assert.equal(figure.source.slide, q.figure_slide, q.id);
        if (q.figure_source) {
            cross++;
            assert.equal(q.source.file, 'Water Fluid Balance Chapter 25.pptx');
            crossSources.add(figure.source.file);
            if (figure.source.file === 'Respiratory System Chapter 22.pptx') assert.equal(figure.source.slide, 47);
            else {
                assert.equal(figure.source.file, 'Living Cells Units Chapter 3.pptx');
                assert.ok([23, 29].includes(figure.source.slide));
                assert.match(q.question + q.explanation, /tonic|osmosis|cell volume/i);
            }
            assert.equal(figure.match, 'related-lecture');
        } else if (q.source.slides.some(s => illustrated.has(s))) {
            assert.equal(figure.match, 'cited-slide', q.id);
            assert.ok(q.source.slides.includes(figure.source.slide), q.id);
        }
    }
    assert.ok(cross > 0);
    assert.equal(crossSources.size, 2);
    const q = bank.find(q => q.figure_source === 'Respiratory System Chapter 22.pptx');
    const payload = lecturePreview(q);
    assert.equal(payload.embeds[0].toJSON().fields, undefined);
    assert.equal(imageForQuestion(q).source.file, 'Respiratory System Chapter 22.pptx');
    assert.equal(imageForQuestion(q).source.slide, 47);
    assert.equal(payload.files[0].attachment, imageForQuestion(q).path);
});
