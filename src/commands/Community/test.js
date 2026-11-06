import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { classMessage } from '../../services/study/interface.js';

export default {
    slashOnly: true,
    category: 'Community',
    data: new SlashCommandBuilder().setName('test').setDescription('Choose a class and topic, practice questions, and earn Merit Coins.'),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.editReply(classMessage(interaction.user.id));
    },
};
