import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';

const selections = new Map();
const TTL = 2 * 60 * 60_000;
const PAGE_SIZE = 10;
export function createQuestionSelection(guildId, userId, questions, scope, now = Date.now()) {
  for (const [id, context] of selections) if (context.expiresAt <= now) selections.delete(id);
  const context = { id: randomUUID().slice(0,8), guildId, userId, questions, scope, expiresAt: now+TTL };
  selections.set(context.id, context);
  return context;
}
export function getQuestionSelection(id, guildId, userId, now = Date.now()) {
  const context = selections.get(id);
  if (!context || context.expiresAt <= now || context.guildId !== guildId || context.userId !== userId) throw new Error('This question selection has expired. Reopen Choose questions from your set.');
  return context;
}
export function configureButton(ownerId, countId) {
  const id=countId.replace('study:coursecount:', 'study:configurecourse:').replace('study:count:', 'study:configurelecture:');
  return new ButtonBuilder().setCustomId(id || `study:classes:${ownerId}`).setLabel('Choose questions').setStyle(ButtonStyle.Secondary);
}
export function selectionMessage(context, disabled, requestedPage = 0, notice = '') {
  const maxPage=Math.max(0,Math.ceil(context.questions.length/PAGE_SIZE)-1);
  const page=Math.max(0,Math.min(maxPage,Number.isInteger(requestedPage)?requestedPage:0));
  const shown=context.questions.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const active=context.questions.filter(q=>!Object.hasOwn(disabled,q.id)).length;
  const components=[];
  if(shown.length) components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(`study:configselect:${context.userId}:${context.id}:${page}`)
    .setPlaceholder('Select questions to switch ON or OFF').setMinValues(1).setMaxValues(shown.length)
    .addOptions(shown.map(q=>{
      const off=Object.hasOwn(disabled,q.id);
      return {label:`${off?'OFF':'ON'} · ${q.modelName || q.question}`.replace(/\s+/g,' ').slice(0,100),
        value:`${off?'on':'off'}|${q.id}`,emoji:off?'⬜':'✅',description:`Switch this question ${off?'on':'off'}`};
    }))));
  const buttons=[];
  if(page) buttons.push(new ButtonBuilder().setCustomId(`study:configpage:${context.userId}:${context.id}:${page-1}`).setLabel('Previous').setStyle(ButtonStyle.Secondary));
  if(page<maxPage) buttons.push(new ButtonBuilder().setCustomId(`study:configpage:${context.userId}:${context.id}:${page+1}`).setLabel('Next').setStyle(ButtonStyle.Secondary));
  buttons.push(new ButtonBuilder().setCustomId(`study:configreturn:${context.userId}:${context.id}`).setLabel('Back to set').setStyle(ButtonStyle.Primary));
  components.push(new ActionRowBuilder().addComponents(buttons));
  const embed=new EmbedBuilder().setTitle('Choose your questions')
    .setDescription(`**${context.scope.title}**\n**${active} ON / ${context.questions.length} total** · Page ${page+1} of ${maxPage+1}\nSelect questions below to change their saved state. These settings apply only to you in this server, across future visits and both answer modes.`);
  if(shown.length)embed.addFields(shown.map((q,i)=>({name:`${page*PAGE_SIZE+i+1}. ${Object.hasOwn(disabled,q.id)?'OFF':'ON'} — ${q.modelName || 'Question'}`.slice(0,90),value:q.question.slice(0,450)})));
  return {content:notice,embeds:[embed],components,allowedMentions:{parse:[]}};
}
