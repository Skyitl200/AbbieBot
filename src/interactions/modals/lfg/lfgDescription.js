import { logger } from '../../../utils/logger.js';
import { SUBJECTS } from '../../../handlers/lfgSelectMenus.js';
import {
    createLfgVoiceChannel
} from '../../../services/lfg/lfgService.js';

const LFG_DESCRIPTION_MODAL_PREFIX = 'lfg_description:';

export default {
    name: 'lfg_description',

    async execute(interaction, client, args) {
        try {
            /*
             * The interaction dispatcher already splits:
             *
             * lfg_description:USER_ID:SUBJECT
             *
             * into:
             *
             * args[0] = USER_ID
             * args[1] = SUBJECT
             */
            const creatorId = args?.[0];
            const selectedSubject = args?.[1];

            if (
                !creatorId ||
                !selectedSubject
            ) {
                return interaction.reply({
                    content:
                        '❌ Your LFG information is incomplete. Please start again with `/lfg`.',
                    ephemeral: true
                });
            }

            if (
                creatorId !== interaction.user.id
            ) {
                return interaction.reply({
                    content:
                        '❌ This LFG form belongs to someone else.',
                    ephemeral: true
                });
            }

            const subject =
                SUBJECTS[selectedSubject];

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
             * Create the temporary Study Room.
             *
             * Default:
             * Maximum 4 people.
             *
             * The creator receives Manage Channels
             * so they can modify the room themselves.
             */
            const result =
                await createLfgVoiceChannel(
                    interaction,
                    subject.label
                );

            if (!result.success) {
                return interaction.reply({
                    content:
                        result.error ||
                        '❌ I could not create your Study Room.',
                    ephemeral: true
                });
            }

            /*
             * Move the creator into their new Study Room.
             */
            try {
                await interaction.member.voice.setChannel(
                    result.channel
                );
            } catch (moveError) {
                logger.warn(
                    `Could not move LFG creator ${interaction.user.id} into Study Room ${result.channel.id}:`,
                    moveError
                );
            }

            await interaction.reply({
                content:
                    `✅ **LFG created!**\n\n` +
                    `${subject.emoji} **${subject.label}**\n` +
                    `📝 **Description:** ${description}\n` +
                    `🔊 **Study Room:** ${result.channel}\n` +
                    `👥 **Maximum:** 4 people\n\n` +
                    `You control this Study Room and can change its limit or permissions from Discord.`,
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
