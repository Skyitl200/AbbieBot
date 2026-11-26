import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import { pgConfig } from '../../config/database/postgres.js';
import { pgDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

const REWARD_SHOP_CHANNEL_ID = '1551091551726342144';

const STUDY_ROLE_ID = '1575576483668295840';
const STUDY_ROLE_NAME = 'Sun or Moon I Study';
const STUDY_ROLE_COST = 200_000;

const rewards = [
    ["Bonus /lfg Post",500,"After reaching the 24-hour limit"],
    ["Study Streak Freeze",500],
    ["Choose a Server Emoji",5000,"Added for 1 month"],
    ["24h Double XP",8000],
    ["Role Color Pass · 30 days",10000],
    [STUDY_ROLE_NAME + ' (Role)', STUDY_ROLE_COST],
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

async function redeemStudyRole(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild, user } = interaction;
    const args = [guild.id, user.id, STUDY_ROLE_COST];
    let db;
    let granted = false;

    try {
        const role = await guild.roles.fetch(STUDY_ROLE_ID);
        if (!role?.editable) {
            return await interaction.editReply('The bot cannot assign this role right now. Your Merit Coins were not charged.');
        }

        db = await pgDb.pool.connect();
        await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
            `reward-shop:${guild.id}:${user.id}:${STUDY_ROLE_ID}`,
        ]);

        const member = await guild.members.fetch({ user: user.id, force: true });
        if (member.roles.cache.has(STUDY_ROLE_ID)) {
            await db.query('ROLLBACK');
            return await interaction.editReply(`You already have **${STUDY_ROLE_NAME}**.`);
        }

        const result = await db.query(
            `UPDATE ${pgConfig.tables.economy}
             SET balance = balance - $3,
                 data = jsonb_set(
                     COALESCE(NULLIF(data, '{}'::jsonb), jsonb_build_object('bank', bank)),
                     '{wallet}', to_jsonb(balance - $3)
                 ),
                 updated_at = CURRENT_TIMESTAMP
             WHERE guild_id = $1 AND user_id = $2 AND balance >= $3
             RETURNING balance`,
            args,
        );

        if (!result.rowCount) {
            await db.query('ROLLBACK');
            return await interaction.editReply(`You need **${formatCoins.format(STUDY_ROLE_COST)} Merit Coins** to redeem this role.`);
        }

        await member.roles.add(role, 'HSG Reward Shop redemption');
        granted = true;
        await db.query('COMMIT');
    } catch (error) {
        if (db) await db.query('ROLLBACK').catch(rollbackError => {
            logger.error('HSG study role redemption rollback failed', rollbackError);
        });
        logger.error('HSG study role redemption failed', {
            guildId: guild.id, userId: user.id, roleGranted: granted, error,
        });
        return interaction.editReply('The redemption could not be confirmed. Check your roles and Merit Coin balance before retrying.');
    } finally {
        db?.release();
    }

    return interaction.editReply(`You redeemed **${STUDY_ROLE_NAME}** for **${formatCoins.format(STUDY_ROLE_COST)} Merit Coins**. Your role has been added.`);
}

export default {
    slashOnly: true,
    guildOnly: true,
    data: new SlashCommandBuilder()
        .setName('reward-shop')
        .setDescription('Browse HealthScienceGuild rewards priced in Merit Coins.')
        .addBooleanOption(option => option
            .setName('redeem-study-role')
            .setDescription('Spend 200,000 Merit Coins to receive the Sun or Moon I Study role.')),

    async execute(interaction) {
        if (interaction.channelId !== REWARD_SHOP_CHANNEL_ID) {
            await interaction.reply({
                content: 'Open the HSG Reward Shop in <#' + REWARD_SHOP_CHANNEL_ID + '>.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (interaction.options.getBoolean('redeem-study-role')) {
            return redeemStudyRole(interaction);
        }

        const embed = new EmbedBuilder()
            .setTitle('HealthScienceGuild Reward Shop')
            .setColor(0x38a4cf)
            .setDescription(formatCatalog())
            .setFooter({ text: 'Sun or Moon I Study is available to redeem' });

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
                'Use `/reward-shop redeem-study-role:True` to claim the **Sun or Moon I Study** role. ' +
                'Other rewards are still in preview.\n\n' +
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
