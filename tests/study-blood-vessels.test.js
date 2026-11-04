import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQuestionBanks } from '../src/services/study/questions.js';

const answer = q => q.type === 'fill_blank' ? q.answers[0] : q.correct.map(i => q.options[i]).join(' → ');
test('Blood Vessels meets the introductory three-format target without calculation or select-all drills', async () => {
    const bank = (await loadQuestionBanks()).get('blood_vessels');
    assert.equal(bank.length, 600);
    assert.equal(new Set(bank.map(q => q.question.toLowerCase())).size, 600);
    for (const q of bank) {
        assert.ok(['easy', 'medium'].includes(q.difficulty), q.id);
        assert.doesNotMatch(q.question, /select all|calculate|convert .*units|according to the slides/i, q.id);
        assert.equal(q.source.file, 'Blood Vessels Chapter 20.pptx');
        if (q.type === 'ordering') assert.equal(q.options.length, 3, q.id);
        if (q.source.kind === 'clinical_application') assert.ok(q.source.rationale);
    }
    assert.equal(bank.filter(q => q.type === 'ordering').length, 60);
    assert.equal(bank.filter(q => q.type === 'fill_blank').length, 156);
});
test('Blood Vessels distinguishes fetal oxygen exceptions, portal inflow, and modern classification caveats', async () => {
    const bank = (await loadQuestionBanks()).get('blood_vessels');
    const expected = [
        ['Which fetal umbilical vessel carries relatively more oxygen?', 'Umbilical vein'],
        ['Which hepatic vessel is an outflow rather than an inflow?', 'Hepatic vein'],
        ['Which paired arteries join to form a single basilar artery?', 'Vertebral arteries'],
        ['Which saphenous vein normally drains into the femoral vein?', 'Great saphenous vein'],
        ['Which forearm artery lies on the thumb side rather than the little-finger side?', 'Radial artery'],
        ['Which superficial upper-limb vein lies laterally rather than medially?', 'Cephalic vein'],
        ['Which brachiocephalic vessel is normally present on both right and left sides?', 'Brachiocephalic vein'],
        ['What structure remains after the foramen ovale closes normally?', 'Fossa ovalis'],
        ['What does the closed ductus arteriosus normally become?', 'Ligamentum arteriosum'],
        ['What does the closed ductus venosus normally become?', 'Ligamentum venosum'],
        ['What does the closed umbilical vein normally become?', 'Round ligament of the liver'],
        ['What do the distal closed portions of the umbilical arteries normally form?', 'Medial umbilical ligaments'],
    ];
    for (const [prompt, key] of expected) {
        const q = bank.find(q => q.question === prompt);
        assert.ok(q, prompt);
        assert.equal(answer(q), key, q.id);
    }
    const caveat = bank.find(q => q.question.includes('single numerical hypertension threshold'));
    assert.match(answer(caveat), /guideline and measurement setting/);
    assert.equal(caveat.source.kind, 'clinical_application');
    const noSymptoms = bank.find(q => q.question.includes('repeatedly elevated blood pressure'));
    assert.match(answer(noSymptoms), /does not rule out hypertension/);
    assert.ok(!bank.some(q => /defined as.*140\/90|can.t be cured/i.test(q.explanation)));
});
test('vascular route answer keys follow anatomical direction, including veins and fetal shunts', async () => {
    const bank = (await loadQuestionBanks()).get('blood_vessels');
    // Independent ranks for physiological and regional landmarks. Arterial flow
    // runs proximally to distally, while named systemic veins run in reverse.
    const rank = (name, prompt) => {
        const n = name.toLowerCase();
        if (n === 'splenic capillaries') return prompt.includes('arterial supply') ? 4 : 0;
        const exact = {
            lumen: 0, endothelium: 1, 'tunica intima connective tissue': 2, 'tunica media': 3, 'tunica externa': 4,
            'small artery': 0, arteriole: 1, capillary: 2, venule: 3, 'small vein': 4,
            placenta: 0, 'umbilical vein': 1, 'ductus venosus': 2,
            'cerebral veins': 0, 'dural venous sinuses': 1, 'internal jugular vein': 2,
            'splenic capillaries': 0, 'splenic vein': 1, 'superior mesenteric artery': 0,
            'intestinal capillaries': 1, 'superior mesenteric vein': 2, 'hepatic portal vein': 3,
            'liver sinusoids': 4, 'hepatic veins': 5, 'inferior vena cava': 20, 'right atrium': 21,
            'radial veins': 0, 'brachial veins': 1, 'axillary vein': 2, 'subclavian vein': 3,
            'brachiocephalic vein': 4, 'superior vena cava': 5,
            'small saphenous vein': 0, 'great saphenous vein': 0, 'popliteal vein': 1,
            'femoral vein': 2, 'external iliac vein': 3, 'common iliac vein': 4,
            'thoracic aorta': 0, 'descending thoracic aorta': 0, 'abdominal aorta': 1,
            'celiac trunk': 2, 'splenic artery': 3, 'left gastric artery': 3, 'gastric capillaries': 4,
            'renal artery': 2, 'smaller renal arterial branches': 3, 'kidney capillaries': 4,
            'common iliac artery': 2, 'external iliac artery': 3, 'femoral artery': 4,
            'popliteal artery': 5, 'anterior tibial artery': 6, 'posterior tibial artery': 6,
            'dorsalis pedis artery': 7, 'plantar arterial branches': 7, 'plantar capillaries': 8,
            'aortic arch': 0, 'brachiocephalic trunk': 1,
        };
        if (n in exact) return exact[n];
        if (/subclavian artery$/.test(n)) return 2;
        if (/axillary artery$/.test(n)) return 3;
        if (/brachial artery$/.test(n)) return 4;
        if (/(radial|ulnar) artery$/.test(n)) return 5;
        throw new Error(`Unrecognized vascular landmark: ${name}`);
    };
    for (const q of bank.filter(q => q.type === 'ordering')) {
        const ranks = q.correct.map(i => rank(q.options[i], q.question));
        assert.ok(ranks.every((v, i) => !i || v > ranks[i - 1]), `${q.id}: ${answer(q)}`);
    }
});

test('named-vessel and fetal questions use a figure from one of their actual cited diagram slides', async () => {
    const { imageForQuestion } = await import('../src/services/study/images.js');
    const bank = (await loadQuestionBanks()).get('blood_vessels');
    for (const q of bank.filter(q => q.source.slides.every(slide => slide >= 32))) {
        const figure = imageForQuestion(q);
        assert.ok(figure, q.id);
        assert.equal(figure.source.file, q.source.file, q.id);
        assert.ok(q.source.slides.includes(figure.source.slide), q.id);
        assert.equal(figure.match, 'cited-slide', q.id);
    }
});
