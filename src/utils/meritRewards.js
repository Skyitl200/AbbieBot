import { randomInt } from 'node:crypto';

// Each extra coin increases the weight: 5 has weight 1, 30 has weight 26.
// Total weight 351; mean payout is 21.67 coins.
export function rollMeritReward(rng = randomInt) {
    let roll = rng(351);
    for (let amount = 5; amount <= 30; amount++) {
        roll -= amount - 4;
        if (roll < 0) return amount;
    }
    throw new Error('Invalid Merit Coin random roll');
}
