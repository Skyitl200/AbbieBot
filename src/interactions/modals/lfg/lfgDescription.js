import { logger } from '../../../utils/logger.js';
import { SUBJECTS } from '../../../handlers/lfgSelectMenus.js';

const LFG_DESCRIPTION_MODAL_PREFIX = 'lfg_description:';

export default {
    name: 'lfg_description',

    async execute(interaction) {
        try {
            const parts = interaction.customId.split(':');

            const creatorId = parts[1];
            const selectedSubject = parts[2];

            if (creatorId !== interaction.user.id) {
                return interaction.reply({
                    content:
                        '❌ This LFG form belongs to someone else.',
                    ephemeral: true
                });
            }

            const subject = SUBJECTS[selectedSubject];

            if (!subject) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG subject.',
                    ephemeral: true
                });
            }

            const description =
                interaction.fields.getTextInputValue(
                    'lfg-description'
                );

            /*
             * The next step will use:
             *
             * - interaction.guild
             * - interaction.member
             * - subject
             * - description
             *
             * to create the temporary Study Room
             * and the public LFG post.
             */

            await interaction.reply({
                content:
                    `✅ **${subject.label}** selected.\n\n` +
                    `**Description:** ${description}\n\n` +
                    `Your Study Room creation is next.`,
                ephemeral: true
            });

        } catch (error) {
            logger.error(
                'LFG description modal error:',
                error
            );

            if (!interaction.replied) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong while creating your LFG.',
                    ephemeral: true
                });
            }
        }
    }
};

export {
    LFG_DESCRIPTION_MODAL_PREFIX
};
