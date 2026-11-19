import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { key, get, put, withDb } from './store.js';
import { id } from './service.js';
export function publicInformationMessage(snapshot, page=0) {
    const index=Math.max(0,Math.min(snapshot.pages.length-1,Number(page)||0));
    const components=[];
    if(snapshot.pages.length>1) components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Previous page').setStyle(ButtonStyle.Secondary).setCustomId(`programinfo:${snapshot.owner}:${snapshot.id}:${index-1}`).setDisabled(index===0),
        new ButtonBuilder().setLabel('Next page').setStyle(ButtonStyle.Secondary).setCustomId(`programinfo:${snapshot.owner}:${snapshot.id}:${index+1}`).setDisabled(index+1===snapshot.pages.length),
    ));
    return {embeds:[new EmbedBuilder(snapshot.pages[index])],components,allowedMentions:{parse:[]}};
}
export async function publishInformation(interaction,pages) {
    const snapshot={id:id(),owner:interaction.user.id,guildId:interaction.guildId,channelId:interaction.channelId,pages,expiresAt:Date.now()+86400000};
    const name=key(interaction.guildId,'public-info',snapshot.id);
    await withDb(interaction.client,db=>put(db,name,snapshot));
    // The navigation reply is ephemeral, but this new follow-up explicitly has
    // no Ephemeral flag, making the requested information visible in chat.
    const sent=await interaction.followUp({...publicInformationMessage(snapshot),flags:0});
    snapshot.messageId=sent?.id;
    await withDb(interaction.client,db=>put(db,name,snapshot));
    return sent;
}
export async function handlePublicInformation(interaction,client,args) {
    const [owner,token,page]=args;
    if(interaction.user.id!==owner || !interaction.guildId) return interaction.reply({content:'Everyone can read this information. Only the requester controls its pages; open /programs for your own result.',flags:MessageFlags.Ephemeral});
    await interaction.deferUpdate();
    try {
        const snapshot=await withDb(client,db=>get(db,key(interaction.guildId,'public-info',token)));
        if(!snapshot || snapshot.owner!==owner || snapshot.expiresAt<Date.now()) throw new Error('These page controls expired. Open /programs to refresh the information.');
        if(snapshot.channelId && snapshot.channelId!==interaction.channelId) throw new Error('Use the controls on the original result.');
        if(snapshot.messageId && snapshot.messageId!==interaction.message?.id) throw new Error('Use the controls on the original result.');
        await interaction.editReply(publicInformationMessage(snapshot,page));
    } catch(error) {await interaction.followUp({content:error.message,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});}
}
