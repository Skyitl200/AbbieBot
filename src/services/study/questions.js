import { buildLectureChoiceContext, prepareLectureChoice } from './lectureChoices.js';
import { matchesLabAnswer } from './answerMatching.js';
import { readFile } from 'node:fs/promises';
import { TOPIC_BY_ID, STUDY_TOPICS } from './topics.js';

export const QUESTION_TYPES = ['multiple_choice', 'fill_blank', 'ordering'];
const defaultDirectory = new URL('../../../study-data/', import.meta.url);
export const normalizeAnswer = value => String(value).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

export function validateQuestion(q, topic) {
    const fail = message => { throw new Error(`${topic.id}/${q?.id ?? '?'}: ${message}`); };
    const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
    if (!text(q?.id, 64) || !/^[a-z0-9_-]+$/.test(q.id)) fail('invalid id');
    if (!QUESTION_TYPES.includes(q.type)) fail('unsupported question type');
    if (!text(q.question, 1500) || !text(q.explanation, 1000)) fail('question/explanation missing or too long');
    if (/\b(?:based on|according to|in|from) (?:the |these )?(?:slides?|presentation)\b/i.test(q.question)) fail('question must stand alone');
    if (!['easy', 'medium', 'hard'].includes(q.difficulty)) fail('invalid difficulty');
    if (q.source?.file !== topic.source || !Array.isArray(q.source.slides) || !q.source.slides.length ||
        !q.source.slides.every(n => Number.isInteger(n) && n > 0)) fail('source slide references required');
    if (!['slide', 'clinical_application'].includes(q.source.kind)) fail('source kind required');
    if (q.source.kind === 'clinical_application' && !text(q.source.rationale, 1000)) fail('clinical correlation rationale required');
    if (q.type === 'fill_blank') {
        if (!q.question.includes('____')) fail('blank marker required');
        if (!Array.isArray(q.answers) || !q.answers.length || !q.answers.every(a => text(a, 300))) fail('accepted answers required');
    } else {
        const min = q.type === 'ordering' ? 3 : 2;
        if (!Array.isArray(q.options) || q.options.length < min || q.options.length > 8 || !q.options.every(a => text(a, 180))) fail('invalid options');
        if (new Set(q.options.map(normalizeAnswer)).size !== q.options.length) fail('duplicate options');
        if (!Array.isArray(q.correct) || !q.correct.length || new Set(q.correct).size !== q.correct.length ||
            !q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length)) fail('invalid correct indices');
        if (q.type === 'multiple_choice' && q.correct.length !== 1) fail('single correct answer required');
        if (q.type === 'ordering' && q.correct.length !== q.options.length) fail('ordering must include every option');
    }
    // The wording requirement concerns arteries, not the similarly named veins.
    // Only the primary fill-in answer is displayed; accepted aliases need not carry the full label.
    const visibleText = [q.question, q.explanation, ...(q.options || []), q.answers?.[0] || ''].join(' ');
    const arteryLabel = 'interlobular (also known as cortical radiate artery)';
    const unqualifiedText = visibleText.split(arteryLabel).join('')
        .replace(/\b(?:interlobular|cortical radiate)\s+(?:veins?|venules?)\b/gi, '');
    if (topic.id === 'urinary' && /interlobular|cortical radiate/i.test(unqualifiedText)) fail('required interlobular artery wording missing');
    return q;
}

export async function loadQuestionBanks(directory = defaultDirectory, { complete = false } = {}) {
    const manifest = JSON.parse(await readFile(new URL('source-manifest.json', defaultDirectory), 'utf8'));
    if (manifest.version !== 1 || !Array.isArray(manifest.sources)) throw new Error('Unsupported study source manifest');
    const sourceSlides = new Map(manifest.sources.map(source => [source.file, source.slides]));
    const seenIds = new Set();
    const seenPrompts = new Set();
    const banks = new Map();
    for (const topic of STUDY_TOPICS) {
        const slideCount = sourceSlides.get(topic.source);
        if (!Number.isInteger(slideCount) || slideCount < 1) throw new Error(`${topic.id}: source slide inventory missing`);
        let questions;
        try {
            questions = JSON.parse(await readFile(new URL(`${topic.id}.json`, directory), 'utf8'));
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            questions = [];
        }
        if (!Array.isArray(questions)) throw new Error(`${topic.id}: expected a question array`);
        if (questions.length > topic.target || (complete && questions.length !== topic.target)) throw new Error(`${topic.id}: expected ${topic.target} questions, got ${questions.length}`);
        const types = new Set();
        for (const question of questions) {
            validateQuestion(question, topic);
            if (question.source.slides.some(slide => slide > slideCount)) throw new Error(`${topic.id}/${question.id}: source slide exceeds ${slideCount}`);
            const prompt = normalizeAnswer(question.question);
            if (seenIds.has(question.id) || seenPrompts.has(prompt)) throw new Error(`${topic.id}: duplicate question ${question.id}`);
            seenIds.add(question.id);
            seenPrompts.add(prompt);
            types.add(question.type);
        }
        if (complete && QUESTION_TYPES.some(type => !types.has(type))) throw new Error(`${topic.id}: all three question types required`);
        banks.set(topic.id, questions);
    }
    return banks;
}

export function gradeQuestion(question, answer) {
    if (question.type === 'fill_blank' && question.labModelId) return matchesLabAnswer(answer, question.answers, question.competingAnswers);
    if (question.type === 'fill_blank') return question.answers.some(a => normalizeAnswer(a) === normalizeAnswer(answer));
    if (!Array.isArray(answer) || answer.some(i => !Number.isInteger(i)) || new Set(answer).size !== answer.length) return false;
    const expected = question.correct;
    if (answer.length !== expected.length) return false;
    if (question.type === 'ordering') return answer.every((value, i) => value === expected[i]);
    return answer.every(value => expected.includes(value));
}

export function answerText(question) {
    return question.type === 'fill_blank' ? question.answers[0] : question.correct.map(i => question.options[i]).join(question.type === 'ordering' ? ' → ' : '; ');
}

export function shuffle(values, random = Math.random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

const lectureChoiceContexts = new WeakMap();

export function selectQuestions(banks, topicId, count) {
    if (topicId !== 'random' && !TOPIC_BY_ID.has(topicId)) throw new Error('Unknown study topic');
    if (![1, 5, 20, 50, 150, 600].includes(count)) throw new Error('Invalid session length');
    const available = topicId === 'random' ? [...banks.values()].flat() : banks.get(topicId) || [];
    if (!available.length) throw new Error('This topic is still being prepared. Please choose another topic.');
    let context = lectureChoiceContexts.get(banks);
    if (!context) { context = buildLectureChoiceContext(banks); lectureChoiceContexts.set(banks, context); }
    const topicById = new Map([...banks].flatMap(([id, questions]) => questions.map(q => [q.id, id])));
    return shuffle(available).slice(0, count).map(q => prepareLectureChoice(q, context, topicById.get(q.id)));
}
