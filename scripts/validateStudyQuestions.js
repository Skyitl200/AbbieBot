import { loadQuestionBanks, QUESTION_TYPES } from '../src/services/study/questions.js';
import { STUDY_TOPICS } from '../src/services/study/topics.js';

try {
    const complete = process.argv.includes('--complete');
    const requested = process.argv.find(arg => arg.startsWith('--topics='));
    const selectedIds = requested ? requested.slice('--topics='.length).split(',') : null;
    if (selectedIds?.some(id => !STUDY_TOPICS.some(topic => topic.id === id))) throw new Error('Unknown topic in --topics selection');
    // Check all banks for malformed questions and duplicate prompts even when the
    // completion target is limited to selected topics.
    const banks = await loadQuestionBanks(undefined, { complete: complete && !selectedIds });
    const topics = selectedIds ? STUDY_TOPICS.filter(topic => selectedIds.includes(topic.id)) : STUDY_TOPICS;
    let total = 0;
    for (const topic of topics) {
        const questions = banks.get(topic.id);
        if (complete && questions.length !== topic.target) throw new Error(`${topic.id}: expected ${topic.target} questions, got ${questions.length}`);
        if (complete && QUESTION_TYPES.some(type => !questions.some(question => question.type === type))) throw new Error(`${topic.id}: all three question types required`);
        total += questions.length;
        const counts = Object.fromEntries(QUESTION_TYPES.map(type => [type, questions.filter(q => q.type === type).length]));
        console.log(`${topic.label}: ${questions.length}/${topic.target}`, counts);
    }
    const target = topics.reduce((sum, topic) => sum + topic.target, 0);
    console.log(`Total: ${total}/${target}. ${total === target ? 'Selected topic targets met.' : 'Content preparation is incomplete.'}`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
