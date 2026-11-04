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

test('Digestive provides 600 introductory, source-linked questions in the three active formats', async () => {
    const bank = (await loadQuestionBanks()).get('digestive');
    assert.equal(bank.length, 600);
    assert.equal(new Set(bank.map(q => q.question.toLowerCase())).size, 600);
    for (const [type, count] of [['multiple_choice', 380], ['fill_blank', 160], ['ordering', 60]]) assert.equal(bank.filter(q => q.type === type).length, count);
    for (const q of bank) {
        assert.ok(['easy', 'medium'].includes(q.difficulty), q.id);
        assert.doesNotMatch(q.question, /select all|calculate|according to the slides/i, q.id);
        assert.equal(q.source.file, 'Digestive System Chapter 23.pptx');
        assert.ok(q.source.slides.every(s => s >= 5 && s <= 83), q.id);
        if (q.source.kind === 'clinical_application') assert.ok(q.source.rationale, q.id);
        if (q.type === 'ordering') assert.equal(q.options.length, 3, q.id);
    }
});

test('digestive transit keys follow proximal-to-distal anatomy rather than the appendix', async () => {
    const bank = (await loadQuestionBanks()).get('digestive');
    const reference = ['Mouth', 'Pharynx', 'Esophagus', 'Stomach', 'Duodenum', 'Jejunum', 'Ileum', 'Ileocecal valve', 'Cecum', 'Ascending colon', 'Transverse colon', 'Descending colon', 'Sigmoid colon', 'Rectum', 'Anal canal', 'Anus'];
    const selected = bank.filter(q => q.type === 'ordering' && /forward food passage from the mouth|small-intestinal transit|passage through the selected proximal-to-distal colon|distal colonic transit/.test(q.question));
    assert.equal(selected.length, 12);
    for (const q of selected) {
        const ranks = q.correct.map(i => reference.indexOf(q.options[i]));
        assert.ok(ranks.every((r, i) => r >= 0 && (!i || r > ranks[i - 1])), q.id);
    }
    assert.match(answer(find(bank, 'Is the appendix the required passage from ileum into colon?')), /contents enter the cecum/);
    assert.match(answer(find(bank, 'Which list includes the four principal named colon regions?')), /Ascending, transverse, descending, sigmoid/);
});

test('gastric and pancreatic secretion keys distinguish source cells, precursors, and active enzymes', async () => {
    const bank = (await loadQuestionBanks()).get('digestive');
    const expected = [
        ['Parietal cells secrete hydrochloric acid and intrinsic ____.', 'factor'],
        ['Chief cells secrete the precursor ____.', 'pepsinogen'],
        ['Gastrin-secreting enteroendocrine cells are called ____ cells.', 'G'],
        ['Vitamin B12 absorption normally occurs in the terminal ____.', 'ileum'],
        ['Enteropeptidase activates trypsinogen into ____.', 'trypsin'],
        ['Trypsin is a protein-digesting enzyme or ____.', 'protease'],
        ['Pancreatic endocrine hormones are released into the ____.', 'blood'],
    ];
    for (const [prompt, key] of expected) assert.equal(answer(find(bank, prompt)), key);
    assert.equal(answer(find(bank, 'Pancreatic acini release enzyme-rich secretion into ____.')), 'ducts');
    const caveats = [
        ['Which cells release most gastric gastrin?', /Enteroendocrine G cells/],
        ['Are all pancreatic digestive enzymes secreted only in inactive form?', /amylase and lipase/],
        ['Does hydrochloric acid itself act as the protein-cleaving enzyme in the stomach?', /supports denaturation and pepsin activation/],
        ['What is the main direct action of a simple antacid in the stomach?', /Neutralizing existing luminal acid/],
        ['Which gastric cell\'s acid-producing machinery is targeted by proton-pump inhibitors?', /Parietal cell/],
    ];
    for (const [prompt, pattern] of caveats) assert.match(answer(find(bank, prompt)), pattern);
});

test('hepatic blood flow and biliary drainage keys use separate independently ranked routes', async () => {
    const bank = (await loadQuestionBanks()).get('digestive');
    const rank = {
        'Intestinal blood capillaries': 0, 'Hepatic portal vein': 1,
        'Hepatic artery': 0, 'Smaller hepatic arterial branches': 1,
        'Hepatic sinusoids': 2, 'Hepatic sinusoid': 2, 'Central vein': 3,
        'Sublobular venous branches': 4, 'Hepatic vein': 5, 'Hepatic veins': 5, 'Inferior vena cava': 6,
        'Hepatocyte bile secretion': 0, 'Bile canaliculi': 1, 'Bile ductules': 2,
        'Right or left hepatic duct': 3, 'Common hepatic duct': 4,
        'Gallbladder contraction': 0, 'Bile moves through cystic duct': 1,
        'Bile enters common bile duct': 2, 'Bile reaches duodenum': 3, 'Fat droplets are emulsified': 4,
    };
    const selected = bank.filter(q => q.type === 'ordering' && /absorbed nutrient blood|hepatic venous drainage|arterial contribution to hepatic blood flow|newly secreted bile|gallbladder release model/.test(q.question));
    assert.equal(selected.length, 15);
    for (const q of selected) {
        const ranks = q.correct.map(i => rank[q.options[i]]);
        assert.ok(ranks.every((r, i) => Number.isFinite(r) && (!i || r > ranks[i - 1])), q.id);
    }
    assert.equal(answer(find(bank, 'In a classic hepatic lobule, hepatocyte plates are organized around which central structure?')), 'Central vein');
    assert.match(answer(find(bank, 'Do bile and blood normally share one hepatic sinusoidal channel?')), /separate pathways/);
    assert.match(answer(find(bank, 'After gallbladder removal, can the liver still make bile?')), /bile production remains a liver function/);
});

test('absorption and clinical examples avoid overly broad routes and diagnostic absolutes', async () => {
    const bank = (await loadQuestionBanks()).get('digestive');
    const checks = [
        ['Which comparison separates emulsification and hydrolysis?', /Emulsification disperses droplets; hydrolysis breaks molecular bonds/],
        ['Must every absorbed nutrient first pass through intestinal lymph?', /many sugars and amino acids enter capillary blood/],
        ['Can small peptides enter intestinal absorptive cells as well as free amino acids?', /dipeptides and tripeptides/],
        ['Do all dietary fats follow an identical chylomicron-to-lymph route?', /shorter-chain fatty acids can enter portal blood/],
        ['How does heartburn differ from GERD?', /Heartburn is a symptom/],
        ['Does right-upper-abdominal pain alone prove a gallstone obstruction?', /several possible causes/],
        ['Does anemia by itself prove an intrinsic-factor problem?', /several possible causes/],
        ['Does liver processing guarantee that portal blood becomes completely free of every toxin?', /processing capacity and effects vary/],
        ['Does the importance of intrinsic factor mean life after stomach removal is impossible?', /nutritional consequences can be managed/],
        ['Does the large intestine absorb all the water taken up by the digestive tract?', /much water is absorbed in the small intestine/],
    ];
    for (const [prompt, pattern] of checks) {
        const q = find(bank, prompt);
        assert.match(answer(q), pattern, q.id);
        assert.equal(q.source.kind, 'clinical_application', q.id);
    }
});

test('every Digestive question has a lecture figure with actual cited diagram slides preferred', async () => {
    const bank = (await loadQuestionBanks()).get('digestive');
    const illustrated = new Set([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 70, 71, 72, 73, 75, 76, 77, 78, 79, 80]);
    for (const q of bank) {
        const figure = imageForQuestion(q);
        assert.ok(figure, q.id);
        assert.equal(figure.source.file, q.source.file, q.id);
        if (q.figure_slide) assert.equal(figure.source.slide, q.figure_slide, q.id);
        if (q.source.slides.length === 1 && q.source.slides[0] === 69) assert.equal(figure.source.slide, 63, q.id);
        if (q.source.slides.some(s => illustrated.has(s))) {
            assert.equal(figure.match, 'cited-slide', q.id);
            assert.ok(q.source.slides.includes(figure.source.slide), q.id);
        }
    }
});
