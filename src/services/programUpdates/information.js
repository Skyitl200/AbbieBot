import { load } from 'cheerio';
import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import { fetchPage, safeUrl } from './fetch.js';
import { program } from './catalog.js';
const PATTERNS = {
    nursing:/\b(nursing|registered nurse|lpn.{0,8}rn)\b/i,
    'dental-hygiene':/\bdental hygi(?:ene|enist)\b/i,
    'dental-assisting':/\bdental assist(?:ing|ant)\b/i,
    radiography:/\b(radiograph\w*|radiologic\w*|x.ray)\b/i,
    sonography:/\b(sonograph\w*|ultrasound)\b/i,
    respiratory:/\brespiratory (?:care|therap\w*)\b/i,
    pta:/\bphysical therap(?:ist|y) assist\w*\b/i,
    pa:/\bphysician assist\w*\b/i,
    medicine:/\b(medicine|medical doctor|osteopathic)\b/i,
};
const TOPICS = {
    deadlines:/deadline|application (?:period|window|date)|applications? (?:open|close)|apply by|closing date|intake date/i,
    prerequisites:/prerequis|pre.requis|eligib|minimum.{0,15}gpa|required courses?|admissions? (?:selection )?criteria|application criteria|admission requirements|HESI|TEAS|entrance exam/i,
    admissions:/admission|apply|application|eligib|entry requirements|selection criteria/i,
    tuition:/tuition|fees?|cost|credit hour/i,
    scholarships:/scholarship|financial aid|funding|bursar/i,
    accreditation:/accredit|approval|approved by/i,
    licensing:/licen[cs]|registration|NCLEX|certification exam/i,
};
const normalize = text => String(text || '').replace(/\s+/g,' ').trim();
const host = url => new URL(url).hostname.replace(/^www\./,'').toLowerCase();
export function sameSchool(url, root) {
    try { const name=host(safeUrl(url));const base=host(safeUrl(root));return name === base || name.endsWith('.'+base); }
    catch { return false; }
}
const badAudience = (text, applicant) => applicant === 'domestic' && /\binternational (?:students|applicants|admissions)\b/i.test(text);
export function relevantBlocks(page, filter) {
    const pattern=PATTERNS[filter.program], topic=TOPICS[filter.topic] || /admission|prerequis|application|tuition|deadline|licen|accredit|scholarship|HESI|TEAS|GPA/i;
    if(!pattern) return [];
    const $=load(page.body);
    $('script,style,noscript,nav,header,footer,form,svg').remove();
    const root=$('main,article,[role="main"]').first().length ? $('main,article,[role="main"]').first() : $('body');
    const scopes=[];
    root.find('h1,h2,h3,h4,h5,h6').each((_i,heading)=>{
        const label=normalize($(heading).text());
        if(!pattern.test(label) || label.length > 250) return;
        // On shared health-science pages, isolate the matching accordion/card,
        // never treat another programme's dates as Nursing information.
        const container=$(heading).closest('.accordion-item,.card,details,[role="tabpanel"]');
        if(container.length && !scopes.some(scope=>scope.element === container[0])) scopes.push({element:container[0],label});
        else if(!container.length) {
            const wrapper=$('<section></section>').append($(heading).clone());
            const level=Number(heading.tagName.slice(1));
            let next=$(heading).next();
            while(next.length) {
                const tag=next[0].tagName;
                if(/^h[1-6]$/.test(tag) && Number(tag.slice(1))<=level)break;
                wrapper.append(next.clone());next=next.next();
            }
            if(wrapper.text().length>label.length+20) scopes.push({element:wrapper[0],label});
        }
    });
    const pageSpecific=pattern.test(decodeURIComponent(new URL(page.url).pathname).replace(/[-_]/g,' ')) || pattern.test(normalize($('title').text())) || pattern.test(normalize(root.find('h1').first().text()));
    if(!scopes.length && pageSpecific) scopes.push({element:root[0],label:normalize(root.find('h1').first().text()) || program(filter.program).name});
    // Generic school admissions can be shown as general information, but no
    // programme-specific deadline/prerequisite is inferred from that page.
    if(!scopes.length && ['admissions','tuition','scholarships'].includes(filter.topic) && !badAudience(page.url+' '+$('title').text(),filter.applicant)) scopes.push({element:root[0],label:'General school information — not programme-specific',general:true});
    const blocks=[];
    for(const scope of scopes) {
        const selected=$(scope.element);
        let heading=scope.label;let topicContext=topic.test(heading);
        selected.find('h1,h2,h3,h4,h5,h6,p,li,tr,dd').each((_i,element)=>{
            const node=$(element);
            if(/^h[1-6]$/.test(element.tagName)) {heading=normalize(node.text());topicContext=topic.test(heading);return;}
            if(node.parents('li,tr').length) return;
            const text=normalize(node.text());
            if(text.length < 20 || text.length > 16000 || badAudience(scope.label+' '+heading+' '+text,filter.applicant)) return;
            const directMatch=topic.test(heading+' '+text);
            const continuation=filter.topic === 'deadlines' && topicContext && /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|20[0-9]{2})\b/i.test(text);
            if(!directMatch && !continuation)return;
            if(directMatch)topicContext=true;
            if(scope.general && Object.entries(PATTERNS).some(([id,regex])=>id !== filter.program && regex.test(text))) return;
            const value=`${scope.label}${heading !== scope.label ? ' · '+heading : ''}\n${text}`;
            if(!blocks.some(block=>block.text === value)) blocks.push({text:value,general:Boolean(scope.general)});
        });
    }
    return blocks.slice(0,80);
}
export function schoolLinks(page, rootUrl, filter) {
    const $=load(page.body), links=[];
    $('a[href]').each((_i,element)=>{
        const node=$(element);let url;
        try {url=safeUrl(new URL(node.attr('href'),page.url).href).href;} catch{return;}
        if(!sameSchool(url,rootUrl) || /\.(pdf|docx?|xlsx?|zip|png|jpe?g)(?:\?|$)/i.test(url) || /\b(news|events|stories|research)\b/i.test(new URL(url).hostname+' '+new URL(url).pathname)) return;
        const text=normalize(node.text())+' '+decodeURIComponent(new URL(url).pathname).replace(/[-_]/g,' ');
        const programme=PATTERNS[filter.program]?.test(text);
        const other=Object.entries(PATTERNS).some(([id,regex])=>id !== filter.program && regex.test(text));
        if(other && !programme) return;
        if(badAudience(text,filter.applicant)) return;
        let score=(programme ? 15 : 0)+(/admission|application|apply|criteria/i.test(text) ? 5 : 0)+(/health science|health profession/i.test(text) ? 5 : 0)+(TOPICS[filter.topic]?.test(text) ? 5 : 0);
        if(/criteria|requirements|application periods/i.test(text)) score+=4;
        if(!score || url === page.url) return;
        if(!links.some(link=>link.url === url)) links.push({url,score});
    });
    return links.sort((a,b)=>b.score-a.score).slice(0,60);
}
function chunks(text, max=2800) {
    const out=[];let remaining=text;
    while(remaining.length>max) {let split=remaining.lastIndexOf(' ',max);if(split<max/2)split=max;out.push(remaining.slice(0,split));remaining=remaining.slice(split).trim();}
    if(remaining)out.push(remaining);return out;
}
export function formatInformationText(text) {
    let previousHeading='';
    return text.split('\n\n').map(paragraph=>{
        const newline=paragraph.indexOf('\n');
        if(newline<0)return escapeMarkdown(paragraph);
        const heading=paragraph.slice(0,newline);
        const body=escapeMarkdown(paragraph.slice(newline+1).replace(/:(?=[A-Za-z])/g,': '));
        const label=heading === previousHeading ? '' : `**${escapeMarkdown(heading)}**\n`;
        previousHeading=heading;
        return label+body;
    }).join('\n\n');
}
export async function schoolInformation(candidate, filter, { pageFetcher=fetchPage, maxPages=7, at=Date.now() }={}) {
    const root=safeUrl(candidate.url).href;
    const queue=[{url:root,score:100,depth:0}],seen=new Set(),evidence=[],errors=[];
    for(const url of [candidate.admissionsUrl,candidate.applicationUrl]) if(url && sameSchool(url,root)) queue.push({url:safeUrl(url).href,score:10,depth:1});
    while(queue.length && seen.size<maxPages) {
        queue.sort((a,b)=>b.score-a.score);const current=queue.shift();
        if(seen.has(current.url))continue;seen.add(current.url);
        try {
            const result=await pageFetcher(current.url);const page={...result,url:result.url || current.url};
            if(!sameSchool(page.url,root)) {errors.push('A page redirected outside the listed school domain.');continue;}
            if(!/html|plain/i.test(page.type))continue;
            const blocks=relevantBlocks(page,filter);
            if(blocks.length)evidence.push({url:page.url,blocks});
            if(current.depth<3) for(const link of schoolLinks(page,root,filter)) if(!seen.has(link.url)) queue.push({...link,depth:current.depth+1});
        } catch(error) {errors.push(error.message);}
    }
    const pages=[];
    for(const entry of evidence) {
        // Deduplicate across overlapping institutional pages, retaining citations.
        const unique=entry.blocks.filter(block=>!pages.some(page=>page.rawTexts?.includes(block.text)));
        for(const block of unique) for(const text of chunks(block.text)) {
            let last=pages.at(-1);
            if(!last || last.url !== entry.url || last.text.length+text.length+2>2800) {last={url:entry.url,text:'',rawTexts:[],general:block.general};pages.push(last);}
            last.text+=(last.text ? '\n\n' : '')+text;last.rawTexts.push(block.text);
        }
    }
    if(!pages.length) {
        const embed=new EmbedBuilder().setColor(0x000000).setTitle(candidate.school.slice(0,250)).setAuthor({name:`${program(filter.program).name} · ${filter.topic ? filter.topic.charAt(0).toUpperCase()+filter.topic.slice(1) : 'Program information'}`})
            .setDescription(`The requested ${filter.topic || 'program'} information could not be retrieved. It may be in a PDF, a restricted portal, or another school page.`)
            .addFields({name:'Pages checked',value:String(seen.size)}, {name:'Source reference',value:root});
        if(errors.length) embed.addFields({name:'Retrieval status',value:escapeMarkdown(errors[0]).slice(0,700)});
        return [embed.setTimestamp(at).toJSON()];
    }
    return pages.map((page,index)=>new EmbedBuilder().setColor(0x000000).setTitle(candidate.school.slice(0,250)).setAuthor({name:`${program(filter.program).name} · ${filter.topic ? filter.topic.charAt(0).toUpperCase()+filter.topic.slice(1) : 'Program information'}`})
        .setDescription(formatInformationText(page.text).slice(0,3600))
        .addFields({name:'Applies to',value:page.general ? 'General school information. Program-specific requirements are not confirmed.' : 'The program and intake named above. Dates are shown as published.'},
            {name:'Source reference',value:page.url})
        .setFooter({text:`Page ${index+1}/${pages.length} · Check intake dates · Retrieved`}).setTimestamp(at).toJSON());
}
