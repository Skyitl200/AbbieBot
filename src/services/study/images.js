import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';

const directory = new URL('../../../study-assets/', import.meta.url);
let cached;
export function studyImageIndex() {
    if (cached === undefined) {
        try { cached = JSON.parse(readFileSync(new URL('../../../study-data/images.json', import.meta.url), 'utf8')); }
        catch { cached = null; }
    }
    return cached;
}
export function imageForQuestion(question) {
    const index = studyImageIndex();
    const reference = index?.questions?.[question.id];
    const asset = index?.assets?.[reference?.asset];
    if (!asset || !/^[a-f0-9]{20}\.(jpg|png|gif)$/.test(asset.file) || asset.bytes > 7_500_000) return null;
    const path = fileURLToPath(new URL(asset.file, directory));
    if (!existsSync(path)) return null;
    return { ...reference, asset, path };
}
export function addLectureImage(payload, question) {
    const figure = imageForQuestion(question);
    if (!figure) return { ...payload, attachments: [], files: [] };
    const embed = payload.embeds[0];
    embed.setImage(`attachment://${figure.asset.file}`);
    return { ...payload, attachments: [], files: [new AttachmentBuilder(figure.path, { name: figure.asset.file })] };
}
export function lecturePreview(question) {
    return addLectureImage({ content: '', embeds: [new EmbedBuilder().setTitle('📖 Lecture figure preview')
        .setDescription('This reference figure may contain labels that help reveal the answer. Your score and question are unchanged.')], components: [] }, question);
}
