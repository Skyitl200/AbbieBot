import { fileURLToPath } from 'node:url';
import { logger } from '../../utils/logger.js';

const root = new URL('../../assets/boosts/', import.meta.url);
export const boostBadgePath = fileURLToPath(new URL('winged-badge.png', root));
const clients = new WeakMap();

export async function boostEmojis(client) {
    const previous = clients.get(client);
    if (previous && previous.expiresAt > Date.now()) return previous.promise;
    const state = { expiresAt: Infinity };
    state.promise = Promise.resolve().then(async () => {
        const manager = client.application?.emojis;
        const fallback = { xp: '🧪', soundboard: '🎛️' };
        if (!manager) return fallback;
        try {
            const existing = await manager.fetch();
            const result = { ...fallback };
            for (const [key, name, file] of [
                ['xp', 'hsg_boost_xp', 'xp-potion.png'],
                ['soundboard', 'hsg_boost_soundboard', 'soundboard.png'],
            ]) {
                const emoji = existing.find(item => item.name === name) || await manager.create({
                    name, attachment: fileURLToPath(new URL(file, root)),
                });
                result[key] = `<:${emoji.name}:${emoji.id}>`;
            }
            return result;
        } catch (error) {
            state.expiresAt = Date.now() + 5 * 60_000;
            logger.warn(`Boost announcement emoji setup failed; using standard emoji: ${error.message}`);
            return fallback;
        }
    });
    clients.set(client, state);
    return state.promise;
}
