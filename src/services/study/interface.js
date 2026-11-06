import { cacheFoundNotice } from '../discovery/catalog.js';
import { labCategoryMessage, labModelsMessage, labModeMessage, labQuestions, labSetForSelection } from './labModels.js';
import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
    ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { imageForQuestion, addLectureImage, lecturePreview } from './images.js';
import { STUDY_TOPICS, TOPIC_BY_ID } from './topics.js';
import { STUDY_CLASSES, CLASS_BY_ID, loadClassCategories, loadClassQuestions } from './catalog.js';
import { settleStudyReward, COIN_EMOJI, BALANCE_EMOJI } from './rewards.js';
import { answerText, loadQuestionBanks, selectQuestions } from './questions.js';
import {
    createStudySession, getStudySession, checkStudyAction, chooseOrderItem,
    undoOrderItem, submitStudyAnswer, nextStudyQuestion,
} from './sessions.js';

const TYPE_LABELS = {
    multiple_choice: 'Multiple choice', fill_blank: 'Fill in the blank',
    ordering: 'Put in the correct order',
};
const row = (...components) => new ActionRowBuilder().addComponents(...components);
const button = (id, label, style = ButtonStyle.Primary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const actionId = (session, action) => `study:${action}:${session.userId}:${session.id}:${session.index}:${session.revision}`;

export function classMessage(ownerId) {
    const menu = new StringSelectMenuBuilder().setCustomId(`study:class:${ownerId}`)
        .setPlaceholder('Choose your class...').addOptions(STUDY_CLASSES.map(course => ({
            label: course.label, value: course.id, emoji: course.emoji,
            description: course.description || `Choose a ${course.label} category`,
        })));
    return { content: '', embeds: [new EmbedBuilder().setTitle('📚 Study Classes')
        .setDescription('Choose your class, then a category and session length. Correct answers earn **5–30 Merit Coins**, with higher amounts more likely.')], components: [row(menu)] };
}

export function classCategoriesMessage(ownerId, classId, categories, requestedPage = 0) {
    const course = CLASS_BY_ID.get(classId);
    const maxPage = Math.max(0, Math.ceil(categories.length / 23) - 1);
    const page = Math.min(maxPage, Math.max(0, Number.isInteger(requestedPage) ? requestedPage : 0));
    const total = categories.reduce((sum, item) => sum + item.count, 0);
    const components = [];
    if (categories.length) {
        components.push(row(new StringSelectMenuBuilder().setCustomId(`study:category:${ownerId}:${classId}`)
            .setPlaceholder('Choose a category...').addOptions(
                { label: `Random ${course.label}`.slice(0, 100), value: 'random', emoji: '🎲', description: `${total} questions available` },
                ...categories.slice(page * 23, (page + 1) * 23).map(category => ({ label: category.label.slice(0, 100), value: category.token, emoji: course.emoji, description: `${category.count} questions available` })),
            )));
    }
    components.push(row(
        button(`study:classes:${ownerId}`, '📚 Classes', ButtonStyle.Secondary),
        ...(page ? [button(`study:classpage:${ownerId}:${classId}:${page - 1}`, '⬅️ Previous categories', ButtonStyle.Secondary)] : []),
        ...(page < maxPage ? [button(`study:classpage:${ownerId}:${classId}:${page + 1}`, '➡️ More categories', ButtonStyle.Secondary)] : []),
    ));
    return { content: '', embeds: [new EmbedBuilder().setTitle(`${course.emoji} ${course.label}`)
        .setDescription(categories.length ? `Choose a category or mixed practice. Page ${page + 1} of ${maxPage + 1}.` : 'No saved questions are available for this class yet. Choose another class to study.')], components };
}

const LENGTHS = [
    [1, '1️⃣', 'Quick practice question'], [5, '5️⃣', 'Short practice session'],
    [20, '📝', 'Full study session'], [50, '🔥', 'Challenge yourself'],
    [150, '💪', 'Advanced practice session'], [600, '🏆', 'Complete question bank challenge'],
];
export function countMessage(ownerId, title, available, customId) {
    const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('Choose number of questions...')
        .addOptions(LENGTHS.filter(([count]) => count <= available).map(([count, emoji, description]) => ({
            label: `${count} ${count === 1 ? 'Question' : 'Questions'}`, value: String(count), emoji, description,
        })));
    return { content: '', embeds: [new EmbedBuilder().setTitle(`📚 ${title}`).setDescription(`${available} questions available. How many would you like to do?`)],
        components: [row(menu), row(button(`study:classes:${ownerId}`, '📚 Classes', ButtonStyle.Secondary))] };
}

export function topicMessage(ownerId, banks) {
    const menu = new StringSelectMenuBuilder().setCustomId(`study:topic:${ownerId}`)
        .setPlaceholder('Choose a study topic').addOptions(
            { label: 'Random A&P', value: 'random', emoji: '🎲', description: 'Mix topics for a varied study session' },
            ...STUDY_TOPICS.map(topic => ({ label: topic.label, value: topic.id, emoji: topic.emoji,
                description: banks.get(topic.id)?.length ? topic.description : 'Question bank being prepared' })),
        );
    return { content: '', embeds: [new EmbedBuilder().setTitle('🫀 Anatomy and Physiology Lecture')
        .setDescription('Choose a topic, then the number of questions. Practice includes multiple choice, fill in the blank, and ordering.')], components: [row(menu), row(button(`study:classes:${ownerId}`, '📚 Classes', ButtonStyle.Secondary))] };
}

export function questionMessage(session) {
    const q = session.questions[session.index];
    let description = q.labModelId && !q.requiresModelImage ? `**Model: ${q.modelName}**\n\n${q.question}` : q.question;
    const components = [];
    if (q.type === 'fill_blank') {
        description += q.labModelId ? '\n\nSelect **Enter answer** to type your answer.' : '\n\nSelect **Enter answer** to type the missing term.';
        components.push(row(button(actionId(session, 'blank'), 'Enter answer')));
    } else {
        description += '\n\n' + session.displayOrder.map((value, i) => `**${String.fromCharCode(65 + i)}.** ${q.options[value]}`).join('\n');
        if (q.type === 'multiple_choice') {
            const buttons = session.displayOrder.map((value, i) => button(`${actionId(session, 'choice')}:${value}`, String.fromCharCode(65 + i)));
            for (let i = 0; i < buttons.length; i += 5) components.push(row(...buttons.slice(i, i + 5)));
        } else {
            description += '\n\nChoose items **one at a time** in the requested order. You can undo a choice before submitting.';
            if (session.order.length) description += '\n\n**Your order:** ' + session.order.map(value => String.fromCharCode(65 + session.displayOrder.indexOf(value))).join(' → ');
            const remaining = session.displayOrder.filter(value => !session.order.includes(value));
            if (remaining.length) components.push(row(new StringSelectMenuBuilder().setCustomId(actionId(session, 'order'))
                .setPlaceholder(`Choose item ${session.order.length + 1}`).addOptions(remaining.map(value => ({
                    label: `${String.fromCharCode(65 + session.displayOrder.indexOf(value))}. ${q.options[value]}`.slice(0, 100), value: String(value),
                })))));
            if (session.order.length) components.push(row(
                button(actionId(session, 'undo'), 'Undo last choice', ButtonStyle.Secondary),
                ...(remaining.length ? [] : [button(actionId(session, 'ordered'), 'Submit order')]),
            ));
        }
    }
    const label = session.topicLabel || TOPIC_BY_ID.get(session.topicId)?.label || 'Random A&P';
    return addLectureImage({ content: '', embeds: [new EmbedBuilder().setTitle(`Question ${session.index + 1} of ${session.questions.length}`)
        .setDescription(description).setFooter({ text: `${label} • ${TYPE_LABELS[q.type]} • ${q.difficulty}` })], components }, q);
}

export function resultMessage(session, correct) {
    const q = session.questions[session.index];
    const finished = session.index + 1 === session.questions.length;
    const reward = session.reward;
    let description;
    if (reward?.status === 'saved') {
        description = `${COIN_EMOJI} ${correct ? `You earned **+${reward.amount} Merit Coins**!` : 'No Merit Coins earned for this answer.'}\n${BALANCE_EMOJI} New Balance: **${reward.balance.toLocaleString()} Merit Coins**`;
    } else {
        description = correct ? 'Your answer is correct. The coin award could not be confirmed. Select **Retry coins** to check and save it.' : 'No Merit Coins earned for this answer. Your wallet balance is currently unavailable.';
        if (!session.guildId) description = 'Merit Coins are available when studying in a server.';
    }
    if (reward?.status === 'saved' && reward.cacheDrop) description += `\n\n${cacheFoundNotice()}`;
    const embed = new EmbedBuilder().setTitle(correct ? 'Correct! ✅' : 'Incorrect ❌').setDescription(description)
        .setColor(correct ? 0x22aa55 : 0xdd5555)
        .addFields(
            { name: 'Correct Answer', value: answerText(q).slice(0, 1024) },
            { name: 'Explanation', value: q.explanation.slice(0, 1024) },
            { name: 'Quiz Progress', value: `Question **${session.index + 1} / ${session.questions.length}**\nCorrect: **${session.score}**\nIncorrect: **${session.index + 1 - session.score}**\n${COIN_EMOJI} Merit Coins Earned So Far: **${session.moneyEarned} Merit Coins**` },
        );
    const unpaid = correct && reward?.status !== 'saved' && Boolean(session.guildId);
    if (finished && !unpaid) embed.addFields({ name: '🏆 Test Complete', value: `Score: **${session.score}/${session.questions.length} (${Math.round(session.score / session.questions.length * 100)}%)**\n${COIN_EMOJI} Total Merit Coins Earned: **${session.moneyEarned} Merit Coins**\nUse /test to study again.` });
    const components = unpaid ? [row(button(actionId(session, 'reward'), '🪙 Retry coins'))]
        : finished ? [row(button(`study:classes:${session.userId}`, '📚 Choose another class', ButtonStyle.Secondary))]
        : [row(button(actionId(session, 'next'), '➡️ Next Question'))];
    return addLectureImage({ content: '', embeds: [embed], components }, q);
}

async function editStudyReply(interaction, payload) {
    return interaction.editReply({ attachments: [], files: [], ...payload });
}

// Setup and feedback stay ephemeral; only question cards are published.
async function publishQuestion(interaction, session) {
    await editStudyReply(interaction, { content: 'Your question is posted below. Only you can answer it.', embeds: [], components: [] });
    const message = await interaction.followUp({ ...questionMessage(session), flags: 0, allowedMentions: { parse: [] } });
    session.publicQuestionId = message.id;
}

async function showResult(interaction, session, correct) {
    if (!session.publicQuestionId) return editStudyReply(interaction, resultMessage(session, correct));
    // Keep the question and image visible without publishing the student's answer or score.
    await interaction.webhook.editMessage(session.publicQuestionId, { components: [] });
    await interaction.followUp({ ...resultMessage(session, correct), flags: MessageFlags.Ephemeral });
}

async function privateError(interaction, message) {
    const payload = { content: message, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
}

export async function handleStudyInteraction(interaction, client, args) {
    try {
        const [action, ownerId, token, index, revision, choice] = args;
        if (interaction.user.id !== ownerId) return await privateError(interaction, 'This study test belongs to another student. Use /test to start your own.');
        if (action === 'classes') {
            await interaction.deferUpdate();
            await editStudyReply(interaction, classMessage(ownerId));
            return;
        }
        if (action === 'class' || action === 'classpage') {
            const classId = action === 'class' ? interaction.values[0] : token;
            if (!CLASS_BY_ID.has(classId)) throw new Error('Unknown study class');
            await interaction.deferUpdate();
            if (classId === 'ap_lab' && action === 'class') {
                await editStudyReply(interaction, labCategoryMessage(ownerId));
            } else if (classId === 'ap_lecture') {
                await editStudyReply(interaction, topicMessage(ownerId, await loadQuestionBanks()));
            } else {
                const categories = await loadClassCategories(client, classId);
                await editStudyReply(interaction, classCategoriesMessage(ownerId, classId, categories, action === 'classpage' ? Number(index) : 0));
            }
            return;
        }
        if (action === 'labhome') {
            await interaction.deferUpdate();
            await editStudyReply(interaction, labCategoryMessage(ownerId));
            return;
        }
        if (action === 'labcategory') {
            const payload = labModelsMessage(ownerId, interaction.values?.[0] || token);
            await interaction.deferUpdate();
            await editStudyReply(interaction, payload);
            return;
        }
        if (action === 'labmodels') {
            const payload = labModeMessage(ownerId, (interaction.values || []).join(','));
            await interaction.deferUpdate();
            await editStudyReply(interaction, payload);
            return;
        }
        if (action === 'labmode') {
            const mode = interaction.values?.[0];
            const questions = labQuestions(token, mode);
            if (questions.some(question => !imageForQuestion(question))) return await privateError(interaction, 'This model set needs its image files before it can start. Please try again after the photos are installed.');
            const set = labSetForSelection(token);
            const category = set.category === 'respiratory' ? 'Respiratory Tract' : 'Reproductive System';
            const session = createStudySession(interaction.guildId, ownerId, questions, `lab_${set.category}`);
            session.classId = 'ap_lab';
            session.topicLabel = `Anatomy Lab • ${category} • ${set.title} • ${mode === 'typed' ? 'Type in' : 'Multiple choice'}`;
            await interaction.deferUpdate();
            await publishQuestion(interaction, session);
            return;
        }
        if (action === 'category') {
            await interaction.deferUpdate();
            const categories = await loadClassCategories(client, token);
            const selected = interaction.values[0];
            const category = categories.find(item => item.token === selected);
            if (selected !== 'random' && !category) throw new Error('Unknown class category');
            const available = category ? category.count : categories.reduce((sum, item) => sum + item.count, 0);
            if (!available) throw new Error('This class has no questions in that category yet.');
            const course = CLASS_BY_ID.get(token);
            await editStudyReply(interaction, countMessage(ownerId, `${course.label} • ${category?.label || 'Random'}`, available, `study:coursecount:${ownerId}:${token}:${selected}`));
            return;
        }
        if (action === 'coursecount') {
            await interaction.deferUpdate();
            const questions = await loadClassQuestions(client, token, index, Number(interaction.values[0]));
            const categories = await loadClassCategories(client, token);
            const course = CLASS_BY_ID.get(token);
            const session = createStudySession(interaction.guildId, ownerId, questions, `class_${token}`);
            session.classId = token;
            session.topicLabel = `${course.label} • ${categories.find(item => item.token === index)?.label || 'Random'}`;
            await publishQuestion(interaction, session);
            return;
        }
        if (action === 'topic') {
            const topicId = interaction.values[0];
            if (topicId !== 'random' && !TOPIC_BY_ID.has(topicId)) throw new Error('Unknown study topic');
            await interaction.deferUpdate();
            const banks = await loadQuestionBanks();
            const available = topicId === 'random' ? [...banks.values()].flat().length : banks.get(topicId).length;
            if (!available) throw new Error('This topic is still being prepared. Please choose another topic.');
            await editStudyReply(interaction, countMessage(ownerId, TOPIC_BY_ID.get(topicId)?.label || 'Random A&P', available, `study:count:${ownerId}:${topicId}`));
            return;
        }
        if (action === 'count') {
            await interaction.deferUpdate();
            const banks = await loadQuestionBanks();
            const questions = selectQuestions(banks, token, Number(interaction.values[0]));
            const session = createStudySession(interaction.guildId, ownerId, questions, token);
            session.classId = 'ap_lecture';
            await publishQuestion(interaction, session);
            return;
        }
        const session = getStudySession(interaction.guildId, ownerId, token);
        checkStudyAction(session, index, revision);
        const q = session.questions[session.index];
        if (action === 'image') {
            if (!imageForQuestion(q)) throw new Error('This question has no lecture figure.');
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await editStudyReply(interaction, lecturePreview(q));
            return;
        }
        if (action !== 'next' && action !== 'reward' && session.answered) throw new Error('This question has already been answered.');
        if (action === 'blank') {
            if (q.type !== 'fill_blank') throw new Error('This question does not accept a typed answer');
            const modal = new ModalBuilder().setCustomId(actionId(session, 'typed')).setTitle('Fill in the blank')
                .addComponents(row(new TextInputBuilder().setCustomId('answer').setLabel('Your answer')
                    .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(300)));
            await interaction.showModal(modal);
            return;
        }
        // Mutate synchronously before the first await: repeated deliveries cannot score or advance twice.
        let payload;
        if (action === 'reward') {
            if (!session.answered || !session.lastCorrect || session.reward?.status !== 'failed') throw new Error('This reward is already saved or being processed.');
            const pending = settleStudyReward(session, client);
            await interaction.deferUpdate();
            await pending;
            await showResult(interaction, session, true);
            return;
        } else if (action === 'next') {
            nextStudyQuestion(session);
            await interaction.deferUpdate();
            await publishQuestion(interaction, session);
            return;
        } else if (action === 'order' && q.type === 'ordering') {
            chooseOrderItem(session, Number(interaction.values[0]));
            payload = questionMessage(session);
        } else if (action === 'undo' && q.type === 'ordering') {
            undoOrderItem(session);
            payload = questionMessage(session);
        } else {
            let answer;
            if (action === 'choice' && q.type === 'multiple_choice' && session.displayOrder.includes(Number(choice))) answer = [Number(choice)];
            else if (action === 'typed' && q.type === 'fill_blank') answer = interaction.fields.getTextInputValue('answer');
            else if (action === 'ordered' && q.type === 'ordering' && session.order.length === q.options.length) answer = [...session.order];
            else throw new Error('Invalid answer action');
            const correct = submitStudyAnswer(session, answer);
            const pending = settleStudyReward(session, client);
            await interaction.deferUpdate();
            await pending;
            await showResult(interaction, session, correct);
            return;
        }
        await interaction.deferUpdate();
        if (session.publicQuestionId) await interaction.webhook.editMessage(session.publicQuestionId, { attachments: [], files: [], ...payload });
        else await editStudyReply(interaction, payload);
    } catch (error) {
        // Log the detailed failure; malformed banks should never be presented as student answers.
        const { logger } = await import('../../utils/logger.js');
        logger.warn('Study interaction failed', { message: error.message });
        await privateError(interaction, error.message.startsWith('This ') || error.message.startsWith('Answer ') || error.message.startsWith('Unknown ')
            ? error.message : 'Unable to load this study question. Use /test to try again.');
    }
}
