import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';

export function preferencesButton(ownerId) {
  return new ButtonBuilder().setCustomId(`study:preferences:${ownerId}:0`)
    .setLabel('Turned-off questions').setStyle(ButtonStyle.Secondary);
}

export function questionToggleButton(session, index = session.index) {
  const q = session.questions[index];
  const off = Object.hasOwn(session.disabledQuestions || {}, q.id);
  return new ButtonBuilder().setCustomId(`study:prefquestion:${session.userId}:${session.id}:${index}:${session.revision}:${off ? 'on' : 'off'}`)
    .setLabel(off ? 'Turn question back on' : 'Toggle this question off').setStyle(ButtonStyle.Secondary);
}

export function preferenceList(ownerId, disabled, requestedPage = 0, notice = '') {
  const entries = Object.values(disabled).sort((a,b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const maxPage = Math.max(0, Math.ceil(entries.length / 25) - 1);
  const page = Math.max(0, Math.min(maxPage, Number.isInteger(requestedPage) ? requestedPage : 0));
  const shown = entries.slice(page*25,(page+1)*25);
  const components = [];
  if (shown.length) components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(`study:enablequestion:${ownerId}:${page}`).setPlaceholder('Select a question to turn back on')
    .setMinValues(1).setMaxValues(shown.length).addOptions(shown.map(q => ({
      label: q.title.replace(/\s+/g,' ').slice(0,100) || q.id, value: q.id,
      description: 'Turn this question back on'
    })))));
  const navigation = [];
  if (page) navigation.push(new ButtonBuilder().setCustomId(`study:preferences:${ownerId}:${page-1}`).setLabel('Previous').setStyle(ButtonStyle.Secondary));
  if (page<maxPage) navigation.push(new ButtonBuilder().setCustomId(`study:preferences:${ownerId}:${page+1}`).setLabel('Next').setStyle(ButtonStyle.Secondary));
  navigation.push(new ButtonBuilder().setCustomId(`study:classes:${ownerId}`).setLabel('Choose a class').setStyle(ButtonStyle.Secondary));
  components.push(new ActionRowBuilder().addComponents(navigation));
  return { content: notice, embeds: [new EmbedBuilder().setTitle('Your turned-off questions')
    .setDescription(entries.length ? `${entries.length} question(s) turned off for you in this server. Select any below to turn them back on.\nPage ${page+1} of ${maxPage+1}.` : 'All questions are on. Use **Toggle this question off** on a question to exclude it from your future sessions.')], components, allowedMentions: { parse: [] } };
}
