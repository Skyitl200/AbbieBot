const quizSessions = new Map();

function makeSessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

export function createQuizSession({
    guildId,
    userId,
    questions,
    category
}) {
    const key = makeSessionKey(guildId, userId);

    const session = {
        guildId,
        userId,
        category,

        questions,

        currentIndex: 0,

        correct: 0,
        incorrect: 0,

        moneyEarned: 0,

        startedAt: Date.now()
    };

    quizSessions.set(key, session);

    return session;
}

export function getQuizSession(guildId, userId) {
    const key = makeSessionKey(guildId, userId);

    return quizSessions.get(key) || null;
}

export function deleteQuizSession(guildId, userId) {
    const key = makeSessionKey(guildId, userId);

    quizSessions.delete(key);
}

export function getCurrentQuestion(session) {
    if (!session) {
        return null;
    }

    return session.questions[session.currentIndex] || null;
}

export function moveToNextQuestion(session) {
    if (!session) {
        return null;
    }

    session.currentIndex += 1;

    return getCurrentQuestion(session);
}

export function isQuizComplete(session) {
    if (!session) {
        return true;
    }

    return session.currentIndex >= session.questions.length;
}

export function recordQuizAnswer(session, isCorrect, reward = 10) {
    if (!session) {
        return;
    }

    if (isCorrect) {
        session.correct += 1;
        session.moneyEarned += reward;
    } else {
        session.incorrect += 1;
    }
}

export function getQuizProgress(session) {
    if (!session) {
        return null;
    }

    return {
        current: session.currentIndex + 1,
        total: session.questions.length,
        correct: session.correct,
        incorrect: session.incorrect,
        moneyEarned: session.moneyEarned
    };
}
