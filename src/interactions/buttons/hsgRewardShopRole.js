import { redeemStudyRole } from '../../commands/Economy/reward-shop.js';

export default {
    name: 'hsg_reward_shop_role',
    async execute(interaction) {
        return redeemStudyRole(interaction);
    },
};
