import { Events } from 'discord.js';
import { CAREER_ROLES } from '../commands/Career_roles/careerroles.js';

export default {
    name: Events.MessageReactionRemove,

async execute(reaction, user, details, client) {
    try {
            // Ignore bots.
            if (user.bot) return;

            // Fetch partial reaction data if necessary.
            if (reaction.partial) {
                await reaction.fetch();
            }

            const message = reaction.message;

            // Must be inside a Discord server.
            if (!message.guild) return;

            // Get the official BiologyHQ career-role panel.
            const panel = await client.db.get(
                `careerroles:${message.guild.id}`
            );

            // Ignore reactions from every other message.
            if (
                !panel ||
                panel.messageId !== message.id
            ) {
                return;
            }

            // Get the animated emoji ID.
            const emojiId = reaction.emoji.id;

            if (!emojiId) return;

            // Find the career associated with the emoji.
            const career = CAREER_ROLES.find(
                item => item.emojiId === emojiId
            );

            if (!career) return;

            // Fetch the member.
            const member =
                await message.guild.members.fetch(user.id);

            // Find the BiologyHQ role.
            const role =
                message.guild.roles.cache.get(
                    career.roleId
                ) ??
                await message.guild.roles.fetch(
                    career.roleId
                );

            if (!role) {
                console.error(
                    `Career role not found: ${career.name}`
                );
                return;
            }

            // Make sure AbbieBot can manage this role.
            const botMember =
                message.guild.members.me;

            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                console.error(
                    `AbbieBot cannot manage ${career.name}.`
                );
                return;
            }

            // Nothing to remove if the member doesn't have it.
            if (!member.roles.cache.has(role.id)) {
                return;
            }

            // Remove the career role.
            await member.roles.remove(
                role,
                'BiologyHQ career role reaction removed'
            );

            console.log(
                `➖ Removed ${career.name} from ${user.tag}`
            );

        } catch (error) {
            console.error(
                '❌ Career role reaction-remove error:',
                error
            );
        }
    }
};
