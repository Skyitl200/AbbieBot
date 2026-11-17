import { creditActivity, saveVoice, clearOldVoice } from './store.js';
import { logger } from '../../utils/logger.js';
const queues = new Map();
const timers = new WeakMap();
export function eligibleVoice(state) {
    return Boolean(state?.channelId && state.member?.user && !state.member.user.bot && state.channelId !== state.guild?.afkChannelId);
}
function queuedVoice(client, guildId, userId, channelId, at) {
    const key = `${guildId}:${userId}`;
    const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => saveVoice(client, guildId, userId, channelId, at));
    queues.set(key, task);
    task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => {});
    return task;
}
export async function trackVoiceState(oldState, newState, client, at = Date.now()) {
    if (!client.studyTimeEnabled || client.studyTimeVoicePaused || (oldState.channelId === newState.channelId)) return;
    const state = newState.member ? newState : oldState;
    if (!state.member?.user || state.member.user.bot) return;
    await queuedVoice(client, state.guild.id, state.member.id, eligibleVoice(newState) ? newState.channelId : null, at);
}
async function checkpointConnected(client, at = Date.now()) {
    for (const guild of client.guilds.cache.values()) for (const state of guild.voiceStates.cache.values()) {
        if (eligibleVoice(state)) await queuedVoice(client, guild.id, state.member.id, state.channelId, at);
    }
}
export async function startStudyTime(client) {
    if (timers.has(client)) return;
    let busy = false;
    const tick = async () => {
        if (busy) return;
        busy = true;
        try {
            if (client.isReady && !client.isReady()) { client.studyTimeVoicePaused = true; return; }
            if (!client.studyTimeEnabled || client.studyTimeVoicePaused) {
                // Resume at the current instant, never invent study time during downtime.
                await clearOldVoice(client);
                client.studyTimeEnabled = true;
                client.studyTimeVoicePaused = false;
            }
            await checkpointConnected(client);
        } catch (error) { logger.warn(`Study-time voice tracking: ${error.message}`); }
        finally { busy = false; }
    };
    await tick();
    client.on?.('shardDisconnect', () => { client.studyTimeVoicePaused = true; });
    client.on?.('shardResume', tick);
    const timer = setInterval(tick, 60_000); timer.unref?.();
    timers.set(client, timer);
    client.once?.('invalidated', () => { clearInterval(timer); timers.delete(client); });
}
export async function creditTestQuestion(session, client, index = session.index) {
    if (!client.studyTimeEnabled || !session.guildId) return;
    try { await creditActivity(client, session.guildId, session.userId, 'test', `${session.rewardId || session.id}:${index}`); }
    catch (error) { logger.warn(`Study-time question credit failed: ${error.message}`); }
}
export const microbemonActivity = (client, interaction) => client.studyTimeEnabled && interaction.id && !interaction.user.bot
    ? { source: 'microbemon', receipt: interaction.id, at: Date.now() } : null;
