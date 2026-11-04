import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadQuestionBanks } from '../src/services/study/questions.js';
import { studyImageIndex, imageForQuestion } from '../src/services/study/images.js';

export async function validateStudyImages() {
    const index = studyImageIndex();
    if (index?.version !== 1) throw new Error('Missing lecture image index');
    const sources = JSON.parse(readFileSync(new URL('../study-data/source-manifest.json', import.meta.url))).sources;
    const banks = await loadQuestionBanks();
    const questions = [...banks.values()].flat();
    const ids = new Set(questions.map(q => q.id));
    for (const id of Object.keys(index.questions)) if (!ids.has(id)) throw new Error(`Stale image reference: ${id}`);
    const used = new Set();
    for (const question of questions) {
        const image = imageForQuestion(question);
        if (!image) throw new Error(`Missing lecture figure: ${question.id}`);
        const source = sources.find(s => s.file === image.source.file);
        if (!source || !Number.isInteger(image.source.slide) || image.source.slide < 1 || image.source.slide > source.slides) throw new Error(`Invalid figure citation: ${question.id}`);
        if (!image.asset.occurrences.some(o => o.source === image.source.file && o.slide === image.source.slide)) throw new Error(`Figure not present on cited slide: ${question.id}`);
        used.add(image.path);
    }
    for (const asset of Object.values(index.assets)) {
        if (!/^[a-f0-9]{20}\.(jpg|png|gif)$/.test(asset.file)) throw new Error('Unsafe figure filename');
        const path = new URL(`../study-assets/${asset.file}`, import.meta.url);
        if (statSync(path).size !== asset.bytes || asset.bytes > 7_500_000) throw new Error(`Figure size mismatch: ${asset.file}`);
        if (createHash('sha256').update(readFileSync(path)).digest('hex') !== asset.sha256) throw new Error(`Figure hash mismatch: ${asset.file}`);
    }
    return { questions: questions.length, images: used.size };
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
    try { console.log(await validateStudyImages()); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
