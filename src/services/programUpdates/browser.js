import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits, escapeMarkdown } from 'discord.js';
import { COUNTRIES, regionsFor, pageOf } from './locations.js';
import { PROGRAMS, TOPICS, APPLICANTS, program, preferences, matches, countryName, DIRECTORIES } from './catalog.js';
import { get, put, list, remove, withDb, locked, key, sourcesFor } from './store.js';
import { id, checkSource, writableChannel } from './service.js';
import { discoverSchools, fetchPage, extractText, safeUrl } from './fetch.js';
import { findPrograms } from './interface.js';
import { logger } from '../../utils/logger.js';
import { schoolInformation } from './information.js';
import { SETTINGS_STEPS, requireSettingsPermission, settingsView, settingsChoice, removeSettingsSource } from './settings.js';
import { DIRECTORY_INFO, countiesForUS } from './directory.js';
const clean = (value, length = 1000) => escapeMarkdown(String(value || '')).slice(0,length);
const isAdmin = i => i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
function requireAdmin(i) { if (!isAdmin(i)) throw new Error('Manage Server permission is required to approve official sources.'); }
const sessionKey = (guild, owner, token) => key(guild, 'browser', `${owner}:${token}`);
const tokenFor = (s, action) => `programbrowse:${s.owner}:${s.id}:${s.revision}:${action}`;
const row = component => new ActionRowBuilder().addComponents(component);
const button = (s, label, action, style = ButtonStyle.Secondary) => new ButtonBuilder().setLabel(label).setCustomId(tokenFor(s,action)).setStyle(style);
function select(s, placeholder, options, max = 1) {
    return row(new StringSelectMenuBuilder().setCustomId(tokenFor(s,'choose')).setPlaceholder(placeholder.slice(0,150))
        .setMinValues(max).setMaxValues(max).addOptions(options));
}
export const SCHOOL_GROUPS = [ ['abc','A–C'], ['def','D–F'], ['ghi','G–I'], ['jkl','J–L'], ['mno','M–O'], ['pqr','P–R'], ['stu','S–U'], ['vwxyz','V–Z'], ['other','Other names'] ];
export function groupedSchools(s) {
    if (!s.schoolGroup || s.schoolGroup === 'all') return s.schools || [];
    return (s.schools || []).filter(school => {
        const first=school.school.normalize('NFKD').replace(/\p{M}/gu,'').trim().toLowerCase()[0] || '';
        return s.schoolGroup === 'other' ? !/^[a-z]$/.test(first) : s.schoolGroup.includes(first);
    });
}
const summary = s => [program(s.filter.program)?.name, s.filter.country ? countryName(s.filter.country) : '', s.filter.region, s.filter.county,
    s.filter.topic, s.filter.applicant].filter(Boolean).join(' · ');
const filterFor = s => preferences({ ...s.filter, school: s.selected?.[0]?.school || '' });
export function renderBrowser(s, manager = false) {
    const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle('🌍 Programs').setDescription(clean(summary(s) || 'Choose what you would like to do. No typed country codes, regions, or URLs needed.'));
    const controls = [], options = [];
    let page;
    if (s.step === 'information') {
        controls.push(new ActionRowBuilder().addComponents(button(s,'Previous page','info-prev').setDisabled(s.infoIndex === 0),button(s,'Next page','info-next').setDisabled(s.infoIndex + 1 >= s.infoPages.length)));
        controls.push(row(button(s,'Subscribe to these updates','save',ButtonStyle.Primary)));
    }
    else if (SETTINGS_STEPS.has(s.step)) page=settingsView(s,{embed,controls,select,row,button,clean});
    else if (s.step === 'help') embed.setTitle('How Programs works').setDescription('Find schools, compare school information, subscribe to updates, or request coverage using dropdowns. US listings include states, counties, and reported programme data. International listings identify institutions; programme availability and current requirements still need verification. Moderators configure channels and monitoring through Settings. No search key or typed URL is needed.');
    else if (s.step === 'mode') {
        options.push({ label: 'Find program information', value: 'find' }, { label: 'Subscribe to updates', value: 'subscribe' },
            { label: 'Compare two school sources', value: 'compare' }, { label: 'Manage my subscriptions', value: 'manage' },
            { label: 'Request coverage for a location', value: 'request' }, {label:'How it works',value:'help'});
        if (manager) options.push({label:'Moderator settings',value:'settings'});
        controls.push(select(s,'Choose an action',options));
    } else if (s.step === 'program') controls.push(select(s,'Choose your programme',PROGRAMS.map(p => ({ label:p.name,value:p.id,emoji:{id:p.emoji} }))));
    else if (s.step === 'country') {
        page = pageOf(COUNTRIES,s.page);
        const common = new Set(['US','CA','GB','AU','IN','ZA']);
        // Keep a stable order: popular locations first, then the complete catalogue.
        const ordered = [...COUNTRIES.filter(c => common.has(c.countryShortCode)),...COUNTRIES.filter(c => !common.has(c.countryShortCode))];
        page = pageOf(ordered,s.page);
        controls.push(select(s,'Choose a country',page.items.map(c => ({ label:c.countryName.slice(0,100),value:c.countryShortCode }))));
    } else if (s.step === 'region') {
        const regions = regionsFor(s.filter.country);
        page = pageOf(regions,s.page);
        controls.push(select(s,'Choose a state / province / region',[{ label:'Entire country / all regions',value:'all' },
            ...page.items.map(region => ({ label:region.name.slice(0,100),value:String(regions.indexOf(region)) }))]));
    } else if (s.step === 'county') {
        const counties = countiesForUS(s.filter.region,s.filter.program);
        page = pageOf(counties,s.page);
        controls.push(select(s,'Choose a county',[{label:'All counties in this state',value:'all'},...page.items.map(county=>({label:county.slice(0,100),value:String(counties.indexOf(county))}))]));
    } else if (s.step === 'topic') controls.push(select(s,'Choose an update topic',[
        ...(s.mode === 'source' ? [] : [{ label:'All topics',value:'all' }]), ...TOPICS.map(value => ({ label:value,value })),
    ]));
    else if (s.step === 'applicant') controls.push(select(s,'Choose applicant type',APPLICANTS.map(value => ({ label:value === 'all' ? 'All applicant types' : value,value }))));
    else if (s.step === 'school-group') {
        const groups=[{label:'All schools',value:'all'},...SCHOOL_GROUPS.filter(([group]) => groupedSchools({...s,schoolGroup:group}).length).map(([group,label])=>({label,value:group}))];
        controls.push(select(s,'Choose a school-name group',groups));
    } else if (s.step === 'schools') {
        page = pageOf(groupedSchools(s),s.page,s.mode === 'compare' ? 25 : 24);
        if (s.mode === 'request') {
            // Coverage requests use the selected location; no URL or school text is required.
        } else if (s.mode === 'compare' && page.items.length) {
            // Two independent selections allow comparisons across school-list pages.
            controls.push(select(s,s.compareFirst ? 'Choose the second school / source' : 'Choose the first school / source',page.items.map(candidate => ({label:candidate.school.slice(0,100),value:candidate.id,description:candidate.tracked ? 'Tracked official source' : candidate.provider === 'directory' ? (candidate.regionVerified ? (candidate.programReportedYear ? `Programme reported in ${candidate.programReportedYear} · confirm current entry` : 'Directory-listed · programme not verified') : 'Directory-listed · region/programme not verified') : 'Discovered page · verify official status'}))));
        } else if (s.mode !== 'compare') {
            const all = s.mode === 'source' ? [] : [{label:'All tracked schools in this location',value:'all'}];
            options.push(...all,...page.items.map(candidate => ({label:candidate.school.slice(0,100),value:candidate.id,description:candidate.tracked ? 'Tracked official source' : candidate.provider === 'directory' ? (candidate.regionVerified ? (candidate.programReportedYear ? `Programme reported in ${candidate.programReportedYear} · confirm current entry` : 'Directory-listed · programme not verified') : 'Directory-listed · region/programme not verified') : 'Discovered page · not yet verified'})));
            if (options.length) controls.push(select(s,'Choose a school or source',options));
        }
        if (s.compareFirst) embed.addFields({name:'First school / source',value:clean(s.compareFirst.school,300)});
        embed.addFields({name:'Source coverage',value:`Tracked entries are approved sources. Free directory: ${DIRECTORY_INFO.institutions.toLocaleString('en-US')} institutions across ${DIRECTORY_INFO.countries} countries. US schools use federal state/county records and ${DIRECTORY_INFO.usYear} reported programme data. International entries do not confirm programme offerings; missing region data is labelled.`});
        if (s.searchError) embed.addFields({name:'School directory',value:clean(s.searchError,800)});
        if (!s.schools?.length) {
            embed.addFields({name:'No school sources found',value:'No matching schools are listed in the bundled free directory or tracked sources. No API key is needed. Request coverage or use the school-search and official directory links below.'});
            if (s.mode === 'source' || s.mode === 'compare') controls.push(row(button(s,'Request coverage','request',ButtonStyle.Primary)));
        }
        if (!s.schools?.length) {
            const search = new URL('https://www.google.com/search');
            search.searchParams.set('q', `${program(s.filter.program).name} schools admissions prerequisites ${countryName(s.filter.country)} ${s.filter.region || ''}`);
            controls.push(row(new ButtonBuilder().setLabel('Search school websites').setURL(search.href).setStyle(ButtonStyle.Link)));
        }
        const directories = (DIRECTORIES[s.filter.program] || []).filter(([code]) => code === s.filter.country);
        if (directories.length) controls.push(new ActionRowBuilder().addComponents(...directories.slice(0,3).map(([,label,url]) => new ButtonBuilder().setLabel(label.slice(0,80)).setURL(url).setStyle(ButtonStyle.Link))));
    } else if (s.step === 'confirm') {
        const candidate = s.selected?.[0];
        if (s.mode === 'source' && candidate) {
            embed.addFields({ name:'Discovered source',value:`${clean(candidate.school,200)}\n${candidate.url}` },
                {name:'Verify before approving',value:'Confirm this is the official school or regulator page and that it applies to this programme, location and applicant type. The bot found the link; no URL entry is required.'});
            controls.push(row(button(s,'Approve official source','approve',ButtonStyle.Success)));
        } else {
            embed.addFields({name:'Schools',value:clean(s.selected?.map(item=>item.school).join(' · ') || 'All tracked schools in this location',500)});
            if(s.selected?.length) controls.push(row(button(s,'View requested information','view-info',ButtonStyle.Primary)));
            controls.push(row(button(s,'Save subscription','save',ButtonStyle.Secondary)));
        }
    } else if (s.step === 'manage') {
        page = pageOf(s.subscriptions || [],s.page);
        if (page.items.length) controls.push(select(s,'Select a subscription to remove',page.items.map(sub => ({ label:`${program(sub.program).name} · ${sub.country}${sub.region ? ' · '+sub.region : ''}`.slice(0,100),value:sub.id,description:(sub.school || 'All tracked schools').slice(0,100) }))));
        else embed.addFields({name:'Subscriptions',value:'You have no saved subscriptions.'});
    } else if (s.step === 'done') embed.addFields({name:'Saved',value:s.notice || 'Done.'});
    if (page) {
        embed.setFooter({text:`Page ${page.current + 1}/${page.pages}${SETTINGS_STEPS.has(s.step) ? '' : ' · Location coverage does not imply all schools are monitored'}`});
        if (page.pages > 1) controls.push(new ActionRowBuilder().addComponents(button(s,'Previous page','prev').setDisabled(page.current === 0),button(s,'Next page','next').setDisabled(page.current + 1 === page.pages)));
    }
    const nav = new ActionRowBuilder().addComponents(button(s,'Start over','restart'));
    if (s.step !== 'mode' && s.step !== 'done') nav.addComponents(button(s,'Back','back'));
    if (s.step === 'schools' && s.schools?.length > 100) nav.addComponents(button(s,'School name groups','group'));
    if (s.step === 'schools' && !['source','compare'].includes(s.mode)) nav.addComponents(button(s,'Request coverage','request'));
    controls.push(nav);
    return {embeds:s.step === 'information' ? [new EmbedBuilder(s.infoPages[s.infoIndex])] : [embed],components:controls,allowedMentions:{parse:[]}};
}
export async function openProgramBrowser(interaction, mode = null) {
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    try {
        if (!interaction.guildId) throw new Error('Use programme updates inside a server.');
        if (mode === 'source') requireAdmin(interaction);
        const s = {id:id(),owner:interaction.user.id,revision:0,mode,step:mode ? 'program' : 'mode',page:0,filter:{},expiresAt:Date.now()+3600000};
        await withDb(interaction.client,db => put(db,sessionKey(interaction.guildId,s.owner,s.id),s));
        await interaction.editReply(renderBrowser(s,isAdmin(interaction)));
    } catch(error) { await interaction.editReply({content:error.message,allowedMentions:{parse:[]}}); }
}
export async function schoolChoices(client,guildId,s,{discover = discoverSchools, db = null} = {}) {
    const sources = db ? await sourcesFor(db,guildId) : await withDb(client,connection => sourcesFor(connection,guildId));
    const filter = preferences(s.filter);
    const tracked = sources.filter(source => matches(source,filter)).map(source => ({id:source.id,school:source.school,url:source.url,tracked:true}));
    let found = [];
    s.searchError = '';
    { // Always combine directory schools with monitored schools, without an API key.
        try { found = await discover({...filter,program:program(filter.program).name,countryCode:filter.country}); }
        catch(error) { s.searchError = error.message; }
    }
    s.schools = [...tracked,...found.map((candidate,index) => ({id:`web${index}`,school:candidate.title.slice(0,120),url:safeUrl(candidate.url).href,tracked:false,provider:candidate.provider,regionVerified:candidate.regionVerified,programReportedYear:candidate.programReportedYear,county:candidate.county,directorySource:candidate.directorySource,admissionsUrl:candidate.admissionsUrl,applicationUrl:candidate.applicationUrl}))]
        .filter((candidate,index,all) => all.findIndex(item => s.mode === 'source' ? item.url === candidate.url : item.school.toLowerCase() === candidate.school.toLowerCase()) === index);
    s.step = s.schools.length > 100 ? 'school-group' : 'schools'; s.schoolGroup='all'; s.page = 0;
}
async function saveSubscription(client,guildId,s,existingDb) {
    return locked(client,key(guildId,'subscriptions',s.owner),async db => {
        if (!await get(db,key(guildId,'config'))) throw new Error('A moderator needs to configure update channels with /programs → Moderator settings → Set update and review channels first.');
        const filters = s.mode === 'compare' ? s.selected.map(candidate => preferences({...s.filter,school:candidate.school})) : [filterFor(s)];
        const rows = await list(db,key(guildId,'subscription',s.owner)+':');
        const pending = filters.filter(filter => !rows.some(row => JSON.stringify(preferences(row.value)) === JSON.stringify(filter)));
        if (!pending.length) return 'You already have these subscription preferences.';
        if (rows.length + pending.length > 20) throw new Error('You can save up to 20 subscriptions. Remove an old one first.');
        for (const filter of pending) {
            const subId = id();
            await put(db,key(guildId,'subscription',`${s.owner}:${subId}`),{...filter,userId:s.owner,id:subId});
        }
        return 'Subscription saved. Matching, reviewed updates will appear in the configured channel.';
    },existingDb);
}
async function approveSource(interaction,s,existingDb) {
    requireAdmin(interaction);
    const candidate = s.selected?.[0];
    if (!candidate?.url) throw new Error('Choose a discovered source first.');
    const filter = filterFor(s);
    if (!filter.topic) throw new Error('Choose the source topic first.');
    const url = safeUrl(candidate.url).href;
    extractText(await fetchPage(url));
    const source = {...filter,id:id(),url,selector:'',approvedBy:s.owner,approvedAt:Date.now()};
    const result = await locked(interaction.client,key(interaction.guildId,'source-admin'),async db => {
        if (!await get(db,key(interaction.guildId,'config'))) throw new Error('Configure channels with /programs → Moderator settings → Set update and review channels first.');
        const old = await sourcesFor(db,interaction.guildId);
        if (old.some(item => item.url === url && item.program === source.program && item.topic === source.topic)) throw new Error('This source is already tracked.');
        if (old.length >= 50) throw new Error('This server supports up to 50 tracked sources.');
        await put(db,key(interaction.guildId,'source',source.id),source);
        return {saved:true};
    },existingDb);
    if (result.busy) throw new Error('Another source update is in progress. Try again shortly.');
    await checkSource(interaction.client,interaction.guildId,source,{db:existingDb});
    return 'Official source approved and baseline saved. Future changes will go to moderator review.';
}
async function coverageRequest(interaction,s,existingDb) {
    const filter = filterFor(s), requestId = id();
    const result = await locked(interaction.client,key(interaction.guildId,'requests',s.owner),async db => {
        const old = await get(db,key(interaction.guildId,'request-user',s.owner));
        if (old?.at > Date.now()-3600000) throw new Error('You can request coverage once per hour.');
        await put(db,key(interaction.guildId,'request',requestId),{...filter,userId:s.owner,at:Date.now()});
        await put(db,key(interaction.guildId,'request-user',s.owner),{at:Date.now()});
        return {saved:true};
    },existingDb);
    if (result.busy) throw new Error('Another request is in progress. Try again shortly.');
    const config = await get(existingDb,key(interaction.guildId,'config'));
    if (config) {
        try { const channel = await writableChannel(interaction.client,config.reviewChannel,interaction.guildId); await channel.send({content:`**Programme coverage requested**\n${clean(summary(s))}\n${clean(filter.school || 'All schools')}\nRequest ${requestId}`,allowedMentions:{parse:[]}}); }
        catch(error) { logger.warn(`Coverage notification: ${error.message}`); }
    }
    return 'Coverage request saved. A moderator can find and approve official source links through the programme menu.';
}
export async function handleProgramBrowser(interaction,client,args,{information=schoolInformation}={}) {
    const [owner,sessionId,revision,action] = args;
    if (owner !== interaction.user.id || !interaction.guildId) return interaction.reply({content:'Open your own menu with /programs.',flags:MessageFlags.Ephemeral});
    await interaction.deferUpdate();
    try {
        const result = await locked(client,sessionKey(interaction.guildId,owner,sessionId),async db => {
            const s = await get(db,sessionKey(interaction.guildId,owner,sessionId));
            if (!s || s.expiresAt < Date.now()) throw new Error('This menu expired. Open /programs again.');
            if (String(s.revision) !== revision) throw new Error('This menu changed. Use its latest buttons.');
            if (s.mode === 'source') requireAdmin(interaction);
            if (s.mode === 'settings' || SETTINGS_STEPS.has(s.step)) requireSettingsPermission(interaction);
            let response;
            if (action === 'restart') { s.step='mode';s.mode=null;s.filter={};s.selected=[];s.compareFirst=null;s.page=0; }
            else if (action === 'back' && s.step === 'information') s.step='confirm';
            else if (action === 'back' && SETTINGS_STEPS.has(s.step)) {s.step=s.step === 'settings' ? 'mode' : 'settings';s.mode=s.step === 'mode' ? null : 'settings';s.page=0;}
            else if (action === 'back') {
                const order=['mode','program','country','region','county','topic','applicant','school-group','schools','confirm'];
                s.step=order[Math.max(0,order.indexOf(s.step)-1)];
                if(s.step === 'county' && (s.filter.country !== 'US' || !s.filter.region)) s.step='region';
                s.page=0;s.compareFirst=null;s.selected=[];
            } else if (action === 'prev' || action === 'next') { s.page=Math.max(0,s.page+(action === 'prev' ? -1 : 1)); }
            else if (action === 'settings-remove') await removeSettingsSource(interaction,s,db);
            else if (action === 'view-info' && s.step === 'confirm' && s.selected?.length) {
                s.infoPages=[];
                await interaction.editReply({content:'Reading the school website for your requested information…',embeds:[],components:[]});
                for(const selected of s.selected) s.infoPages.push(...await information(selected,preferences(s.filter)));
                s.infoIndex=0;s.step='information';
            }
            else if ((action === 'info-prev' || action === 'info-next') && s.step === 'information') s.infoIndex=Math.max(0,Math.min(s.infoPages.length-1,s.infoIndex+(action === 'info-next' ? 1 : -1)));
            else if (action === 'save' && ['confirm','information'].includes(s.step) && s.mode !== 'source') {
                const saved=await saveSubscription(client,interaction.guildId,s,db);
                if (saved?.busy) throw new Error('A subscription update is in progress. Try again.');
                s.step='done';s.notice=saved;
            } else if (action === 'approve' && s.step === 'confirm' && s.mode === 'source') { s.notice=await approveSource(interaction,s,db);s.step='done'; }
            else if (action === 'request' && s.step === 'schools') { s.notice=await coverageRequest(interaction,s,db);s.step='done'; }
            else if (action === 'choose') {
                const value=interaction.values?.[0];
                if (SETTINGS_STEPS.has(s.step)) await settingsChoice(interaction,s,value,db);
                else if (s.step === 'mode') {
                    if (!['find','subscribe','compare','request','source','manage','settings','help'].includes(value)) throw new Error('Choose a listed action.');
                    if (value === 'source') requireAdmin(interaction);
                    if (value === 'settings') requireSettingsPermission(interaction);
                    s.mode=value;s.filter={};s.page=0;s.selected=[];s.compareFirst=null;
                    if(value === 'settings') s.step='settings';
                    else if(value === 'help') s.step='help';
                    else if (value === 'manage') {
                        s.subscriptions=(await list(db,key(interaction.guildId,'subscription',owner)+':')).map(row=>row.value);s.step='manage';
                    } else s.step='program';
                } else if (s.step === 'program') {
                    if (!program(value)) throw new Error('Choose a listed programme.');
                    s.filter={program:value};s.step='country';s.page=0;
                } else if (s.step === 'country') {
                    if (!COUNTRIES.some(c=>c.countryShortCode === value)) throw new Error('Choose a listed country.');
                    s.filter={program:s.filter.program,country:value};s.step='region';s.page=0;
                } else if (s.step === 'region') {
                    const region=value === 'all' ? '' : regionsFor(s.filter.country)[Number(value)]?.name;
                    if (region === undefined) throw new Error('Choose a listed region.');
                    s.filter.region=region;s.filter.county='';s.step=s.filter.country === 'US' && region ? 'county' : 'topic';s.page=0;
                } else if (s.step === 'county') {
                    const counties=countiesForUS(s.filter.region,s.filter.program);
                    const county=value === 'all' ? '' : counties[Number(value)];
                    if(county === undefined) throw new Error('Choose a listed county.');
                    s.filter.county=county;s.step='topic';s.page=0;
                } else if (s.step === 'topic') {
                    if ((!TOPICS.includes(value) && value !== 'all') || (s.mode === 'source' && value === 'all')) throw new Error('Choose a listed topic.');
                    s.filter.topic=value === 'all' ? '' : value;s.step='applicant';
                } else if (s.step === 'applicant') {
                    if (!APPLICANTS.includes(value)) throw new Error('Choose a listed applicant type.');
                    s.filter.applicant=value;
                    if (s.mode === 'request') { s.step='schools';s.schools=[]; }
                    else await schoolChoices(client,interaction.guildId,s,{db});
                } else if (s.step === 'school-group') {
                    if (value !== 'all' && !SCHOOL_GROUPS.some(([group])=>group === value)) throw new Error('Choose a listed school-name group.');
                    s.schoolGroup=value;s.step='schools';s.page=0;
                } else if (s.step === 'schools') {
                    const candidate=value === 'all' && !['source','compare'].includes(s.mode) ? null : s.schools.find(item=>item.id === value);
                    if (!candidate && value !== 'all') throw new Error('Choose a listed school or source.');
                    if (value === 'all' && ['source','compare'].includes(s.mode)) throw new Error('Choose a specific source.');
                    if (s.mode === 'compare' && !s.compareFirst) { s.compareFirst=candidate; }
                    else {
                        if (s.mode === 'compare' && s.compareFirst.id === candidate.id) throw new Error('Choose a different second source.');
                        s.selected=s.mode === 'compare' ? [s.compareFirst,candidate] : candidate ? [candidate] : [];
                        s.step='confirm';
                        if ((s.mode === 'find' || s.mode === 'compare') && s.selected.length) {
                            s.infoPages=[];
                            await interaction.editReply({content:'Reading the school website for your requested information…',embeds:[],components:[]});
                            for(const selected of s.selected) s.infoPages.push(...await information(selected,preferences(s.filter)));
                            s.infoIndex=0;s.step='information';
                        } else if(s.mode === 'find' && !s.selected.length) response=await findPrograms(client,interaction.guildId,preferences(s.filter),{db});
                    }
                } else if (s.step === 'manage') {
                    if (!s.subscriptions.some(sub=>sub.id === value)) throw new Error('Choose one of your subscriptions.');
                    await remove(db,key(interaction.guildId,'subscription',`${owner}:${value}`));
                    s.subscriptions=s.subscriptions.filter(sub=>sub.id !== value);
                } else throw new Error('Open the latest menu to continue.');
            } else throw new Error('This action is not available in the current menu.');
            s.revision++;s.expiresAt=Date.now()+3600000;
            await put(db,sessionKey(interaction.guildId,owner,sessionId),s);
            const view=renderBrowser(s,isAdmin(interaction));
            if (response) { response.components=view.components;return response; }
            return view;
        });
        if (result?.busy) throw new Error('Your menu is already updating. Try again shortly.');
        await interaction.editReply({...result,content:''});
    } catch(error) { logger.warn(`Programme browser: ${error.message}`);await interaction.followUp({content:error.message,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}}); }
}
