import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { key, get, put, list, locked, remove, sourcesFor } from './store.js';
import { writableChannel, checkGuild } from './service.js';
import { pageOf } from './locations.js';
import { logger } from '../../utils/logger.js';
export const SETTINGS_STEPS = new Set(['settings','settings-channel','settings-review','settings-sources','settings-source','settings-remove','settings-remove-confirm','settings-requests']);
export function requireSettingsPermission(i) {
    if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required for moderator settings.');
}
export function settingsView(s,{embed,controls,select,row,button,clean}) {
    let page;
    if (s.step === 'settings') {
        embed.setTitle('⚙️ Programs · Moderator settings');
        if(s.notice) embed.addFields({name:'Status',value:clean(s.notice)});
        controls.push(select(s,'Choose a setting',[
            {label:'Set update and review channels',value:'channels'},
            {label:'Find and approve an official source',value:'add-source'},
            {label:'View monitored sources and check status',value:'sources'},
            {label:'Review coverage requests',value:'requests'},
            {label:'Check sources now',value:'check'},
            {label:'Remove a monitored source',value:'remove'},
        ]));
    } else if (s.step === 'settings-channel' || s.step === 'settings-review') {
        const review=s.step === 'settings-review';
        embed.setTitle(review ? 'Select moderator review channel' : 'Select public updates channel');
        page=pageOf((s.channels || []).filter(c=>!review || c.type === ChannelType.GuildText),s.page);
        if(page.items.length) controls.push(select(s,review ? 'Choose review channel' : 'Choose updates channel',page.items.map(c=>({label:('#'+c.name).slice(0,100),value:c.id}))));
        else embed.addFields({name:'No channels available',value:'Create a text channel and give StudyBot access, then reopen Settings.'});
    } else if (s.step === 'settings-sources' || s.step === 'settings-remove') {
        embed.setTitle(s.step === 'settings-remove' ? 'Remove a monitored source' : 'Monitored sources');
        page=pageOf(s.adminSources || [],s.page);
        if(page.items.length) controls.push(select(s,'Choose a source',page.items.map(source=>({label:source.school.slice(0,100),value:source.id,description:`${source.country} · ${source.region || 'All regions'} · ${source.topic}`.slice(0,100)}))));
        else embed.addFields({name:'Sources',value:'No sources are monitored yet. Choose Find and approve an official source in Settings.'});
    } else if (s.step === 'settings-source' || s.step === 'settings-remove-confirm') {
        const source=s.adminSource;
        embed.setTitle(source.school.slice(0,250)).setDescription(`${clean(source.country)} · ${clean(source.region || 'All regions')} · ${clean(source.county || 'All counties')}\n${clean(source.topic)}\n${source.url}`);
        if(s.step === 'settings-remove-confirm') controls.push(row(button(s,'Remove this source','settings-remove')));
        else embed.addFields({name:'Last check',value:s.sourceState?.checkedAt ? new Date(s.sourceState.checkedAt).toISOString() : 'Not checked yet'},
            {name:'Status',value:s.sourceState?.lastError ? clean(s.sourceState.lastError) : s.sourceState?.pending ? 'Awaiting moderator review in the configured review channel' : 'Monitoring'});
    } else if (s.step === 'settings-requests') {
        embed.setTitle('Programme coverage requests');
        page=pageOf(s.adminRequests || [],s.page,3);
        if(page.items.length) embed.setDescription(page.items.map(request=>`${clean(request.program)} · ${clean(request.country)} · ${clean(request.region || 'All regions')}\n${clean(request.school || 'All schools',200)}`).join('\n\n'));
        else embed.addFields({name:'Requests',value:'No coverage requests yet.'});
    }
    return page;
}
export async function settingsChoice(i,s,value,db) {
    requireSettingsPermission(i);
    if(s.step === 'settings') {
        s.page=0;s.notice='';
        if(value === 'channels') {
            const channels=await i.guild.channels.fetch();
            s.channels=[...channels.values()].filter(channel=>channel && [ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type)).map(channel=>({id:channel.id,name:channel.name,type:channel.type})).sort((a,b)=>a.name.localeCompare(b.name));
            s.step='settings-channel';
        } else if(value === 'add-source') {s.mode='source';s.step='program';s.filter={};}
        else if(value === 'sources' || value === 'remove') {s.adminSources=await sourcesFor(db,i.guildId);s.step=value === 'sources' ? 'settings-sources' : 'settings-remove';}
        else if(value === 'requests') {s.adminRequests=(await list(db,key(i.guildId,'request')+':')).map(row=>row.value);s.step='settings-requests';}
        else if(value === 'check') {
            if(!await get(db,key(i.guildId,'config'))) throw new Error('Choose Set update and review channels first.');
            const result=await locked(i.client,key(i.guildId,'manual-check'),async connection=>{
                const last=await get(connection,key(i.guildId,'last-manual-check'));
                if(last?.at > Date.now()-600000) throw new Error('Manual source checks can run once every 10 minutes.');
                await put(connection,key(i.guildId,'last-manual-check'),{at:Date.now()});
                return {started:true};
            },db);
            if(result.busy) throw new Error('A source check is already starting.');
            void checkGuild(i.client,i.guildId).catch(error=>logger.warn(`Programs manual check: ${error.message}`));
            s.notice='Source check started. Changed content will go to the review channel. Use View monitored sources to check status.';
        } else throw new Error('Choose a listed setting.');
    } else if(s.step === 'settings-channel' || s.step === 'settings-review') {
        if(!s.channels.some(channel=>channel.id === value)) throw new Error('Choose a listed channel.');
        await writableChannel(i.client,value,i.guildId);
        if(s.step === 'settings-channel') {s.updateChannel=value;s.step='settings-review';s.page=0;}
        else {
            if(s.channels.find(channel=>channel.id === value).type !== ChannelType.GuildText) throw new Error('Choose a server text channel for review.');
            await writableChannel(i.client,s.updateChannel,i.guildId);
            await put(db,key(i.guildId,'config'),{channel:s.updateChannel,reviewChannel:value});
            s.step='settings';s.notice='Channels saved. Approved sources are checked every 12 hours; changes go to moderator review before publication.';
        }
    } else if(s.step === 'settings-sources' || s.step === 'settings-remove') {
        const source=s.adminSources.find(source=>source.id === value);
        if(!source) throw new Error('Choose a listed source.');
        s.adminSource=source;
        const state=await get(db,key(i.guildId,'state',source.id));
        s.sourceState=state ? {checkedAt:state.checkedAt,lastError:state.lastError,pending:Boolean(state.pending)} : null;
        s.step=s.step === 'settings-remove' ? 'settings-remove-confirm' : 'settings-source';
    } else throw new Error('Use the current Settings menu.');
}
export async function removeSettingsSource(i,s,db) {
    requireSettingsPermission(i);
    if(s.step !== 'settings-remove-confirm' || !s.adminSource) throw new Error('Select a source before removing it.');
    const result=await locked(i.client,key(i.guildId,'check',s.adminSource.id),async connection=>{
        await remove(connection,key(i.guildId,'source',s.adminSource.id));await remove(connection,key(i.guildId,'state',s.adminSource.id));
        return {removed:true};
    },db);
    if(result.busy) throw new Error('This source is currently being checked. Try again shortly.');
    s.step='settings';s.notice='Source monitoring removed.';
}
