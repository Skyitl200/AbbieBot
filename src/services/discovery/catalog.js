import { randomInt } from 'node:crypto';
import { rollMeritReward } from '../../utils/meritRewards.js';

export const CACHE_ID = 'discovery_cache';
export const CACHE_NAME = 'Treasure Crate';
export const DROP_ODDS = 300;
export const CACHE_ITEM = { id: CACHE_ID, name: CACHE_NAME, description: 'Open from /inventory for one random reward.' };
// All non-currency rewards are permanent inventory collectibles, not server roles.
export const CACHE_REWARDS = [
    { id: 'merit_coins', name: 'Merit Coins', rarity: 'Common', weight: 20, description: '5–30 coins; higher amounts are more likely.' },
    { id: 'discovery_field_badge', name: 'Field Researcher Badge', rarity: 'Common', weight: 20, description: 'A permanent collectible badge for your inventory.' },
    { id: 'discovery_microscope_pin', name: 'Microscope Pin', rarity: 'Common', weight: 15, description: 'A miniature microscope collectible.' },
    { id: 'discovery_dna_pin', name: 'DNA Helix Pin', rarity: 'Uncommon', weight: 12, description: 'A permanent double-helix collectible.' },
    { id: 'discovery_petri_charm', name: 'Petri Dish Charm', rarity: 'Uncommon', weight: 10, description: 'A tiny colony-themed collectible.' },
    { id: 'discovery_anatomy_atlas', name: 'Anatomy Atlas', rarity: 'Rare', weight: 8, description: 'A collectible miniature anatomy atlas.' },
    { id: 'discovery_silver_specimen', name: 'Silver Specimen', rarity: 'Rare', weight: 6, description: 'A silver specimen for your collection.' },
    { id: 'discovery_golden_microbe', name: 'Golden Microbe', rarity: 'Epic', weight: 4, description: 'A gold microbe collectible, separate from Microbemon pets.' },
    { id: 'discovery_prismatic_helix', name: 'Prismatic Helix', rarity: 'Epic', weight: 3, description: 'A shimmering helix collectible.' },
    { id: 'discovery_guild_relic', name: 'Guild Relic', rarity: 'Legendary', weight: 2, description: 'The rarest permanent collectible in this crate.' },
];
export const DISCOVERY_ITEMS = [CACHE_ITEM, ...CACHE_REWARDS.filter(item => item.id !== 'merit_coins')];
export const rollCacheDrop = (rng = randomInt) => rng(DROP_ODDS) === 0;
export function rollCacheReward(rng = randomInt) {
    let roll = rng(100);
    const item = CACHE_REWARDS.find(item => { roll -= item.weight; return roll < 0; });
    if (!item) throw new Error('Invalid cache reward roll');
    return { id: item.id, name: item.name, rarity: item.rarity, amount: item.id === 'merit_coins' ? rollMeritReward(rng) : 1 };
}
export const cacheFoundNotice = () => `🎁 You found a **${CACHE_NAME}**! Saved to your inventory. Use **/inventory** to open it.`;
