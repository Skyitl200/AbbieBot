import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags
} from 'discord.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('storepanel')
    .setDescription('Posts or updates the HealthScienceGuild Store panel.')
    .addStringOption(option => option
      .setName('message_id')
      .setDescription('Existing bot store message in this channel to replace')
      .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'store',

  async execute(interaction) {
    await InteractionHelper.safeDefer(interaction, {
      flags: MessageFlags.Ephemeral
    });

    try {
      const storeImage = new AttachmentBuilder(
        './src/assets/store/healthscienceguild-store-horizontal.png'
      );

      // Row 1 — Tutoring
      const tutoringRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Online Tutoring — $20')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/8S3H75QJPACAY')
          .setEmoji('💻')
      );

      // Row 2 — Individual Books
      const booksRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Anatomy 1 & 2 — $25')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/BSBP2HFNXB7B2'),

        new ButtonBuilder()
          .setLabel('Health Science Chemistry Book — $25')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/YMPZCT5RSZLCC'),

        new ButtonBuilder()
          .setLabel('Microbiology — $25')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/2DD389BDTEU3N')
          .setEmoji('🦠')
      );

      // Row 3 — Bundle, Subscription & Ticket
      const membershipRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('3-Book Bundle — $60')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/MAP4TY6AVXCV2')
          .setEmoji('📚'),

        new ButtonBuilder()
          .setCustomId('paypal_subscribe')
          .setLabel('Subscribe — $14.87/month')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⭐'),

        // Reuses HealthScienceGuild's existing ticket system.
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Open Purchase Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

      const messageId = interaction.options.getString('message_id');
      const existingMessage = messageId
        ? await interaction.channel.messages.fetch(messageId)
        : null;
      if (existingMessage && existingMessage.author.id !== interaction.client.user.id) {
        await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Choose a store message posted by this bot in this channel.'
        });
        return;
      }

      const payload = {
        content:
          '**HealthScienceGuild Store**\n' +
          'Choose an option below. Payments are securely completed through PayPal.\n' +
          'For tutoring scheduling, book questions, or purchase help, open a ticket.',
        files: [storeImage],
        components: [
          tutoringRow,
          booksRow,
          membershipRow
        ]
      };

      if (existingMessage) {
        await existingMessage.edit({ ...payload, attachments: [], embeds: [] });
      } else {
        await interaction.channel.send(payload);
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: '✅ HealthScienceGuild Store panel saved successfully.'
      });

      logger.info('HealthScienceGuild Store panel posted successfully', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId
      });

    } catch (error) {
      logger.error('Failed to post HealthScienceGuild Store panel:', error);

      await InteractionHelper.safeEditReply(interaction, {
        content:
          '❌ I could not post the HealthScienceGuild Store panel. Check the Railway logs for the error.'
      });
    }
  }
};