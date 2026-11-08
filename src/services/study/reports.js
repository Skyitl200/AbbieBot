import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { answerText } from './questions.js';
import { imageForQuestion } from './images.js';
import { logger } from '../../utils/logger.js';

export const QUESTION_REPORT_CHANNEL_ID = '1549474402062704675';
const REPORT_TTL_MS = 30 * 60_000;
const reports = new Map();
const reportKeys = new Map();

function cleanExpiredReports(now) {
    for (const [token, report] of reports) {
        if (report.expiresAt <= now && !report.sending) {
            reports.delete(token);
            if (reportKeys.get(report.key) === token) reportKeys.delete(report.key);
        }
    }
}

export function questionReportModal(session, index, interaction, now = Date.now()) {
    cleanExpiredReports(now);
    if (!Number.isInteger(index) || !session?.answeredQuestions?.has(index) || !session.questions[index]) {
        throw new Error('This question must be answered before it can be reported.');
    }
    const answered = session.answeredQuestions.get(index);
    const key = `${session.guildId}:${session.userId}:${session.rewardId}:${index}`;
    let token = reportKeys.get(key);
    let report = reports.get(token);
    if (report?.sent) throw new Error('This question has already been reported. Thank you!');
    if (!report) {
        token = randomUUID().replaceAll('-', '');
        report = { key, ownerId: session.userId, guildId: session.guildId ?? null,
            channelId: interaction.channelId, publicQuestionId: answered.publicQuestionId, displayOrder: [...answered.displayOrder],
            topic: session.topicLabel || session.topicId || 'Study quiz', course: session.classId || 'Study quiz',
            question: structuredClone(session.questions[index]), expiresAt: now + REPORT_TTL_MS, issue: '', sent: false };
        reports.set(token, report);
        reportKeys.set(key, token);
    }
    const input = new TextInputBuilder().setCustomId('issue').setLabel('Describe the problem')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(5).setMaxLength(1500)
        .setPlaceholder('Describe an incorrect answer, image marker, wording issue, or other error.');
    if (report.issue) input.setValue(report.issue);
    return new ModalBuilder().setCustomId(`study:report_submit:${session.userId}:${token}`).setTitle('Report this question')
        .addComponents(new ActionRowBuilder().addComponents(input));
}

function reportMessage(report) {
    const q = report.question;
    const fields = [
        { name: 'Reporter', value: `<@${report.ownerId}> (${report.ownerId})`.slice(0, 100) },
        { name: 'Quiz / model', value: `${report.course} · ${report.topic}${q.modelName ? ` · ${q.modelName}` : ''}`.slice(0, 300) },
        { name: 'Question ID', value: String(q.id || q.labModelId || 'Unknown').slice(0, 100) },
        { name: 'Question', value: String(q.question).slice(0, 1000) },
    ];
    if (q.options?.length) {
        const order = report.displayOrder.length === q.options.length ? report.displayOrder : q.options.map((_, i) => i);
        fields.push({ name: 'Answer choices (as shown)', value: order.map((option, i) => `${String.fromCharCode(65+i)}. ${q.options[option]}`).join('\n').slice(0, 800) });
    }
    fields.push({ name: 'Expected answer', value: answerText(q).slice(0, 500) || 'Unavailable' });
    if (q.explanation) fields.push({ name: 'Explanation', value: q.explanation.slice(0, 500) });
    fields.push({ name: 'Source', value: `Server: ${report.guildId || 'DM'} · Channel: ${report.channelId || 'Unknown'}`.slice(0, 150) });
    if ([report.guildId, report.channelId, report.publicQuestionId].every(id => /^\d{16,22}$/.test(id || ''))) {
        fields.push({ name: 'Original question', value: `https://discord.com/channels/${report.guildId}/${report.channelId}/${report.publicQuestionId}` });
    }
    const embed = new EmbedBuilder({ title: 'Question error report', color: 0xf59e0b,
        description: report.issue, fields, timestamp: new Date().toISOString() });
    const figure = imageForQuestion(q);
    const files = [];
    if (figure) {
        const filename = `reported-question.${figure.asset.file.split('.').at(-1)}`;
        files.push({ attachment: figure.path, name: filename });
        embed.setImage(`attachment://${filename}`);
    }
    return { embeds: [embed], files, allowedMentions: { parse: [] } };
}

export async function submitQuestionReport(interaction, client, token, now = Date.now()) {
    cleanExpiredReports(now);
    const report = reports.get(token);
    if (!report || report.expiresAt <= now) throw new Error('This report form has expired. Use Report on the question again.');
    if (report.ownerId !== interaction.user.id || report.guildId !== (interaction.guildId ?? null)) {
        throw new Error('This report belongs to another student.');
    }
    const issue = interaction.fields.getTextInputValue('issue').trim();
    if (issue.length < 5 || issue.length > 1500) throw new Error('This report needs a description of 5–1500 characters.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!report.sent && !report.sending) {
        report.issue = issue;
        report.sending = Promise.resolve().then(async () => {
            const channel = await client.channels.fetch(QUESTION_REPORT_CHANNEL_ID);
            if (!channel?.isTextBased() || typeof channel.send !== 'function') throw new Error('Moderator report channel is unavailable');
            await channel.send({ ...reportMessage(report), nonce: token.slice(0, 24), enforceNonce: true });
            report.sent = true;
        });
    }
    const sending = report.sending;
    try {
        if (sending) await sending;
    } catch (error) {
        logger.warn('Question report delivery failed', { message: error.message });
    } finally {
        if (report.sending === sending) delete report.sending;
    }
    const content = report.sent ? 'Thank you! Your question report was sent to the moderators.'
        : 'Your report could not be sent. Use Report again to retry; your description is saved in the form.';
    await interaction.editReply({ content });
}
