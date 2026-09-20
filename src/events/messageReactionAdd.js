import { Events } from 'discord.js';
import { CAREER_ROLES } from '../commands/Career_roles/careerroles.js';

export default {
    name: Events.MessageReactionAdd,

    async execute(reaction, user, client) {
        try {
            // Ignore AbbieBot and other bots.
            if (user.bot) return;

            // Fetch the reaction if Discord only gave us partial data.
            if (reaction.partial) {
                await reaction.fetch();
            }

            const message = reaction.message;

            // Reaction must be inside a server.
            if (!message.guild) return;

            // Get the saved BiologyHQ career-role panel.
            const panel = await client.db.get(
                `careerroles:${message.guild.id}`
            );

            // Ignore reactions on every other Discord message.
            if (
                !panel ||
                panel.messageId !== message.id
            ) {
                return;
            }

            // Get the custom animated emoji ID.
            const emojiId = reaction.emoji.id;

            if (!emojiId) return;

            // Find which career this emoji belongs to.
            const career = CAREER_ROLES.find(
                item => item.emojiId === emojiId
            );

            // Ignore reactions that aren't one of our career emojis.
            if (!career) return;

            // Fetch the member who reacted.
            const member =
                await message.guild.members.fetch(user.id);

            // Find the corresponding BiologyHQ role.
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

            // Safety: AbbieBot cannot manage roles above itself.
            const botMember =
                message.guild.members.me;

            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                console.error(
                    `AbbieBot cannot manage ${career.name}. ` +
                    `Move AbbieBot above this role.`
                );

                return;
            }

            // Don't add the role twice.
            if (member.roles.cache.has(role.id)) {
                return;
            }

            // Give the user the career role.
            await member.roles.add(
                role,
                'BiologyHQ career role reaction'
            );

            console.log(
                `✅ Added ${career.name} to ${user.tag}`
            );

        } catch (error) {
            console.error(
                '❌ Career role reaction-add error:',
                error
            );
        }
    }
};
