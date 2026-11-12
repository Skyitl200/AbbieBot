import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQuestionBanks } from '../src/services/study/questions.js';
import { imageForQuestion } from '../src/services/study/images.js';
const answer = q => q.type === 'fill_blank' ? q.answers[0] : q.correct.map(i => q.options[i]).join(' → ');
const find = (bank, prompt) => {
    const q = bank.find(q => q.question === prompt);
    assert.ok(q, prompt);
    return q;
};

test('Respiratory provides 600 introductory questions without calculation or select-all drills', async () => {
    const bank = (await loadQuestionBanks()).get('respiratory');
    assert.equal(bank.length, 600);
    assert.equal(new Set(bank.map(q => q.question.toLowerCase())).size, 600);
    for (const [type, count] of [['multiple_choice', 380], ['fill_blank', 160], ['ordering', 60]]) {
        assert.equal(bank.filter(q => q.type === type).length, count);
    }
    for (const q of bank) {
        assert.ok(['easy', 'medium'].includes(q.difficulty), q.id);
        assert.doesNotMatch(q.question, /select all|calculate|according to the slides/i, q.id);
        assert.equal(q.source.file, 'Respiratory System Chapter 22.pptx');
        assert.ok(q.source.slides.every(s => s >= 5 && s <= 59), q.id);
        if (q.source.kind === 'clinical_application') assert.ok(q.source.rationale, q.id);
        if (q.type === 'ordering') assert.equal(q.options.length, 3, q.id);
    }
});

test('Respiratory corrects membrane units, glottis anatomy, and dynamic pressure descriptions', async () => {
    const bank = (await loadQuestionBanks()).get('respiratory');
    const expected = [
        ['Which thickness description fits the normal gas-exchange barrier?', /micrometer or submicrometer/],
        ['Should the vestibular folds be included in the strict definition of the glottis?', /true folds and intervening opening/],
        ['Is normal pleural pressure produced by a large pocket of free air in the pleural cavity?', /thin fluid film/],
        ['Must intrapleural pressure stay at exactly the same negative number during a breath?', /normally varies/],
        ['Can alveolar pressure differ from atmospheric pressure while air is flowing?', /pressure difference drives flow/],
        ['When the diaphragm contracts normally during inspiration, does it rise toward the lungs?', /descends and flattens/],
        ['Why is ordinary quiet expiration called passive?', /recoil after inspiratory muscles relax/],
    ];
    for (const [prompt, pattern] of expected) {
        const q = find(bank, prompt);
        assert.match(answer(q), pattern, q.id);
        assert.equal(q.source.kind, 'clinical_application', q.id);
    }
    assert.match(find(bank, expected[0][0]).explanation, /0\.5 micrometers/);
});

test('lung-volume questions use explicit endpoints and independently correct capacity components', async () => {
    const bank = (await loadQuestionBanks()).get('respiratory');
    const expected = [
        ['The abbreviation for tidal volume is ____.', 'TV'],
        ['The abbreviation for inspiratory reserve volume is ____.', 'IRV'],
        ['The abbreviation for expiratory reserve volume is ____.', 'ERV'],
        ['The abbreviation for residual volume is ____.', 'RV'],
        ['Total lung capacity equals vital capacity plus ____ volume.', 'residual'],
        ['Inspiratory capacity includes tidal volume and ____ reserve volume.', 'inspiratory'],
        ['Functional residual capacity includes residual volume and ____ reserve volume.', 'expiratory'],
        ['Which standard lung volume cannot be measured directly by simple spirometry alone?', 'Residual volume'],
        ['What makes total lung capacity greater than vital capacity?', 'It also includes residual volume'],
    ];
    for (const [prompt, key] of expected) assert.equal(answer(find(bank, prompt)), key);
    const endpoints = [
        ['After a normal inhalation, a person inhales additional air.', 'Inspiratory reserve volume'],
        ['After a normal exhalation, a person forcefully exhales more air.', 'Expiratory reserve volume'],
        ['A person exhales as completely as possible, but some air remains.', 'Residual volume'],
        ['A person inhales maximally and then exhales maximally.', 'Vital capacity'],
        ['A person is at the end of a quiet normal exhalation.', 'Functional residual capacity'],
        ['From the end of normal expiration, a person inhales as deeply as possible.', 'Inspiratory capacity'],
    ];
    for (const [scene, key] of endpoints) {
        const q = bank.find(q => q.type === 'multiple_choice' && q.question.startsWith(scene));
        assert.ok(q, scene);
        assert.equal(answer(q), key, q.id);
    }
});

test('airway and ventilation ordering keys agree with anatomical and causal reference models', async () => {
    const bank = (await loadQuestionBanks()).get('respiratory');
    const airway = ['External nares', 'Nasal cavity', 'Nasopharynx', 'Oropharynx', 'Laryngopharynx', 'Larynx', 'Trachea', 'Primary bronchus', 'Secondary bronchus', 'Tertiary bronchus', 'Smaller bronchioles', 'Terminal bronchiole', 'Respiratory bronchiole', 'Alveolar duct', 'Alveolar sac', 'Individual alveolus'];
    const airwayItems = bank.filter(q => q.type === 'ordering' && /nasal airflow|inhaled airflow toward a lung lobe|branching of the conducting bronchial tree|airflow through the selected distal airway landmarks/.test(q.question));
    assert.equal(airwayItems.length, 12);
    for (const q of airwayItems) {
        const ranks = q.correct.map(i => airway.indexOf(q.options[i]));
        assert.ok(ranks.every((rank, i) => rank >= 0 && (!i || rank > ranks[i - 1])), q.id);
    }
    const rank = {
        'Inspiratory muscle activation': 0, 'Diaphragm descent': 1, 'Thoracic expansion': 2,
        'Alveolar pressure below atmosphere': 3, 'Air entering the lungs': 4,
        'Inspiratory muscle relaxation': 0, 'Elastic recoil': 1, 'Alveolar volume reduction': 2,
        'Alveolar pressure above atmosphere': 3, 'Air leaving the lungs': 4,
        'Alveolar ventilation exceeds metabolic need': 0, 'Carbon dioxide removal exceeds production': 1,
        'Arterial carbon dioxide falls': 2, 'Hydrogen-ion concentration tends to fall': 3, 'Blood pH tends to rise': 4,
        'Alveolar ventilation is insufficient': 0, 'Carbon dioxide retention': 1,
        'Arterial carbon dioxide rises': 2, 'Hydrogen-ion concentration tends to rise': 3, 'Blood pH tends to fall': 4,
    };
    const causal = bank.filter(q => q.type === 'ordering' && /simple quiet-inspiration model|simple quiet-expiration model|primary sustained hyperventilation sequence|primary sustained hypoventilation sequence/.test(q.question));
    assert.equal(causal.length, 12);
    for (const q of causal) {
        const ranks = q.correct.map(i => rank[q.options[i]]);
        assert.ok(ranks.every((r, i) => Number.isFinite(r) && (!i || r > ranks[i - 1])), q.id);
    }
});

test('gas transport and clinical examples avoid rate-only ventilation and symptom-only diagnoses', async () => {
    const bank = (await loadQuestionBanks()).get('respiratory');
    const expected = [
        ['Oxygen binds to the ____ portion of hemoglobin.', 'heme'],
        ['Carbon dioxide carried on hemoglobin binds mainly to the ____ portion.', 'globin'],
        ['Most carbon dioxide is transported in blood as ____.', 'bicarbonate'],
        ['When bicarbonate exits a red cell in tissues, ____ enters.', 'chloride'],
        ['Sustained hyperventilation tends to ____ arterial carbon dioxide.', 'lower'],
        ['Sustained hypoventilation tends to ____ arterial carbon dioxide.', 'raise'],
        ['In a primary respiratory acidosis, pH tends to ____.', 'fall'],
        ['In a primary respiratory alkalosis, pH tends to ____.', 'rise'],
    ];
    for (const [prompt, key] of expected) assert.equal(answer(find(bank, prompt)), key);
    const caveats = [
        ['Why is rapid breathing not automatically hyperventilation?', /Depth and metabolic carbon dioxide production/],
        ['Why is a slow respiratory rate not by itself proof of hypoventilation?', /Breath depth and metabolic demand/],
        ['Does wheezing alone prove that someone has asthma?', /more than one cause/],
        ['Can a cough alone establish COPD?', /appropriate clinical assessment/],
        ['Does finding a lung nodule automatically establish lung cancer?', /benign or malignant causes/],
        ['Is metastasis the only factor deciding whether surgery, radiation, or systemic therapy is used?', /stage, histology, molecular findings, and patient factors/],
    ];
    for (const [prompt, pattern] of caveats) assert.match(answer(find(bank, prompt)), pattern);
});

test('each Respiratory question has a lecture figure and prefers actual cited diagram slides', async () => {
    const bank = (await loadQuestionBanks()).get('respiratory');
    const illustrated = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 43, 44, 45, 46, 47, 48, 50, 51, 52, 53, 54]);
    for (const q of bank) {
        const figure = imageForQuestion(q);
        assert.ok(figure, q.id);
        if (figure.match === 'figure-content') {
            assert.ok(!q.figure_slide && !q.figure_source, `Authored reference preserved: ${q.id}`);
            assert.ok(figure.asset.caption || figure.asset.alt || figure.asset.occurrences?.length, q.id);
            continue;
        }
        assert.equal(figure.source.file, q.source.file, q.id);
        if (q.figure_slide) assert.equal(figure.source.slide, q.figure_slide, q.id);
        if (q.source.slides.every(s => [55, 56, 57].includes(s))) assert.equal(figure.source.slide, 6, q.id);
        if (q.source.slides.some(s => illustrated.has(s))) {
            assert.equal(figure.match, 'cited-slide', q.id);
            assert.ok(q.source.slides.includes(figure.source.slide), q.id);
        }
    }
});
