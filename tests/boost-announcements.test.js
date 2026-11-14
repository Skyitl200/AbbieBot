import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, ChannelType, GuildSystemChannelFlags, MessageType, PermissionFlagsBits, PermissionsBitField, SystemChannelFlagsBitField } from 'discord.js';
import { boostAnnouncement } from '../src/services/boosts/announcement.js';
import { boostEmojis } from '../src/services/boosts/artwork.js';
import { handleBoostMessage, BOOST_MESSAGE_TYPES } from '../src/services/boosts/handler.js';
import { boostedMessageXp } from '../src/services/boosts/settings.js';
import command from '../src/commands/Utility/boosts.js';

const guildId = '1540000000000000000', generalId = '1540000000000000001';
const user = { id: '1540000000000000002', username: 'Student', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' };
function fixture(enabled = true) {
    const data = new Map([[`guild:${guildId}:config`, { boostAnnouncements: { enabled, channelId: generalId, xpBonusPercent: 20 } }]]);
    const sent = [], changes = [];
    const me = { permissions: new PermissionsBitField([PermissionFlagsBits.ManageGuild]) };
    const guild = { id: guildId, name: 'HealthScienceGuild', systemChannelId: '1540000000000000009', systemChannelFlags: new SystemChannelFlagsBitField(0), members: { me } };
    const general = { id: generalId, guild, type: ChannelType.GuildText,
        permissionsFor: () => new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles]),
        async send(payload) { sent.push(payload); return { id: `announcement-${sent.length}` }; } };
    guild.channels = { async fetch(id) { assert.ok([generalId,guild.systemChannelId].includes(id)); return general; } };
    guild.setSystemChannel = async c => { changes.push(['channel', c.id]); guild.systemChannelId = c.id; };
    guild.setSystemChannelFlags = async flags => { changes.push(['flags',flags]); guild.systemChannelFlags = flags; };
    const client = { db: { async get(k, fallback) { return data.get(k) ?? fallback; }, async set(k,v) { data.set(k,v); return true; } } };
    const message = { id: '1540000000000000003', guild, author: user, member: { displayName: 'Student' }, type: MessageType.GuildBoost, createdAt: new Date('2026-11-14T18:00:00Z') };
    return { client, guild, general, message, data, sent, changes };
}
function interaction(f, action, allowed = true) {
    const replies = [];
    return { guildId, guild: f.guild, client: f.client, user, member: { displayName: 'Student' },
        memberPermissions: new PermissionsBitField(allowed ? [PermissionFlagsBits.ManageGuild] : []),
        options: { getSubcommand: () => action, getChannel: () => f.general },
        replies,
        async deferReply(p) { assert.equal(p.flags,64); },
        async reply(p) { replies.push(p); },
        async editReply(p) { replies.push(p); },
    };
}

test('announcement has eight approved perks, purple accent, winged badge, and a server-specific Boost Now link', () => {
    assert.equal(command.guildOnly,true);
    assert.equal(command.slashOnly,true);
    const f = fixture();
    const payload = boostAnnouncement({ guild: f.guild, user, emojis: { xp: '<:potion:1540000000000000010>', soundboard: '<:soundboard:1540000000000000011>' } });
    const embed = payload.embeds[0].toJSON();
    assert.equal(embed.color, 0xc65ae8);
    assert.equal(embed.thumbnail.url, 'attachment://boost-rank.png');
    assert.equal(embed.author.icon_url, user.displayAvatarURL());
    assert.match(embed.fields[0].name,/🔓/);
    assert.match(embed.fields[0].value,/😈/);
    assert.ok(embed.timestamp);
    assert.ok(payload.files[0].attachment.endsWith('winged-badge.png'));
    const lines = embed.fields[0].value.split('\n');
    assert.equal(lines.length,8);
    assert.match(lines[1], /20% XP/);
    assert.match(lines[6], /HealthScienceGuild Fun social commands/);
    assert.doesNotMatch(embed.fields[0].value, /camera/i);
    const button = payload.components[0].toJSON().components[0];
    assert.equal(button.label,'Boost Now');
    assert.equal(button.url,`https://discord.com/channels/${guildId}`);
    assert.deepEqual(payload.allowedMentions,{ parse: [], users: [user.id] });
});

test('transient Discord failures retry automatically with the same nonce', async () => {
    const f=fixture(); const original=f.general.send; const nonces=[];
    f.general.send=async payload=>{
        nonces.push(payload.nonce);
        if(nonces.length===1) throw Object.assign(new Error('Service unavailable'),{status:503});
        return original(payload);
    };
    await handleBoostMessage(f.message,f.client);
    assert.equal(f.sent.length,1);
    assert.deepEqual(nonces,[f.message.id,f.message.id]);
});

test('first boosts, repeat boosts, and tier-up boost notices each announce once, to general rather than the source channel', async () => {
    const f = fixture();
    assert.equal(BOOST_MESSAGE_TYPES.size,4);
    for (const [i,type] of [...BOOST_MESSAGE_TYPES].entries()) {
        const event = { ...f.message, type, id: String(BigInt(f.message.id)+BigInt(i)) };
        await Promise.all([handleBoostMessage(event,f.client),handleBoostMessage(event,f.client)]);
    }
    assert.equal(f.sent.length,4);
    assert.ok(f.sent.every(p=>p.enforceNonce && p.nonce));
    // A second boost by the same user must not be suppressed by a user-based receipt.
    await handleBoostMessage({ ...f.message,id:'1540000000000000099' },f.client);
    assert.equal(f.sent.length,5);
});

test('disabled servers, ordinary messages, DMs and an inaccessible destination do not announce', async () => {
    const f=fixture(false);
    assert.equal(await handleBoostMessage(f.message,f.client),true);
    assert.equal(await handleBoostMessage({...f.message,type:MessageType.Default},f.client),false);
    assert.equal(await handleBoostMessage({...f.message,guild:null},f.client),false);
    assert.equal(f.sent.length,0);
    f.data.get(`guild:${guildId}:config`).boostAnnouncements.enabled=true;
    f.general.permissionsFor=()=>new PermissionsBitField([]);
    await handleBoostMessage(f.message,f.client);
    assert.equal(f.sent.length,0);
});

test('a failed send is retryable and is never stored as delivered', async () => {
    const f=fixture(); const original=f.general.send;
    f.general.send=async()=>{throw new Error('Temporary Discord outage');};
    await handleBoostMessage(f.message,f.client);
    assert.ok(![...f.data.keys()].some(k=>k.startsWith('boost:announcement:')));
    f.general.send=original;
    await handleBoostMessage(f.message,f.client);
    assert.equal(f.sent.length,1);
});

test('PostgreSQL receipts survive a new client and release locks/connections', async () => {
    const f=fixture(); const receipts=new Map(); let releases=0;
    const pool={async connect(){return{async query(sql,params){
        if(sql.startsWith('SELECT value')) return {rows:receipts.has(params[0])?[{value:receipts.get(params[0])}]:[]};
        if(sql.startsWith('INSERT INTO')) receipts.set(params[0],JSON.parse(params[1]));
        return {rows:[]};
    },release(){releases++;}};}};
    f.client.db.pool=pool;
    await handleBoostMessage(f.message,f.client);
    await handleBoostMessage(f.message,{db:{...f.client.db,pool}});
    assert.equal(f.sent.length,1);
    assert.equal(releases,2);
    assert.equal(receipts.size,1);
});

test('setup enables boost notices, keeps an existing system channel, and persists the chosen general channel', async () => {
    const f=fixture(false);
    f.guild.systemChannelFlags=new SystemChannelFlagsBitField([GuildSystemChannelFlags.SuppressPremiumSubscriptions,GuildSystemChannelFlags.SuppressJoinNotifications]);
    const i=interaction(f,'setup');
    await command.execute(i,null,f.client);
    const settings=f.data.get(`guild:${guildId}:config`).boostAnnouncements;
    assert.deepEqual(settings,{enabled:true,channelId:generalId,xpBonusPercent:20});
    assert.equal(f.guild.systemChannelId,'1540000000000000009');
    assert.equal(f.guild.systemChannelFlags.has(GuildSystemChannelFlags.SuppressPremiumSubscriptions),false);
    assert.equal(f.guild.systemChannelFlags.has(GuildSystemChannelFlags.SuppressJoinNotifications),true);
    assert.match(i.replies[0], /Future boosts will be announced/);
    assert.equal(f.sent.length,0);
});

test('preview stays private and setup rejects an unauthorized user or missing channel permissions', async () => {
    const f=fixture(false);
    let i=interaction(f,'preview'); await command.execute(i,null,f.client);
    assert.equal(i.replies[0].embeds[0].toJSON().footer?.text,'Preview only • No announcement was posted', JSON.stringify(i.replies));
    assert.equal(f.sent.length,0);
    i=interaction(f,'setup',false); await command.execute(i,null,f.client);
    assert.match(i.replies[0].content,/Manage Server/);
    f.general.permissionsFor=()=>new PermissionsBitField([]);
    i=interaction(f,'setup');await command.execute(i,null,f.client);
    assert.match(i.replies[0].content,/View Channel/);
    assert.equal(f.data.get(`guild:${guildId}:config`).boostAnnouncements.enabled,false);
});

test('disable stops both announcements and XP bonus; nonboosters retain normal XP', async () => {
    const f=fixture();
    const settings={enabled:true,xpBonusPercent:20};
    assert.equal(boostedMessageXp(25,{premiumSinceTimestamp:1},settings),30);
    assert.equal(boostedMessageXp(25,{premiumSinceTimestamp:null},settings),25);
    assert.equal(boostedMessageXp(25,{premiumSinceTimestamp:1},{enabled:false,xpBonusPercent:20}),25);
    const i=interaction(f,'disable');await command.execute(i,null,f.client);
    assert.equal(f.data.get(`guild:${guildId}:config`).boostAnnouncements.enabled,false);
    await handleBoostMessage(f.message,f.client);assert.equal(f.sent.length,0);
});

test('custom application emoji are reused or created once, without changing guild emoji slots', async () => {
    const created=[];
    const client={application:{emojis:{async fetch(){return new Collection();},async create(options){
        created.push(options);return{name:options.name,id:`154000000000000001${created.length}`};
    }}}};
    const [first,second]=await Promise.all([boostEmojis(client),boostEmojis(client)]);
    assert.equal(created.length,2);
    assert.deepEqual(first,second);
    assert.match(first.xp,/<:hsg_boost_xp:/);
    assert.ok(created.every(o=>o.attachment.endsWith('.png')));
});

test('a native boost notice bypasses prefix commands, leveling, and counting games', async () => {
    const {default:event}=await import('../src/events/messageCreate.js');
    const f=fixture(false); const read=f.client.db.get; const keys=[];
    f.client.db.get=async(key,fallback)=>{keys.push(key);return read(key,fallback);};
    await event.execute(f.message,f.client);
    assert.deepEqual(keys,[`guild:${guildId}:config`]);
    assert.equal(f.sent.length,0);
});

test('setup cannot route announcements across guilds and requires boost-notice visibility', async () => {
    const f=fixture(false);
    f.general.guild={id:'1540000000000000099'};
    let i=interaction(f,'setup');await command.execute(i,null,f.client);
    assert.equal(f.data.get(`guild:${guildId}:config`).boostAnnouncements.enabled,false);
    assert.match(i.replies[0].content,/Could not configure/);
    f.general.guild=f.guild;
    f.guild.systemChannelFlags=new SystemChannelFlagsBitField(GuildSystemChannelFlags.SuppressPremiumSubscriptions);
    f.guild.members.me.permissions=new PermissionsBitField([]);
    i=interaction(f,'setup');await command.execute(i,null,f.client);
    assert.match(i.replies[0].content,/Enable server boost system messages/);
    assert.equal(f.changes.length,0);
});

test('setup can assign general as the system channel when no system channel exists', async () => {
    const f=fixture(false);f.guild.systemChannelId=null;
    const i=interaction(f,'setup');await command.execute(i,null,f.client);
    assert.equal(f.guild.systemChannelId,generalId);
    assert.equal(f.data.get(`guild:${guildId}:config`).boostAnnouncements.enabled,true);
    assert.deepEqual(f.changes[0],['channel',generalId]);
});
