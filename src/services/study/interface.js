import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
    ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { STUDY_TOPICS, TOPIC_BY_ID } from './topics.js';
import { answerText, loadQuestionBanks, selectQuestions } from './questions.js';
import {
    createStudySession, getStudySession, checkStudyAction, chooseOrderItem,
    undoOrderItem, submitStudyAnswer, nextStudyQuestion,
} from './sessions.js';

const TYPE_LABELS = {
    multiple_choice: 'Multiple choice', fill_blank: 'Fill in the blank',
    select_all: 'Select all that apply', ordering: 'Put in the correct order',
};
const row = (...components) => new ActionRowBuilder().addComponents(...components);
const button = (id, label, style = ButtonStyle.Primary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const actionId = (session, action) => `study:${action}:${session.userId}:${session.id}:${session.index}:${session.revision}`;

export function topicMessage(ownerId, banks) {
    const total = [...banks.values()].reduce((sum, questions) => sum + questions.length, 0);
    const menu = new StringSelectMenuBuilder().setCustomId(`study:topic:${ownerId}`)
        .setPlaceholder('Choose a study topic').addOptions(
            { label: 'Mixed topics', value: 'random', description: `${total} questions available` },
            ...STUDY_TOPICS.map(topic => ({ label: topic.label, value: topic.id,
                description: banks.get(topic.id)?.length ? `${banks.get(topic.id).length} questions available` : 'Question bank being prepared' })),
        );
    return { content: '', embeds: [new EmbedBuilder().setTitle('Anatomy & Physiology Study Test')
        .setDescription('Choose a topic, then the number of questions. Practice includes multiple choice, fill in the blank, select all that apply, and ordering.')], components: [row(menu)] };
}

export function questionMessage(session) {
    const q = session.questions[session.index];
    let description = q.question;
    const components = [];
    if (q.type === 'fill_blank') {
        description += '\n\nSelect **Enter answer** to type the missing term.';
        components.push(row(button(actionId(session, 'blank'), 'Enter answer')));
    } else {
        description += '\n\n' + session.displayOrder.map((value, i) => `**${i + 1}.** ${q.options[value]}`).join('\n');
        if (q.type === 'multiple_choice') {
            const buttons = session.displayOrder.map((value, i) => button(`${actionId(session, 'choice')}:${value}`, `Answer ${i + 1}`));
            for (let i = 0; i < buttons.length; i += 5) components.push(row(...buttons.slice(i, i + 5)));
        } else if (q.type === 'select_all') {
            description += '\n\nSelect every correct option, then submit the selection. Full credit requires all correct choices and no incorrect choices.';
            components.push(row(new StringSelectMenuBuilder().setCustomId(actionId(session, 'multi'))
                .setPlaceholder('Select all correct answers').setMinValues(1).setMaxValues(q.options.length)
                .addOptions(session.displayOrder.map((value, i) => ({ label: `${i + 1}. ${q.options[value]}`.slice(0, 100), value: String(value) })))));
        } else {
            description += '\n\nChoose items **one at a time** in the requested order. You can undo a choice before submitting.';
            if (session.order.length) description += '\n\n**Your order:** ' + session.order.map(value => String(session.displayOrder.indexOf(value) + 1)).join(' → ');
            const remaining = session.displayOrder.filter(value => !session.order.includes(value));
            if (remaining.length) components.push(row(new StringSelectMenuBuilder().setCustomId(actionId(session, 'order'))
                .setPlaceholder(`Choose item ${session.order.length + 1}`).addOptions(remaining.map(value => ({
                    label: `${session.displayOrder.indexOf(value) + 1}. ${q.options[value]}`.slice(0, 100), value: String(value),
                })))));
            if (session.order.length) components.push(row(
                button(actionId(session, 'undo'), 'Undo last choice', ButtonStyle.Secondary),
                ...(remaining.length ? [] : [button(actionId(session, 'ordered'), 'Submit order')]),
            ));
        }
    }
    const label = TOPIC_BY_ID.get(session.topicId)?.label || 'Mixed topics';
    return { content: '', embeds: [new EmbedBuilder().setTitle(`Question ${session.index + 1} of ${session.questions.length}`)
        .setDescription(description).setFooter({ text: `${label} • ${TYPE_LABELS[q.type]} • ${q.difficulty} • Score: ${session.score}` })], components };
}

function resultMessage(session, correct) {
    const q = session.questions[session.index];
    const finished = session.index + 1 === session.questions.length;
    const description = `**Correct answer:** ${answerText(q)}\n\n${q.explanation}`;
    const embed = new EmbedBuilder().setTitle(correct ? 'Correct!' : 'Incorrect').setDescription(description)
        .setColor(correct ? 0x22aa55 : 0xdd5555)
        .setFooter({ text: `Answered ${session.index + 1} of ${session.questions.length} • Score: ${session.score}` });
    if (finished) embed.addFields({ name: 'Test complete', value: `Score: **${session.score}/${session.questions.length} (${Math.round(session.score / session.questions.length * 100)}%)**\nUse /test to study again.` });
    return { content: '', embeds: [embed], components: finished ? [] : [row(button(actionId(session, 'next'), 'Next question'))] };
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
        if (action === 'topic') {
            const topicId = interaction.values[0];
            if (topicId !== 'random' && !TOPIC_BY_ID.has(topicId)) throw new Error('Unknown study topic');
            await interaction.deferUpdate();
            const banks = await loadQuestionBanks();
            const available = topicId === 'random' ? [...banks.values()].flat().length : banks.get(topicId).length;
            if (!available) throw new Error('This topic is still being prepared. Please choose another topic.');
            const choices = [5, 20, 50, 150, 600].filter(n => n <= available);
            // A small, explicitly labelled preview bank can still be tried while content is prepared.
            if (!choices.length) choices.push(5);
            const menu = new StringSelectMenuBuilder().setCustomId(`study:count:${ownerId}:${topicId}`)
                .setPlaceholder('Choose test length').addOptions(choices.map(count => ({ label: `${Math.min(count, available)} questions`, value: String(count) })));
            await interaction.editReply({ content: '', embeds: [new EmbedBuilder().setTitle(TOPIC_BY_ID.get(topicId)?.label || 'Mixed topics')
                .setDescription(`${available} questions available. Choose your test length.`)], components: [row(menu)] });
            return;
        }
        if (action === 'count') {
            await interaction.deferUpdate();
            const banks = await loadQuestionBanks();
            const questions = selectQuestions(banks, token, Number(interaction.values[0]));
            const session = createStudySession(interaction.guildId, ownerId, questions, token);
            await interaction.editReply(questionMessage(session));
            return;
        }
        const session = getStudySession(interaction.guildId, ownerId, token);
        checkStudyAction(session, index, revision);
        const q = session.questions[session.index];
        if (action !== 'next' && session.answered) throw new Error('This question has already been answered.');
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
        if (action === 'next') {
            nextStudyQuestion(session);
            payload = questionMessage(session);
        } else if (action === 'order' && q.type === 'ordering') {
            chooseOrderItem(session, Number(interaction.values[0]));
            payload = questionMessage(session);
        } else if (action === 'undo' && q.type === 'ordering') {
            undoOrderItem(session);
            payload = questionMessage(session);
        } else {
            let answer;
            if (action === 'choice' && q.type === 'multiple_choice' && session.displayOrder.includes(Number(choice))) answer = [Number(choice)];
            else if (action === 'multi' && q.type === 'select_all') answer = interaction.values.map(Number);
            else if (action === 'typed' && q.type === 'fill_blank') answer = interaction.fields.getTextInputValue('answer');
            else if (action === 'ordered' && q.type === 'ordering' && session.order.length === q.options.length) answer = [...session.order];
            else throw new Error('Invalid answer action');
            payload = resultMessage(session, submitStudyAnswer(session, answer));
        }
        await interaction.deferUpdate();
        await interaction.editReply(payload);
    } catch (error) {
        // Log the detailed failure; malformed banks should never be presented as student answers.
        const { logger } = await import('../../utils/logger.js');
        logger.warn('Study interaction failed', { message: error.message });
        await privateError(interaction, error.message.startsWith('This ') || error.message.startsWith('Answer ') || error.message.startsWith('Unknown ')
            ? error.message : 'Unable to load this study question. Use /test to try again.');
    }
}
