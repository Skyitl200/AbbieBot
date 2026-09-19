import { pgDb } from '../src/utils/database.js';

async function deleteUrinaryQuestions() {
    let connected = false;

    try {
        console.log('🔌 Connecting to PostgreSQL...');

        const success = await pgDb.connect();

        if (!success || !pgDb.pool) {
            throw new Error(
                'Could not connect to PostgreSQL.'
            );
        }

        connected = true;

        console.log('✅ PostgreSQL connected.');

        // First count exactly what will be deleted.
        const countResult = await pgDb.pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM quiz_questions
            WHERE LOWER(TRIM(subject)) = LOWER(TRIM($1))
              AND LOWER(TRIM(category)) = LOWER(TRIM($2))
            `,
            ['Anatomy & Physiology', 'Urinary System']
        );

        const count = countResult.rows[0].count;

        console.log(
            `🔎 Found ${count} Urinary System question(s).`
        );

        if (count === 0) {
            console.log('Nothing to delete.');
            return;
        }

        const result = await pgDb.pool.query(
            `
            DELETE FROM quiz_questions
            WHERE LOWER(TRIM(subject)) = LOWER(TRIM($1))
              AND LOWER(TRIM(category)) = LOWER(TRIM($2))
            RETURNING id
            `,
            ['Anatomy & Physiology', 'Urinary System']
        );

        console.log(
            `✅ Deleted ${result.rowCount} Urinary System question(s).`
        );

        console.log(
            '🛡️ All other subjects and categories were left untouched.'
        );

    } catch (error) {
        console.error(
            '❌ Failed to delete Urinary System questions:'
        );

        console.error(error);

        process.exitCode = 1;

    } finally {
        if (connected) {
            await pgDb.disconnect();
        }
    }
}

await deleteUrinaryQuestions();
