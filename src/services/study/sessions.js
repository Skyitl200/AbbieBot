import { randomUUID } from 'node:crypto';
import { gradeQuestion, shuffle } from './questions.js';

const sessions = new Map();
const TTL = 2 * 60 * 60 * 1000;
const key = (guildId, userId) => `${guildId ?? 'dm'}:${userId}`;

export function createStudySession(guildId, userId, questions, topicId, now = Date.now()) {
    for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
    if (!questions.length) throw new Error('Cannot start an empty session');
    const session = { id: randomUUID().slice(0, 8), rewardId: randomUUID(), guildId, userId, topicId, questions,
        index: 0, score: 0, moneyEarned: 0, answeredQuestions: new Map(), answered: false, revision: 0, order: [], expiresAt: now + TTL };
    prepareQuestion(session);
    sessions.set(key(guildId, userId), session);
    return session;
}

function prepareQuestion(session) {
    const q = session.questions[session.index];
    session.displayOrder = q.options ? shuffle(q.options.map((_, i) => i)) : [];
    // Don't reveal an ordering answer through an accidentally sorted initial display.
    if (q.type === 'ordering' && session.displayOrder.every((value, i) => value === q.correct[i])) session.displayOrder.reverse();
    session.order = [];
    session.answered = false;
    session.reward = null;
    session.lastCorrect = null;
}

export function getStudySession(guildId, userId, token, now = Date.now()) {
    const id = key(guildId, userId);
    const session = sessions.get(id);
    if (session && session.expiresAt <= now) { sessions.delete(id); return null; }
    if (!session || session.id !== token) return null;
    return session;
}

export function checkStudyAction(session, index, revision, now = Date.now()) {
    if (!session || session.expiresAt <= now || session.index !== Number(index) || session.revision !== Number(revision)) throw new Error('This question has expired. Use the latest study message or start /test again.');
}

export function chooseOrderItem(session, value) {
    const q = session.questions[session.index];
    if (session.answered || q.type !== 'ordering' || !Number.isInteger(value) || !session.displayOrder.includes(value) || session.order.includes(value)) throw new Error('Invalid ordering choice');
    session.order.push(value);
    session.revision++;
}

export function undoOrderItem(session) {
    if (session.answered || session.questions[session.index].type !== 'ordering' || !session.order.length) throw new Error('Nothing to undo');
    session.order.pop();
    session.revision++;
}

export function submitStudyAnswer(session, answer) {
    if (session.answered) throw new Error('This question has already been answered.');
    const correct = gradeQuestion(session.questions[session.index], answer);
    session.answered = true;
    session.answeredQuestions.set(session.index, { displayOrder: [...session.displayOrder], publicQuestionId: session.publicQuestionId || null });
    session.lastCorrect = correct;
    session.revision++;
    if (correct) session.score++;
    session.expiresAt = Date.now() + TTL;
    return correct;
}

export function nextStudyQuestion(session) {
    if (!session.answered) throw new Error('Answer the current question first.');
    if (session.guildId && session.reward && session.lastCorrect && session.reward.status !== 'saved') throw new Error('This coin award is not saved yet. Please retry the reward first.');
    if (session.index + 1 >= session.questions.length) throw new Error('This test is complete.');
    session.index++;
    session.revision++;
    session.expiresAt = Date.now() + TTL;
    prepareQuestion(session);
}
