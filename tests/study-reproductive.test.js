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

test('Reproductive supplies 600 introductory questions in the three active formats', async () => {
    const bank = (await loadQuestionBanks()).get('reproductive');
    assert.equal(bank.length, 600);
    assert.equal(new Set(bank.map(q => q.question.toLowerCase())).size, 600);
    for (const [type, count] of [['multiple_choice', 380], ['fill_blank', 160], ['ordering', 60]]) assert.equal(bank.filter(q => q.type === type).length, count);
    for (const q of bank) {
        assert.ok(['easy', 'medium'].includes(q.difficulty), q.id);
        assert.doesNotMatch(q.question, /select all|calculate|according to the slides/i, q.id);
        assert.equal(q.source.file, 'Reproductive System Chapter 26.pptx');
        assert.ok(q.source.slides.every(s => s >= 5 && s <= 73), q.id);
        if (q.source.kind === 'clinical_application') assert.ok(q.source.rationale, q.id);
        if (q.type === 'ordering') assert.equal(q.options.length, 3, q.id);
    }
});

test('reproductive cell, hormone, and tissue keys match physiological reference facts', async () => {
    const bank = (await loadQuestionBanks()).get('reproductive');
    const expected = [
        ['FSH acts on testicular ____ cells.', 'Sertoli'],
        ['LH stimulates testosterone production by ____ cells.', 'Leydig'],
        ['Inhibin mainly reduces pituitary release of ____.', 'FSH'],
        ['The primary oocyte is arrested in prophase ____.', 'I'],
        ['The secondary oocyte is usually arrested in metaphase ____.', 'II'],
        ['The cell normally released is a ____ oocyte.', 'secondary'],
        ['The major luteal hormone supporting secretory endometrium is ____.', 'progesterone'],
        ['The layer shed during menses is the stratum ____.', 'functionalis'],
        ['Endometrial regeneration is supported by the stratum ____.', 'basalis'],
        ['The membranous urethra is also called the ____ urethra.', 'intermediate'],
        ['The usual tubal site of fertilization is the ____.', 'ampulla'],
        ['The hormone strongly supporting milk synthesis is ____.', 'prolactin'],
        ['Oxytocin supports milk ____ rather than being the main milk-synthesis hormone.', 'ejection'],
    ];
    for (const [prompt, key] of expected) assert.equal(answer(find(bank, prompt)), key);
});

test('sperm and oocyte transport keys respect regional anatomy and opposing tubal directions', async () => {
    const bank = (await loadQuestionBanks()).get('reproductive');
    const sperm = ['Seminiferous tubule', 'Straight tubule', 'Rete testis', 'Efferent ductules', 'Epididymal head', 'Epididymal body', 'Epididymal tail', 'Ductus deferens', 'Ejaculatory duct', 'Prostatic urethra', 'Membranous urethra', 'Spongy urethra', 'External urethral opening'];
    const male = bank.filter(q => q.type === 'ordering' && /initial testicular sperm drainage|epididymal transit toward the ejaculatory duct|selected sperm transport from storage toward the urethra|selected final seminal outflow landmarks/.test(q.question));
    assert.equal(male.length, 12);
    for (const q of male) {
        const ranks = q.correct.map(i => sperm.indexOf(q.options[i]));
        assert.ok(ranks.every((r, i) => r >= 0 && (!i || r > ranks[i - 1])), q.id);
    }
    const models = [
        ['an oocyte-associated route toward the uterine cavity', ['Fimbrial pickup region', 'Infundibulum', 'Tubal ampulla', 'Tubal isthmus', 'Uterine cavity']],
        ['a selected sperm route toward the usual tubal fertilization region', ['Vagina', 'Cervical canal', 'Uterine cavity', 'Tubal isthmus', 'Tubal ampulla']],
        ['uterine wall landmarks from the outside toward the cavity', ['Perimetrium', 'Myometrium', 'Stratum basalis', 'Stratum functionalis', 'Uterine lumen']],
        ['selected milk-flow landmarks toward the exterior', ['Mammary alveoli', 'Small mammary ducts', 'Lactiferous ducts', 'Duct openings at the nipple', 'Milk reaches the exterior']],
    ];
    for (const [phrase, reference] of models) {
        const selected = bank.filter(q => q.type === 'ordering' && q.question.includes(phrase));
        assert.equal(selected.length, 3, phrase);
        for (const q of selected) {
            const ranks = q.correct.map(i => reference.indexOf(q.options[i]));
            assert.ok(ranks.every((r, i) => r >= 0 && (!i || r > ranks[i - 1])), q.id);
        }
    }
});

test('reproductive slide corrections preserve meiotic timing, variable cycles, and nonpregnant luteal secretion', async () => {
    const bank = (await loadQuestionBanks()).get('reproductive');
    const checks = [
        ['Are testosterone-producing Leydig cells normally within the seminiferous-tubule lumen?', /interstitial cells between tubules/],
        ['Does inhibin mainly reduce testosterone by directly replacing the LH-Leydig pathway?', /principal selective feedback is on FSH/],
        ['Does an ordinarily ovulated human secondary oocyte already have meiosis II completed?', /arrested until fertilization-related activation/],
        ['Is ovulation fixed to cycle day fourteen in every person and every cycle?', /not establish an identical ovulation day/],
        ['Is the luteal phase always exactly fourteen days with no variation?', /can vary/],
        ['Does a corpus luteum make progesterone only when pregnancy is already established?', /ordinary nonpregnant luteal phase/],
        ['Is the infundibulum the narrow medial end of a uterine tube next to the uterus?', /lateral funnel-shaped region/],
        ['Which tissue normally lines the uterine lumen?', /^Epithelium$/],
        ['Does the overall alkalinity of semen mean every contributing gland secretes alkaline fluid?', /prostatic fluid is often mildly acidic/],
        ['Which lactation-source pairing is correct?', /Prolactin: anterior pituitary; oxytocin release: posterior pituitary/],
    ];
    for (const [prompt, pattern] of checks) {
        const q = find(bank, prompt);
        assert.match(answer(q), pattern, q.id);
        assert.equal(q.source.kind, 'clinical_application', q.id);
    }
});

test('cancer and screening examples avoid fixed schedules, genetic inevitability, and symptom-only diagnosis', async () => {
    const bank = (await loadQuestionBanks()).get('reproductive');
    const checks = [
        ['Does the presence of a normal BRCA1 or BRCA2 gene itself diagnose cancer?', /genes normally exist in people without cancer/],
        ['What distinguishes having BRCA genes from having a pathogenic BRCA variant?', /certain variants can increase cancer susceptibility/],
        ['Can urinary symptoms alone distinguish BPH from prostate cancer with certainty?', /symptoms overlap/],
        ['Does sexual inactivity alone automatically establish that cervical screening is unnecessary?', /history and applicable guidance/],
        ['Is an HPV vaccination schedule identical for every age and health context?', /age, prior vaccination, and clinical context/],
        ['Does HPV vaccination itself remove every future need for guideline-based cervical screening?', /different kinds of protection/],
    ];
    for (const [prompt, pattern] of checks) assert.match(answer(find(bank, prompt)), pattern);
    assert.ok(!bank.some(q => /recommended every \d|every \d years|all.*exactly.*three doses/i.test(answer(q))));
});

test('every Reproductive question has a cited lecture figure, with normal anatomy used for cancer context', async () => {
    const bank = (await loadQuestionBanks()).get('reproductive');
    const illustrated = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 32, 38, 39, 40, 41, 42, 43, 45, 47, 48, 52, 54, 55, 57, 58, 60, 63, 64, 65, 66, 67, 68, 69, 70, 71]);
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
        if (q.source.slides.some(s => illustrated.has(s))) {
            assert.equal(figure.match, 'cited-slide', q.id);
            assert.ok(q.source.slides.includes(figure.source.slide), q.id);
        }
        if (q.source.slides.length === 1 && q.source.slides[0] === 21) assert.equal(figure.source.slide, 6, q.id);
        if (q.source.slides.every(s => [49, 50].includes(s))) assert.equal(figure.source.slide, 47, q.id);
        if (q.source.slides.length === 1 && q.source.slides[0] === 44) assert.equal(figure.source.slide, 43, q.id);
    }
});
