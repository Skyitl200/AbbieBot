import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';

const REWARD_SHOP_CHANNEL_ID = '1551091551726342144';

const rewards = [
    ["Bonus /lfg Post",500,"After reaching the 24-hour limit"],
    ["Study Streak Freeze",500],
    ["Choose a Server Emoji",5000,"Added for 1 month"],
    ["24h Double XP",8000],
    ["Role Color Pass · 30 days",10000],
    ["1 Hour Study or TEAS Review Session",350000],
    ["HealthScienceGuild Bracelet",450000],
    ["HealthScienceGuild Pin",450000],
    ["1 Month of Premium Membership",500000],
    ["Large Transparent Waterproof Backpack",1000000,"With HSG Logo"]
];

const formatCoins = new Intl.NumberFormat('en-US');

function formatCatalog() {
    const nameWidth = 38;
    const priceWidth = 11;
    const rows = [
        'Reward'.padEnd(nameWidth) + 'Merit Coins'.padStart(priceWidth),
        '─'.repeat(nameWidth + priceWidth),
    ];

    for (const [name, price, detail] of rewards) {
        rows.push(name.padEnd(nameWidth) + formatCoins.format(price).padStart(priceWidth));
        if (detail) rows.push('  ' + detail);
    }

    return ['```', ...rows, '```'].join('\n');
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('reward-shop')
        .setDescription('Browse HealthScienceGuild rewards priced in Merit Coins.'),

    async execute(interaction) {
        if (interaction.channelId !== REWARD_SHOP_CHANNEL_ID) {
            await interaction.reply({
                content: 'Open the HSG Reward Shop in <#' + REWARD_SHOP_CHANNEL_ID + '>.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('HealthScienceGuild Reward Shop')
            .setColor(0x38a4cf)
            .setDescription(formatCatalog())
            .setFooter({ text: 'Catalog preview · Redemptions open after setup' });

        const earning = new EmbedBuilder()
            .setTitle('How Merit Coins Work')
            .setColor(0x38a4cf)
            .setDescription(
                'Earn **15–50 Merit Coins** for participating in HSG learning activities. ' +
                'Premium members earn **double**. Save your coins for Discord perks, study sessions, and HSG gear.',
            );

        const redemption = new EmbedBuilder()
            .setTitle('Redeem Rewards & Sell Chest Items')
            .setColor(0x38a4cf)
            .setDescription(
                'When redemptions open, use Merit Coins to claim rewards from the list above. ' +
                'The shop will guide you through gear and study session requests.\n\n' +
                'When chest sellback opens, choose **Sell Chest Items** to see the offer for an eligible item ' +
                'like the **Petri Dish Emblem**, then confirm the sale.',
            );

        const actions = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('hsg_reward_shop:sell')
                .setLabel('Sell Chest Items')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
        );

        await interaction.reply({
            embeds: [embed, earning, redemption],
            components: [actions],
        });
    },
};
