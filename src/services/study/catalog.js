import { createHash } from 'node:crypto';

export const STUDY_CLASSES = [
    { id: 'ap_lecture', label: 'Anatomy and Physiology Lecture', emoji: '🫀', description: 'Study anatomy and physiology lecture topics', authored: true },
    { id: 'ap_lab', label: 'Anatomy Lab', emoji: '🔬', aliases: ['Anatomy Lab', 'Anatomy and Physiology Lab', 'Anatomy & Physiology Lab', 'Physiology and Anatomy Lab', 'Physiology & Anatomy Lab', 'A&P Lab', 'Anatomy and Physiology Laboratory'] },
    { id: 'micro_lecture', label: 'Microbiology Lecture', emoji: '🦠', aliases: ['Microbiology Lecture', 'Microbiology'] },
    { id: 'micro_lab', label: 'Microbiology Lab', emoji: '🧫', aliases: ['Microbiology Lab', 'Microbiology Laboratory'] },
    { id: 'chem_lecture', label: 'Chemistry Lecture', emoji: '⚗️', aliases: ['Chemistry Lecture', 'Chemistry'] },
    { id: 'chem_lab', label: 'Chemistry LAB', emoji: '🧪', aliases: ['Chemistry Lab', 'Chemistry Laboratory'] },
    { id: 'teas', label: 'TEAS', emoji: '📚', aliases: ['TEAS', 'ATI TEAS'] },
    { id: 'nursing', label: 'Nursing', emoji: '🩺', aliases: ['Nursing', 'Nursing Lecture'] },
];
export const CLASS_BY_ID = new Map(STUDY_CLASSES.map(course => [course.id, course]));
export const categoryToken = label => createHash('sha256').update(label).digest('hex').slice(0, 12);
const normalizeSubject = label => label.toLowerCase().replace(/[^a-z0-9]/g, '');
const categorySql = "COALESCE(NULLIF(TRIM(category), ''), 'General')";
const subjectSql = "REGEXP_REPLACE(LOWER(subject), '[^a-z0-9]', '', 'g') = ANY($1::text[])";

async function poolFor(client) {
    // Use the running bot's database; the singleton supports older client wiring.
    const pool = client.db?.db?.pool || client.db?.pool;
    if (pool) return pool;
    const { pgDb } = await import('../../utils/database.js');
    if (!pgDb.pool) throw new Error('This class database is currently unavailable. Please try again later.');
    return pgDb.pool;
}
function aliasesFor(classId) {
    const course = CLASS_BY_ID.get(classId);
    if (!course || course.authored) throw new Error('Unknown study class');
    return course.aliases.map(normalizeSubject);
}
export async function loadClassCategories(client, classId) {
    const aliases = aliasesFor(classId);
    const pool = await poolFor(client);
    const result = await pool.query(`SELECT ${categorySql} AS category, COUNT(*)::int AS count FROM quiz_questions WHERE ${subjectSql} GROUP BY ${categorySql} ORDER BY ${categorySql}`, [aliases]);
    return result.rows.map(row => ({ label: row.category, token: categoryToken(row.category), count: Number(row.count) }));
}
export function adaptLegacyQuestion(row) {
    const options = ['option_a', 'option_b', 'option_c', 'option_d'].map(key => String(row[key] ?? '').trim());
    const correct = 'ABCD'.indexOf(String(row.correct_answer ?? '').trim().toUpperCase());
    if (!row.question || String(row.correct_answer ?? '').trim().length !== 1 || correct < 0 || options.some(option => !option || option.length > 700) || options.join('').length > 2000 || String(row.question).length > 1500) return null;
    return { id: `saved-${row.id}`, type: 'multiple_choice', question: String(row.question), options,
        correct: [correct], explanation: String(row.explanation || 'No explanation was provided for this saved question.').slice(0, 2000), difficulty: row.difficulty || 'medium' };
}
export async function loadClassQuestions(client, classId, token, count) {
    if (![1, 5, 20, 50, 150, 600].includes(count)) throw new Error('Invalid session length');
    const categories = await loadClassCategories(client, classId);
    const category = categories.find(item => item.token === token);
    if (token !== 'random' && !category) throw new Error('Unknown class category');
    const pool = await poolFor(client);
    const params = [aliasesFor(classId)];
    const filter = category ? ` AND ${categorySql} = $${params.push(category.label)}` : '';
    params.push(count);
    const result = await pool.query(`SELECT * FROM quiz_questions WHERE ${subjectSql}${filter} ORDER BY RANDOM() LIMIT $${params.length}`, params);
    const questions = result.rows.map(adaptLegacyQuestion).filter(Boolean);
    if (!questions.length) throw new Error('This class has no playable questions in that category yet. Please choose another category.');
    return questions;
}
