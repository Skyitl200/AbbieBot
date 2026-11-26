import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    TextDisplayBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import { fileURLToPath } from 'node:url';
import { pgConfig } from '../../config/database/postgres.js';
import { pgDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

const REWARD_SHOP_CHANNEL_ID = '1551092723698770062';

const STUDY_ROLE_ID = '1575576483668295840';
const STUDY_ROLE_NAME = 'Sun or Moon I Study';
const STUDY_ROLE_COST = 200_000;

const POSTER_NAME = 'hsg-reward-shop.png';
const POSTER_PATH = fileURLToPath(new URL('../../assets/hsg-reward-shop.png', import.meta.url));
const POSTER_ALT = 'HSG Reward Shop prices in Merit Coins. Bonus /lfg Post and Study Streak Freeze: ' +
    '500 each. Choose a Server Emoji: 5,000. 24h Double XP: 8,000. Role Color Pass: 10,000. ' +
    'Sun or Moon I Study: 200,000. One-hour Study or TEAS Review: 350,000. ' +
    'HSG Bracelet and Pin: 450,000 each. One month of Premium: 500,000. HSG backpack: 1,000,000.';

const formatCoins = new Intl.NumberFormat('en-US');

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

        const poster = new AttachmentBuilder(POSTER_PATH, { name: POSTER_NAME });
        const gallery = new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
                .setURL('attachment://' + POSTER_NAME)
                .setDescription(POSTER_ALT),
        );
        const actions = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('hsg_reward_shop_role')
                .setLabel('Redeem Sun or Moon I Study')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('hsg_reward_shop:sell')
                .setLabel('Sell Chest Items')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
        );

        await interaction.reply({
            components: [
                gallery,
                actions,
                new TextDisplayBuilder().setContent('-# Role redemption is open. Other rewards and chest sellback are coming soon.'),
            ],
            files: [poster],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
