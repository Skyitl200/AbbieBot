import fs from 'fs';
import path from 'path';

import { pgDb } from '../src/utils/database.js';

const REQUIRED_FIELDS = [
    'subject',
    'category',
    'difficulty',
    'question',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'correct_answer',
    'explanation'
];

function cleanText(value) {
    return String(value ?? '').trim();
}

function validateQuestion(question, index) {
    const errors = [];

    for (const field of REQUIRED_FIELDS) {
        if (!cleanText(question[field])) {
            errors.push(`Missing "${field}"`);
        }
    }

    const correctAnswer = cleanText(
        question.correct_answer
    ).toUpperCase();

    if (
        correctAnswer &&
        !['A', 'B', 'C', 'D'].includes(correctAnswer)
    ) {
        errors.push(
            'correct_answer must be A, B, C, or D'
        );
    }

    const difficulty = cleanText(
        question.difficulty
    ).toLowerCase();

    if (
        difficulty &&
        !['easy', 'medium', 'hard'].includes(difficulty)
    ) {
        errors.push(
            'difficulty must be easy, medium, or hard'
        );
    }

    if (errors.length > 0) {
        return {
            valid: false,
            message:
                `Question ${index + 1}: ` +
                errors.join(', ')
        };
    }

    return {
        valid: true
    };
}

async function questionAlreadyExists(question) {
    const result = await pgDb.pool.query(
        `
        SELECT id
        FROM quiz_questions
        WHERE LOWER(TRIM(question)) = LOWER(TRIM($1))
        LIMIT 1
        `,
        [question]
    );

    return result.rows.length > 0;
}

async function insertQuestion(question) {
    const points = Number.isFinite(
        Number(question.points)
    )
        ? Number(question.points)
        : 10;

    await pgDb.pool.query(
        `
        INSERT INTO quiz_questions (
            subject,
            category,
            difficulty,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer,
            explanation,
            points
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11
        )
        `,
        [
            cleanText(question.subject),
            cleanText(question.category),
            cleanText(question.difficulty).toLowerCase(),
            cleanText(question.question),
            cleanText(question.option_a),
            cleanText(question.option_b),
            cleanText(question.option_c),
            cleanText(question.option_d),
            cleanText(question.correct_answer).toUpperCase(),
            cleanText(question.explanation),
            points
        ]
    );
}

async function runImport() {
    let connected = false;

    try {
        const fileArgument = process.argv[2];

        if (!fileArgument) {
            throw new Error(
                'No question file provided.'
            );
        }

        const filePath = path.resolve(
            process.cwd(),
            fileArgument
        );

        if (!fs.existsSync(filePath)) {
            throw new Error(
                `Question file not found: ${filePath}`
            );
        }

        console.log('📚 Reading quiz questions...');

        const rawFile = fs.readFileSync(
            filePath,
            'utf8'
        );

        let questions;

        try {
            questions = JSON.parse(rawFile);
        } catch {
            throw new Error(
                'The question file is not valid JSON.'
            );
        }

        if (!Array.isArray(questions)) {
            throw new Error(
                'The JSON file must contain an array of questions.'
            );
        }

        if (questions.length === 0) {
            throw new Error(
                'The question file contains no questions.'
            );
        }

        console.log(
            `📖 Found ${questions.length} question(s).`
        );

        // Validate the entire file BEFORE touching PostgreSQL.
        const validationErrors = [];

        questions.forEach((question, index) => {
            const validation =
                validateQuestion(question, index);

            if (!validation.valid) {
                validationErrors.push(
                    validation.message
                );
            }
        });

        if (validationErrors.length > 0) {
            console.error(
                '\n❌ Import cancelled because some questions are invalid:\n'
            );

            validationErrors.forEach(error => {
                console.error(`- ${error}`);
            });

            process.exitCode = 1;
            return;
        }

        console.log(
            '✅ All questions passed validation.'
        );

        console.log(
            '🔌 Connecting to PostgreSQL...'
        );

        const success = await pgDb.connect();

        if (!success || !pgDb.pool) {
            throw new Error(
                'Could not connect to PostgreSQL.'
            );
        }

        connected = true;

        console.log(
            '✅ PostgreSQL connected.'
        );

        let inserted = 0;
        let duplicates = 0;

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];

            const duplicate =
                await questionAlreadyExists(
                    cleanText(question.question)
                );

            if (duplicate) {
                duplicates++;

                console.log(
                    `⏭️ Duplicate skipped: ${question.question}`
                );

                continue;
            }

            await insertQuestion(question);

            inserted++;

            console.log(
                `✅ ${inserted}: ${question.question}`
            );
        }

        console.log('\n==============================');
        console.log('🎉 QUIZ IMPORT COMPLETE');
        console.log('==============================');
        console.log(
            `📚 File questions: ${questions.length}`
        );
        console.log(
            `✅ Added: ${inserted}`
        );
        console.log(
            `⏭️ Duplicates skipped: ${duplicates}`
        );
        console.log('==============================');

    } catch (error) {
        console.error(
            '\n❌ Quiz import failed:'
        );

        console.error(error);

        process.exitCode = 1;

    } finally {
        if (connected) {
            await pgDb.disconnect();
        }
    }
}

await runImport();
