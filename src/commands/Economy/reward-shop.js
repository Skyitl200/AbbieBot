import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';

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
        const embed = new EmbedBuilder()
            .setTitle('HealthScienceGuild Reward Shop')
            .setColor(0x38a4cf)
            .setDescription(formatCatalog())
            .setFooter({ text: 'Catalog preview · Redemptions open after setup' });

        const actions = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('hsg_reward_shop:sell')
                .setLabel('Sell Chest Items')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
        );

        await interaction.reply({
            embeds: [embed],
            components: [actions],
            flags: MessageFlags.Ephemeral,
        });
    },
};
