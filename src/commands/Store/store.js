import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('store')
        .setDescription('Open the BiologyHQ real-money store'),

    category: 'Store',

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🛒 BiologyHQ Store')
            .setDescription(
                '**Welcome to the BiologyHQ Store!**\n\n' +
                'Purchase tutoring services, study materials, and other BiologyHQ products using real USD.\n\n' +
                '💳 **Secure checkout coming next.**'
            );

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};