export const BOX_SIZE = 12;
export const MAX_BOXES = 20;
export const MAX_PETS = BOX_SIZE * MAX_BOXES;
export const MAX_LEVEL = 100;
export const MAX_HP = 100; // Level-one base; battle HP scales with level.
export const hpForLevel = level => MAX_HP + 10 * (Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1))) - 1);
export const attackForLevel = level => 25 + 3 * (Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1))) - 1);
export const wildAttackForLevel = level => 20 + 2 * (Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1))) - 1);
export const xpToNextLevel = level => level >= MAX_LEVEL ? null : 50 + 25 * (level - 1);
