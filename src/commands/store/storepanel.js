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
    .setDescription('Posts the BiologyHQ Store panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'store',

  async execute(interaction) {
    await InteractionHelper.safeDefer(interaction, {
      flags: MessageFlags.Ephemeral
    });

    try {
      const storeImage = new AttachmentBuilder(
        './src/assets/store/biologyhq-store.png'
      );

      // Row 1 — Tutoring
      const tutoringRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Online Tutoring — $20')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/8S3H75QJPACAY')
          .setEmoji('💻'),

        new ButtonBuilder()
          .setLabel('In-Person Tutoring — $30')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/TD4JKV47FSUL2')
          .setEmoji('🎓')
      );

      // Row 2 — Individual Books
      const booksRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Anatomy I — $25')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/YMPZCT5RSZLCC')
          .setEmoji('🧠'),

        new ButtonBuilder()
          .setLabel('Anatomy II — $25')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.paypal.com/ncp/payment/BSBP2HFNXB7B2')
          .setEmoji('🫀'),

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
          .setLabel('Subscribe — $10/month')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⭐'),

        // Reuses BiologyHQ's existing ticket system.
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Open Purchase Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

      await interaction.channel.send({
        content:
          '**BiologyHQ Store**\n' +
          'Choose an option below. Payments are securely completed through PayPal.\n' +
          'For tutoring scheduling, book questions, or purchase help, open a ticket.',
        files: [storeImage],
        components: [
          tutoringRow,
          booksRow,
          membershipRow
        ]
      });

      await InteractionHelper.safeEditReply(interaction, {
        content: '✅ BiologyHQ Store panel posted successfully.'
      });

      logger.info('BiologyHQ Store panel posted successfully', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId
      });

    } catch (error) {
      logger.error('Failed to post BiologyHQ Store panel:', error);

      await InteractionHelper.safeEditReply(interaction, {
        content:
          '❌ I could not post the BiologyHQ Store panel. Check the Railway logs for the error.'
      });
    }
  }
};