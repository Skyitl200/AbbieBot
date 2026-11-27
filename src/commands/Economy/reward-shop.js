import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import { pgConfig } from '../../config/database/postgres.js';
import { pgDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

const REWARD_SHOP_CHANNEL_ID = '1551092723698770062';

const STUDY_ROLE_ID = '1575576483668295840';
const STUDY_ROLE_NAME = 'Sun or Moon I Study';
const STUDY_ROLE_COST = 200_000;

const rewards = [
    ["lfg","Bonus /lfg Post",500],
    ["freeze","Study Streak Freeze",5000],
    ["emoji","Choose a Server Emoji",7000],
    ["xp","24h Double XP",8000],
    ["color","Role Color Pass · 30 days",10000],
    ['study-role', STUDY_ROLE_NAME, STUDY_ROLE_COST],
    ["review","1 Hour Study or TEAS Review Session",350000],
    ["bracelet","HealthScienceGuild Bracelet",450000],
    ["pin","HealthScienceGuild Pin",450000],
    ["premium","1 Month of Premium Membership",500000],
    ["backpack","Large Transparent Waterproof Backpack",1000000],
];

export const REWARD_PICKER_ID = 'hsg_reward_picker';
const formatCoins = new Intl.NumberFormat('en-US');

const catalogDetails = {
    lfg: ' (after 24 hour limit is reached)',
    emoji: ' (to be added for 1 month)',
};
const catalogLabels = {
    'study-role': 'Role Sun or Moon I Study (Role)',
    backpack: 'Large Transparent Waterproof Backpack with HSG Logo',
};

function formatShop(guild) {
    const emoji = (id, name) =>
        guild?.client?.emojis?.cache?.get(id)?.toString() ?? `<a:${name}:${id}>`;
    const gift = emoji('1575591241557479434', '2755presentbox');
    const coins = emoji('1553716009456898098', 'ManyMerits');
    const coin = emoji('1553709164012900404', 'MeritCoins');
    return new EmbedBuilder()
        .setColor(0x526e91)
        .setTitle('✦ HEALTHSCIENCEGUILD REWARD SHOP ✦')
        .setDescription(gift + ' **Rewards**   ·   ' + coins + ' **Merit Coin Cost**')
        .addFields(rewards.map(([id, label, price]) => ({
            name: catalogLabels[id] ?? label,
            value: [coin + ' **' + formatCoins.format(price) + ' Merits**', catalogDetails[id]?.trim()]
                .filter(Boolean)
                .join('\n'),
            inline: false,
        })))
        .setFooter({ text: 'Choose a reward from the dropdown below.' });
}


export async function redeemStudyRole(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (interaction.channelId !== REWARD_SHOP_CHANNEL_ID || !interaction.guild) {
        return interaction.editReply('Open the HSG Reward Shop in <#' + REWARD_SHOP_CHANNEL_ID + '>.');
    }

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

export async function selectReward(interaction) {
    const reward = rewards.find(([id]) => id === interaction.values[0]);
    if (interaction.channelId !== REWARD_SHOP_CHANNEL_ID || !reward) {
        return interaction.reply({ content: 'Open the HSG Reward Shop to choose a reward.', flags: MessageFlags.Ephemeral });
    }

    const [id, label, price] = reward;
    if (id !== 'study-role') {
        return interaction.reply({ content: `**${label}** is coming soon. No Merit Coins were charged.`, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `Redeem **${label}** for **${formatCoins.format(price)} Merit Coins**?`,
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('hsg_reward_shop_role')
                .setLabel('Confirm redemption')
                .setStyle(ButtonStyle.Success),
        )],
        flags: MessageFlags.Ephemeral,
    });
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

        const picker = new StringSelectMenuBuilder()
            .setCustomId(REWARD_PICKER_ID)
            .setPlaceholder('Choose a reward')
            .addOptions(rewards.map(([id, label, price]) => ({
                label,
                value: id,
                description: `${formatCoins.format(price)} Merit Coins${id === 'study-role' ? '' : ' · Coming soon'}`,
            })));

        await interaction.reply({
            embeds: [formatShop(interaction.guild)],
            components: [new ActionRowBuilder().addComponents(picker)],
        });
    },
};
