import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { shuffle } from './questions.js';

const loadModels = file => JSON.parse(readFileSync(new URL(`../../../study-data/lab-models/${file}`, import.meta.url), 'utf8')).models;
export const LAB_MODELS = loadModels('early-development.json');
export const LAB_SETS = [
    { id: 'early-development', title: 'Early Development Models', category: 'reproductive', models: LAB_MODELS },
    { id: 'stomach', groupQuestionsByModel: true, title: '3D Model of the Stomach', category: 'digestive', showStructureList: true, models: loadModels('stomach.json') },
    { id: 'larynx-posterior', showStructureList: true, title: '3D Model of Larynx Posterior view', category: 'respiratory', models: loadModels('larynx-posterior.json') },
    { id: 'upper-respiratory', title: 'Upper Respiratory 3D Model', category: 'respiratory', models: loadModels('upper-respiratory.json') },
    { id: 'lungs-larynx', title: 'Lungs and Larynx 3D Model', category: 'respiratory', models: loadModels('lungs-larynx.json') },
    { id: 'lower-urinary', title: '3D Model of the Ureters, Urinary Bladder, and Urethra', category: 'urinary', models: loadModels('lower-urinary.json') },
    { id: 'nephron-2', title: 'Nephron Model 2', category: 'urinary', models: loadModels('nephron-2.json') },
    { id: 'nephron-1', title: 'Nephron Model 1', category: 'urinary', models: loadModels('nephron-1.json') },
    { id: 'urinary-system', title: '3D Model of Urinary System', category: 'urinary', models: loadModels('urinary-system.json') },
    { id: 'kidney', title: 'Kidney 3D Model', category: 'urinary', models: loadModels('kidney.json') },
    { id: 'bronchial-tree', title: 'Bronchial Tree 3D Model', category: 'respiratory', models: loadModels('bronchial-tree.json') },
];
export const LAB_CATEGORIES = [
    { id: 'reproductive', title: 'Reproductive System', chapter: 26 },
    { id: 'respiratory', title: 'Respiratory Tract', chapter: 22 },
    { id: 'urinary', title: 'Urinary System', chapter: 23 },
    { id: 'digestive', title: 'Digestive System', chapter: 23 },
];
const allModels = LAB_SETS.flatMap(set => set.models);
const row = component => new ActionRowBuilder().addComponents(component);
export const labSetForSelection = selection => LAB_SETS.find(set => set.id === selection) || LAB_SETS[0];
const back = (owner, category) => row(new ButtonBuilder().setCustomId(`study:labcategory:${owner}:${category}`).setLabel('Choose model set').setStyle(ButtonStyle.Secondary));
export function labModelImage(question) {
    const model = allModels.find(model => model.id === question.labModelId);
    if (!model) return null;
    const path = fileURLToPath(new URL(`../../../study-assets/lab-models/${model.expectedImageFile}`, import.meta.url));
    return existsSync(path) ? { path, asset: { file: model.expectedImageFile.split('/').at(-1) } } : null;
}
export function selectedLabModels(selection) {
    const set = LAB_SETS.find(set => set.id === selection);
    if (set) return [...set.models];
    // Keep buttons from earlier eight-model menus functional.
    const tokens = selection.split(',');
    if (!tokens.length || tokens.length > LAB_MODELS.length || new Set(tokens).size !== tokens.length || tokens.some(token => !/^[0-7]$/.test(token))) throw new Error('Unknown model selection');
    return tokens.map(token => LAB_MODELS[Number(token)]);
}
export function labCategoryMessage(owner) {
    return { content: '', embeds: [new EmbedBuilder({ title: '🔬 Anatomy Lab', description: 'Choose a category, then choose a model set and your answer mode.' })], components: [
        row(new StringSelectMenuBuilder().setCustomId(`study:labcategory:${owner}`).setPlaceholder('Choose a category').addOptions(LAB_CATEGORIES.map(category => ({ label: category.title, value: category.id, description: `${LAB_SETS.filter(set => set.category === category.id).length} model set(s) · Chapter ${category.chapter}` })))),
        row(new ButtonBuilder().setCustomId(`study:classpage:${owner}:ap_lab:0`).setLabel('Other saved lab categories').setStyle(ButtonStyle.Secondary)),
        row(new ButtonBuilder().setCustomId(`study:classes:${owner}`).setLabel('Classes').setStyle(ButtonStyle.Secondary)),
    ] };
}
export function labModelsMessage(owner, categoryId = 'reproductive') {
    const category = LAB_CATEGORIES.find(category => category.id === categoryId);
    if (!category) throw new Error('Unknown lab category');
    const sets = LAB_SETS.filter(set => set.category === category.id);
    const missing = sets.some(set => set.models.some(model => !labModelImage({ labModelId: model.id })));
    return { content: '', embeds: [new EmbedBuilder({ title: `${category.title} · Model Sets`, description: 'Choose a set to study its images together.\n\n' + (missing ? 'Some model photos are unavailable. Sets need all their photos before a quiz can start.' : 'Identify the model or the structure indicated by the arrow. Use multiple choice or type your answer.') })], components: [
        row(new StringSelectMenuBuilder().setCustomId(`study:labmodels:${owner}`).setPlaceholder('Choose a model set').addOptions(sets.map(set => ({ label: set.title, value: set.id, description: `${set.models.length} images studied together` })))),
        row(new ButtonBuilder().setCustomId(`study:labhome:${owner}`).setLabel('Back to Anatomy Lab').setStyle(ButtonStyle.Secondary)),
    ] };
}
export function labModeMessage(owner, selection) {
    const models = selectedLabModels(selection);
    const set = labSetForSelection(selection);
    return { content: '', embeds: [new EmbedBuilder({ title: 'Choose your answer mode', description: `${set.title} — all ${models.length} photos studied together. ${models.reduce((total, model) => total + model.questions.filter(q => q.requiresModelImage).length, 0)} questions. Choose how you want to answer.${set.showStructureList ? `\n\nIncluded structures: ${models.map(model => model.name).join(', ')}.` : ''}` })], components: [
        row(new StringSelectMenuBuilder().setCustomId(`study:labmode:${owner}:${selection}`).setPlaceholder('Multiple choice or type in').addOptions(
            { label: 'Multiple choice', value: 'multiple_choice', description: 'Answer using A, B, C, or D' },
            { label: 'Type in answer', value: 'typed', description: 'Type a short answer; synonyms and minor typos accepted' })),
        back(owner, set.category),
    ] };
}
export function labQuestions(selection, mode) {
    if (!['multiple_choice', 'typed'].includes(mode)) throw new Error('Unknown answer mode');
    const models = selectedLabModels(selection);
    const grouped = labSetForSelection(selection).groupQuestionsByModel;
    const orderedModels = grouped ? shuffle([...models]) : models;
    const questions = orderedModels.flatMap(model => model.questions
        .filter(question => question.requiresModelImage)
        .map(question => {
            const base = { ...question, labModelId: model.id, modelName: model.name };
            if (mode === 'multiple_choice') return base;
            const { options, correct, ...typed } = base;
            return { ...typed, type: 'fill_blank', question: question.typedQuestion || question.question, answers: [...new Set(question.typedAnswers)], competingAnswers: question.labQuestionRole === 'followup' ? options.filter((_, index) => !correct.includes(index)) : models.filter(other => other.id !== model.id && other.name !== model.name).flatMap(other => other.questions.filter(q => q.labQuestionRole !== 'followup').flatMap(q => q.typedAnswers)) };
        }));
    return grouped ? questions : shuffle(questions);
}
