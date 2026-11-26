import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';

const pages = [
    {
        title: 'Study Perks', color: 0x147d85,
        rewards: [
            ['Bonus /lfg Post', 500, 'Get one extra post after reaching your 24-hour limit.'],
            ['Study Streak Freeze', 500, 'Protect your streak through one missed study window.'],
            ['24h Double XP', 8000, 'Earn twice the XP for 24 hours.'],
            ['1 Hour Study or TEAS Review Session', 350000, 'Book a one-hour study or TEAS review.'],
        ],
    },
    {
        title: 'Discord Perks', color: 0x6652a3,
        rewards: [
            ['Choose a Server Emoji', 5000, 'Pick a server emoji to add for one month.'],
            ['Role Color Pass · 30 days', 10000, 'Choose a display color for 30 days.'],
            ['1 Month of Premium Membership', 500000, 'Get one month of HSG Premium.'],
        ],
    },
    {
        title: 'HSG Gear', color: 0x314b69,
        rewards: [
            ['HealthScienceGuild Bracelet', 450000, 'Redeem an HSG bracelet.'],
            ['HealthScienceGuild Pin', 450000, 'Redeem an HSG pin.'],
            ['Large Transparent Waterproof Backpack with HSG Logo', 1000000, 'Redeem a clear backpack with the HSG logo.'],
        ],
    },
];

const formatCoins = new Intl.NumberFormat('en-US');

function render(pageIndex) {
    const page = pages[pageIndex];
    const embed = new EmbedBuilder()
        .setTitle('HealthScienceGuild Reward Shop')
        .setColor(page.color)
        .setDescription('**' + page.title + '**\nCatalog preview · Redemptions open after setup.')
        .setFooter({ text: 'Merit Coins · ' + (pageIndex + 1) + ' / ' + pages.length })
        .addFields(page.rewards.map(([name, price, description]) => ({
            name,
            value: '**' + formatCoins.format(price) + ' Merit Coins**\n' + description,
        })));

    const buttons = pages.map(({ title }, index) =>
        new ButtonBuilder()
            .setCustomId('hsg_reward_shop:' + index)
            .setLabel(title)
            .setStyle(index === pageIndex ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(index === pageIndex)
    );

    buttons.push(new ButtonBuilder()
        .setCustomId('hsg_reward_shop:sell')
        .setLabel('Sell Chest Items')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true));

    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(buttons)],
    };
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('reward-shop')
        .setDescription('Browse HealthScienceGuild rewards priced in Merit Coins.'),

    async execute(interaction) {
        const response = await interaction.reply({
            ...render(0),
            flags: MessageFlags.Ephemeral,
            withResponse: true,
        });

        const collector = response.resource.message.createMessageComponentCollector({
            filter: button => button.user.id === interaction.user.id
                && /^hsg_reward_shop:[0-2]$/.test(button.customId),
            time: 120_000,
        });

        collector.on('collect', async button => {
            try {
                const pageIndex = Number(button.customId.split(':')[1]);
                await button.update(render(pageIndex));
            } catch (error) {
                console.error('Failed to update the HSG reward shop', error);
            }
        });

        collector.on('end', () => {
            void interaction.editReply({ components: [] }).catch(() => {});
        });
    },
};
