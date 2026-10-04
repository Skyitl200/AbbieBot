import { logger } from '../../../utils/logger.js';

const LFG_JOIN_PREFIX = 'lfg_join:';

export default {
    name: 'lfg_join',

    async execute(interaction) {
        try {
            const channelId =
                interaction.customId.split(':')[1];

            if (!channelId) {
                return interaction.reply({
                    content:
                        '❌ This Study Room is invalid.',
                    ephemeral: true
                });
            }

            const guild =
                interaction.guild;

            const channel =
                await guild.channels.fetch(
                    channelId
                ).catch(() => null);

            if (!channel) {
                return interaction.reply({
                    content:
                        '❌ This Study Room no longer exists.',
                    ephemeral: true
                });
            }

            /*
             * Make sure this is actually
             * a voice channel.
             */
            if (!channel.isVoiceBased()) {
                return interaction.reply({
                    content:
                        '❌ This is not a valid Study Room.',
                    ephemeral: true
                });
            }

            /*
             * If the user is already inside
             * the Study Room.
             */
            if (
                interaction.member.voice?.channelId ===
                channel.id
            ) {
                return interaction.reply({
                    content:
                        '🔊 You are already in this Study Room.',
                    ephemeral: true
                });
            }

            /*
             * Check the room's user limit.
             */
            const userLimit =
                channel.userLimit;

            const currentUsers =
                channel.members.filter(
                    member =>
                        !member.user.bot
                ).size;

            if (
                userLimit > 0 &&
                currentUsers >= userLimit
            ) {
                return interaction.reply({
                    content:
                        '❌ This Study Room is currently full.',
                    ephemeral: true
                });
            }

            /*
             * Make sure the bot can move
             * the member.
             */
            const botMember =
                guild.members.me;

            if (
                !botMember?.permissions.has(
                    'MoveMembers'
                )
            ) {
                return interaction.reply({
                    content:
                        '❌ I do not have permission to move members into Study Rooms.',
                    ephemeral: true
                });
            }

            /*
             * Move the person into the
             * Study Room.
             */
            await interaction.member.voice.setChannel(
                channel,
                'Joined LFG Study Room'
            );

            return interaction.reply({
                content:
                    `🔊 You joined **${channel.name}**!`,
                ephemeral: true
            });

        } catch (error) {
            logger.error(
                'LFG join button error:',
                error
            );

            if (!interaction.replied) {
                return interaction.reply({
                    content:
                        '❌ I could not move you into the Study Room.',
                    ephemeral: true
                });
            }
        }
    }
};

export {
    LFG_JOIN_PREFIX
};
