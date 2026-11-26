import { REWARD_PICKER_ID, selectReward } from '../../commands/Economy/reward-shop.js';

export default {
    name: REWARD_PICKER_ID,
    execute: selectReward,
};
