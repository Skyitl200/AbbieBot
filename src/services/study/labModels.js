import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { shuffle } from './questions.js';

const data = JSON.parse(readFileSync(new URL('../../../study-data/lab-models/early-development.json', import.meta.url), 'utf8'));
export const LAB_MODELS = data.models;
const row = component => new ActionRowBuilder().addComponents(component);
const back = owner => row(new ButtonBuilder().setCustomId(`study:labcategory:${owner}:reproductive`).setLabel('Choose model set').setStyle(ButtonStyle.Secondary));
export function labModelImage(question) {
    const model = LAB_MODELS.find(model => model.id === question.labModelId);
    if (!model) return null;
    const path = fileURLToPath(new URL(`../../../study-assets/lab-models/${model.expectedImageFile}`, import.meta.url));
    return existsSync(path) ? { path, asset: { file: model.expectedImageFile } } : null;
}
export function selectedLabModels(selection) {
    if (selection === 'early-development') return [...LAB_MODELS];
    const tokens = selection.split(',');
    if (!tokens.length || tokens.length > LAB_MODELS.length || new Set(tokens).size !== tokens.length || tokens.some(token => !/^[0-7]$/.test(token))) throw new Error('Unknown model selection');
    return tokens.map(token => LAB_MODELS[Number(token)]);
}
export function labCategoryMessage(owner) {
    return { content: '', embeds: [new EmbedBuilder({ title: '🔬 Anatomy Lab', description: 'Choose a category, then choose a model set and your answer mode.' })], components: [
        row(new StringSelectMenuBuilder().setCustomId(`study:labcategory:${owner}`).setPlaceholder('Choose a category').addOptions({ label: 'Reproductive System', value: 'reproductive', description: 'Early Development Models · 8 photos · Chapter 26' })),
        row(new ButtonBuilder().setCustomId(`study:classpage:${owner}:ap_lab:0`).setLabel('Other saved lab categories').setStyle(ButtonStyle.Secondary)),
        row(new ButtonBuilder().setCustomId(`study:classes:${owner}`).setLabel('Classes').setStyle(ButtonStyle.Secondary)),
    ] };
}
export function labModelsMessage(owner) {
    const missing = LAB_MODELS.some(model => !labModelImage({ labModelId: model.id }));
    return { content: '', embeds: [new EmbedBuilder({ title: 'Reproductive System · Early Development Models', description: 'All eight photos are grouped into one Early Development Models set. Study them together in a mixed session.\n\n' + (missing ? 'Photo identification only: identify the stage and what the model shows. The original photos are not installed yet, so starting this set is unavailable until they are added.' : 'Identify each photo with short Quizlet-style questions.') })], components: [
        row(new StringSelectMenuBuilder().setCustomId(`study:labmodels:${owner}`).setPlaceholder('Choose a model set').addOptions({ label: 'Early Development Models', value: 'early-development', description: 'All 8 photos together: fertilization, cleavage, and implantation' })),
        row(new ButtonBuilder().setCustomId(`study:classes:${owner}`).setLabel('Classes').setStyle(ButtonStyle.Secondary)),
    ] };
}
export function labModeMessage(owner, selection) {
    const models = selectedLabModels(selection);
    return { content: '', embeds: [new EmbedBuilder({ title: 'Choose your answer mode', description: selection === 'early-development' ? 'Early Development Models — all 8 photos studied together. Choose how you want to answer.' : models.map(model => `• ${model.name}`).join('\n') })], components: [
        row(new StringSelectMenuBuilder().setCustomId(`study:labmode:${owner}:${selection}`).setPlaceholder('Multiple choice or type in').addOptions(
            { label: 'Multiple choice', value: 'multiple_choice', description: 'Answer using A, B, C, or D' },
            { label: 'Type in answer', value: 'typed', description: 'Type a short answer; synonyms and minor typos accepted' })),
        back(owner),
    ] };
}
export function labQuestions(selection, mode) {
    if (!['multiple_choice', 'typed'].includes(mode)) throw new Error('Unknown answer mode');
    return shuffle(selectedLabModels(selection).flatMap(model => model.questions
        .filter(question => question.requiresModelImage)
        .map(question => {
            const base = { ...question, labModelId: model.id, modelName: model.name };
            if (mode === 'multiple_choice') return base;
            const { options, correct, ...typed } = base;
            return { ...typed, type: 'fill_blank', question: question.typedQuestion || question.question, answers: [...new Set(question.typedAnswers)] };
        })));
}
