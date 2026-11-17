import { creditTestQuestion } from '../studyTime/tracking.js';
import { getQuestionPreferences, setQuestionEnabled, enabledQuestions } from './questionPreferences.js';
import { preferencesButton, questionToggleButton, preferenceList } from './questionPreferenceUi.js';
import { createQuestionSelection, getQuestionSelection, configureButton, selectionMessage } from './questionSelection.js';
import { questionReportModal, submitQuestionReport } from './reports.js';
import { displayedQuestionPrompt } from './prompts.js';
import { announceCrateDrop } from '../discovery/announcements.js';
import { cacheFoundNotice } from '../discovery/catalog.js';
import { LAB_CATEGORIES, labCategoryMessage, labModelsMessage, labModeMessage, labQuestions, labSetForSelection } from './labModels.js';
import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
    ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { imageForQuestion, addLectureImage, lecturePreview } from './images.js';
import { STUDY_TOPICS, TOPIC_BY_ID } from './topics.js';
import { STUDY_CLASSES, CLASS_BY_ID, loadClassCategories, loadClassQuestions, loadClassQuestionPool } from './catalog.js';
import { settleStudyReward, COIN_EMOJI, BALANCE_EMOJI } from './rewards.js';
import { answerText, loadQuestionBanks, selectQuestions } from './questions.js';
import {
    createStudySession, getStudySession, checkStudyAction, chooseOrderItem,
    undoOrderItem, submitStudyAnswer, nextStudyQuestion, skipStudyQuestion,
} from './sessions.js';

// Standalone authored-bank previews can run without a bot database; deployed clients
// always have a database wrapper and must load their persisted preferences.
const preferencesFor = (client, guildId, userId) => client?.db ? getQuestionPreferences(client, guildId, userId) : Promise.resolve({});
const enabledBanks = (banks, disabled) => new Map([...banks].map(([id, questions]) => [id, enabledQuestions(questions, disabled)]));

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
        .setDescription('Choose your class, then a category and session length. Correct answers earn **5–30 Merit Coins**, with higher amounts more likely.')], components: [row(menu), row(preferencesButton(ownerId))] };
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
    if (!available) return { content: '', embeds: [new EmbedBuilder().setTitle(`📚 ${title}`).setDescription('No enabled questions are available here. Turn questions back on or choose another topic.')], components: [row(configureButton(ownerId, customId), preferencesButton(ownerId)), row(button(`study:classes:${ownerId}`, '📚 Classes', ButtonStyle.Secondary))] };
    const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('Choose number of questions...')
        .addOptions(LENGTHS.filter(([count]) => count <= available).map(([count, emoji, description]) => ({
            label: `${count} ${count === 1 ? 'Question' : 'Questions'}`, value: String(count), emoji, description,
        })));
    return { content: '', embeds: [new EmbedBuilder().setTitle(`📚 ${title}`).setDescription(`${available} questions available. How many would you like to do?`)],
        components: [row(menu), row(button(`study:classes:${ownerId}`, '📚 Classes', ButtonStyle.Secondary), configureButton(ownerId, customId))] };
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
    const prompt = displayedQuestionPrompt(q);
    let description = q.labModelId && !q.requiresModelImage ? `**Model: ${q.modelName}**\n\n${prompt}` : prompt;
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
    components.push(row(
        button(actionId(session, 'skip'), 'Skip', ButtonStyle.Secondary),
        button(actionId(session, 'report'), 'Report', ButtonStyle.Secondary),
        questionToggleButton(session),
    ));
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
            { name: 'Quiz Progress', value: `Question **${session.index + 1} / ${session.questions.length}**\nCorrect: **${session.score}**\nIncorrect: **${session.index + 1 - session.score - (session.skipped || 0)}**\nSkipped: **${session.skipped || 0}**\n${COIN_EMOJI} Merit Coins Earned So Far: **${session.moneyEarned} Merit Coins**` },
        );
    const unpaid = correct && reward?.status !== 'saved' && Boolean(session.guildId);
    const attempted = session.questions.length - (session.skipped || 0);
    if (finished && !unpaid) embed.addFields({ name: '🏆 Test Complete', value: `Score: **${session.score}/${attempted} (${attempted ? Math.round(session.score / attempted * 100) : 0}%)**\n${COIN_EMOJI} Total Merit Coins Earned: **${session.moneyEarned} Merit Coins**\nUse /test to study again.` });
    const components = unpaid ? [row(button(actionId(session, 'reward'), '🪙 Retry coins'))]
        : finished ? [row(button(`study:classes:${session.userId}`, '📚 Choose another class', ButtonStyle.Secondary))]
        : [row(button(actionId(session, 'next'), '➡️ Next Question'))];
    components[0].addComponents(button(actionId(session, 'report'), 'Report', ButtonStyle.Secondary), questionToggleButton(session), preferencesButton(session.userId));
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
    if (!session.publicQuestionId) {
        await editStudyReply(interaction, resultMessage(session, correct));
        if (session.reward?.status === 'saved') await announceCrateDrop(interaction, session.userId, session.reward);
        return;
    }
    // Keep the question and image visible without publishing the student's answer or score.
    await interaction.webhook.editMessage(session.publicQuestionId, { components: [] });
    await interaction.followUp({ ...resultMessage(session, correct), flags: MessageFlags.Ephemeral });
    if (session.reward?.status === 'saved') await announceCrateDrop(interaction, session.userId, session.reward);
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
        if (['configurelab', 'configurelecture', 'configurecourse'].includes(action)) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            let questions, scope;
            if (action === 'configurelab') {
                const set = labSetForSelection(token);
                questions = labQuestions(token, 'multiple_choice');
                scope = { kind: 'lab', source: token, title: set.title, classId: 'ap_lab' };
            } else if (action === 'configurelecture') {
                if (token !== 'random' && !TOPIC_BY_ID.has(token)) throw new Error('Unknown study topic');
                const banks = await loadQuestionBanks();
                questions = token === 'random' ? [...banks.values()].flat() : banks.get(token);
                scope = { kind: 'lecture', source: token, title: TOPIC_BY_ID.get(token)?.label || 'Random A&P', classId: 'ap_lecture' };
            } else {
                questions = await loadClassQuestionPool(client, token, index);
                const categories = await loadClassCategories(client, token);
                scope = { kind: 'course', source: token, category: index, title: `${CLASS_BY_ID.get(token).label} • ${categories.find(c => c.token === index)?.label || 'Random'}`, classId: token };
            }
            const context = createQuestionSelection(interaction.guildId, ownerId, questions, scope);
            await editStudyReply(interaction, selectionMessage(context, await preferencesFor(client, interaction.guildId, ownerId)));
            return;
        }
        if (['configpage', 'configselect', 'configreturn'].includes(action)) {
            const context = getQuestionSelection(token, interaction.guildId, ownerId);
            await interaction.deferUpdate();
            if (action === 'configselect') {
                const selected = [...new Set(interaction.values || [])];
                if (!selected.length || selected.length > 25) throw new Error('This question selection is invalid.');
                const changes = selected.map(value => {
                    const separator = value.indexOf('|');
                    const state = value.slice(0, separator), id = value.slice(separator + 1);
                    const question = context.questions.find(q => q.id === id);
                    if (!question || !['on', 'off'].includes(state)) throw new Error('This question selection is invalid.');
                    return { question, enabled: state === 'on' };
                });
                for (const change of changes) await setQuestionEnabled(client, interaction.guildId, ownerId, { ...change.question, classId: context.scope.classId }, change.enabled);
            }
            const disabled = await preferencesFor(client, interaction.guildId, ownerId);
            if (action === 'configreturn') {
                const scope = context.scope;
                if (scope.kind === 'lab') await editStudyReply(interaction, labModeMessage(ownerId, scope.source));
                else await editStudyReply(interaction, countMessage(ownerId, scope.title, enabledQuestions(context.questions, disabled).length,
                    scope.kind === 'lecture' ? `study:count:${ownerId}:${scope.source}` : `study:coursecount:${ownerId}:${scope.source}:${scope.category}`));
            } else await editStudyReply(interaction, selectionMessage(context, disabled, Number(index) || 0, action === 'configselect' ? 'Your question choices have been saved.' : ''));
            return;
        }
        if (action === 'preferences' || action === 'preferencepage' || action === 'enablequestion') {
            if (action === 'preferences') await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            else await interaction.deferUpdate();
            if (action === 'enablequestion') {
                const selected = [...new Set(interaction.values || [])];
                if (!selected.length || selected.length > 25) throw new Error('This question selection is invalid.');
                for (const id of selected) await setQuestionEnabled(client, interaction.guildId, ownerId, { id }, true);
            }
            const disabled = await preferencesFor(client, interaction.guildId, ownerId);
            await editStudyReply(interaction, preferenceList(ownerId, disabled, Number(token) || 0,
                action === 'enablequestion' ? 'Selected questions are back on for your next quiz.' : ''));
            return;
        }
        if (action === 'prefquestion') {
            const session = getStudySession(interaction.guildId, ownerId, token);
            const position = Number(index);
            if (!session || !Number.isInteger(position) || position < 0 || position > session.index || !['on', 'off'].includes(choice)) throw new Error('This question preference control has expired. Start /test again.');
            const question = session.questions[position];
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const disabled = await setQuestionEnabled(client, interaction.guildId, ownerId, { ...question, classId: session.classId }, choice === 'on');
            session.disabledQuestions = disabled;
            await editStudyRepl…3355 tokens truncated…ormat('en-US', { month: 'long', year: 'numeric', timeZone: ZONE }).format(at);
export function rankRecords(rows, period, at) {
    return rows.map(({ userId, record }) => { const totals = totalsFor(record, period, at); return { userId, totals, ms: sumTotals(totals) }; })
        .filter(entry => entry.ms > 0).sort((a, b) => b.ms - a.ms || a.userId.localeCompare(b.userId));
}
export function studyTimeMessage(rows, owner, { period = 'month', view = 'leaderboard', member = owner, page = 0, at = Date.now() } = {}) {
    const ranked = rankRecords(rows, period, at);
    const index = ranked.findIndex(entry => entry.userId === member);
    const entry = ranked[index] || { totals: totalsFor(null, period, at), ms: 0 };
    const embed = new EmbedBuilder().setColor(0x8b5cf6).setTimestamp(at);
    const pages = Math.max(1, Math.ceil(ranked.length / 10));
    page = Math.max(0, Math.min(Number(page) || 0, pages - 1));
    if (view === 'stats') {
        const tier = tierFor(entry.ms);
        embed.setTitle(`☕ Study Statistics (${periodLabel(period, at)})`).setDescription(`<@${member}>`)
            .addFields(
                { name: 'Current study tier', value: `${tier.current.name} · ${duration(entry.ms)}`, inline: true },
                { name: 'Next tier', value: tier.next ? `${tier.next.name} · ${duration(tier.next.ms)}` : 'Highest tier reached', inline: true },
                { name: 'Study rank', value: index >= 0 ? `#${index + 1} / ${ranked.length}` : 'Not ranked yet', inline: true },
                { name: 'Tier rank', value: `${tier.rank} / ${tier.count}`, inline: true },
                { name: 'Promotion in', value: tier.next ? duration(Math.max(0, tier.next.ms - entry.ms)) : 'You reached Mythic!', inline: true },
                { name: 'Study-time breakdown', value: `🎙️ Voice: **${duration(entry.totals.voice)}**\n🪱 Microbemon: **${duration(entry.totals.microbemon)}**\n📝 Test questions: **${duration(entry.totals.test)}**\n🎬 Resources: **${duration(entry.totals.links)}**` },
            );
    } else {
        const lines = ranked.slice(page * 10, (page + 1) * 10).map((e, i) => {
            const rank = page * 10 + i + 1;
            return `${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `**${rank}.**`} **${duration(e.ms)}** · <@${e.userId}>`;
        });
        embed.setTitle(`🏆 Study Leaderboard (${periodLabel(period, at)})`)
            .setDescription(lines.join('\n') || 'No study time recorded yet. Join a voice channel, play Microbemon, or answer a /test question to get started.')
            .addFields({ name: member === owner ? 'Your standing' : 'Selected member', value: index >= 0 ? `#${index + 1} · ${duration(entry.ms)}` : 'Not ranked yet' });
    }
    embed.setFooter({ text: `Estimated study credit · Voice + 30s/game action or answered question + 20s/resource · Monthly reset: Eastern time · Page ${page + 1}/${pages}` });
    const nav = [row(button('This month', `studytime:${owner}:leaderboard:month:0`), button('All time', `studytime:${owner}:leaderboard:all:0`), button('My stats', `studytime:${owner}:stats:${period}:0`, ButtonStyle.Primary))];
    if (view === 'leaderboard' && pages > 1) nav.push(row(
        button('Previous', `studytime:${owner}:leaderboard:${period}:${page - 1}`).setDisabled(page === 0),
        button('Next', `studytime:${owner}:leaderboard:${period}:${page + 1}`).setDisabled(page + 1 >= pages),
    ));
    return { embeds: [embed], components: nav, allowedMentions: { parse: [] } };
}
export async function createStudyResourceMessage(client, guildId, title, rawUrl) {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a valid HTTPS resource link.');
    title = String(title).trim();
    if (!title || title.length > 180 || url.href.length > 500) throw new Error('Use a title up to 180 characters and a link up to 500 characters.');
    const id = randomBytes(12).toString('hex');
    await putResource(client, guildId, id, { title, url: url.href });
    return { embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('🎬 Study Resource').setDescription(`${escapeMarkdown(title)}\n\nOpen this resource to add **20 seconds** of study credit, for each Open resource action.`)],
        components: [row(button('Open resource · +20s', `studytime:resource:${id}`, ButtonStyle.Primary))], allowedMentions: { parse: [] } };
}
export async function openStudyTime(interaction) {
    await interaction.deferReply();
    try {
        if (!interaction.guildId) throw new Error('Use study time inside a server.');
        const view = interaction.options?.getString('view') || 'leaderboard';
        const period = interaction.options?.getString('period') || 'month';
        if (view === 'resource') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required to publish a tracked resource.');
            return await interaction.editReply(await createStudyResourceMessage(interaction.client, interaction.guildId,
                interaction.options.getString('title') || '', interaction.options.getString('url') || ''));
        }
        const member = interaction.options?.getUser('member')?.id || interaction.user.id;
        const rows = await recordsForGuild(interaction.client, interaction.guildId);
        await interaction.editReply(studyTimeMessage(rows, interaction.user.id, { view, period, member }));
    } catch (error) { logger.warn(`Study time command: ${error.message}`); await interaction.editReply({ content: error.message, allowedMentions: { parse: [] } }); }
}
export async function handleStudyTime(interaction, client, args) {
    try {
        if (!interaction.guildId || interaction.user.bot) throw new Error('Use study time inside a server.');
        if (args[0] === 'resource') {
            if (!interaction.id) throw new Error('Please click the resource button again.');
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const resource = await getResource(client, interaction.guildId, args[1]);
            if (!resource) throw new Error('This resource is no longer available.');
            const awarded = await creditActivity(client, interaction.guildId, interaction.user.id, 'links', `${args[1]}:${interaction.id}`);
            return await interaction.editReply({ content: `${awarded ? 'Added **20 seconds** of study credit.' : 'This click has already been recorded.'}\n**${escapeMarkdown(resource.title)}**`,
                components: [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Visit resource').setURL(resource.url))], allowedMentions: { parse: [] } });
        }
        const [owner, view, period, page] = args;
        if (owner !== interaction.user.id) return await interaction.reply({ content: 'Open your own leaderboard with /studytime.', flags: MessageFlags.Ephemeral });
        if (!['stats', 'leaderboard'].includes(view) || !['month', 'all'].includes(period)) throw new Error('Open a fresh /studytime card.');
        await interaction.deferUpdate();
        const rows = await recordsForGuild(client, interaction.guildId);
        await interaction.editReply(studyTimeMessage(rows, owner, { view, period, page }));
    } catch (error) {
        logger.warn(`Study time interaction: ${error.message}`);
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content: error.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        else await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
}
