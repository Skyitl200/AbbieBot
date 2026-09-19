import { pgDb } from '../src/utils/database.js';

async function deleteUrinaryQuestions() {
    try {
        const result = await pgDb.query(
            `DELETE FROM quiz_questions
             WHERE LOWER(subject) = LOWER($1)
             AND LOWER(category) = LOWER($2)
             RETURNING id`,
            ['Anatomy & Physiology', 'Urinary System']
        );

        console.log(`✅ Deleted ${result.rowCount} Urinary System questions.`);
        console.log('All other quiz categories were left untouched.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to delete Urinary System questions:');
        console.error(error);
        process.exit(1);
    }
}

deleteUrinaryQuestions();
