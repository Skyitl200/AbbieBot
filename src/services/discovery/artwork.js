import { fileURLToPath } from 'node:url';
import { EmbedBuilder } from 'discord.js';

export const CRATE_ART = {
    name: 'treasure-crate.gif',
    path: fileURLToPath(new URL('../../../study-assets/rewards/treasure-crate.gif', import.meta.url)),
};

// A separate card preserves the activity's existing model or Microbemon image.
export function withCrateArtwork(payload, found) {
    if (!found) return payload;
    return {
        ...payload,
        files: [...(payload.files || []), { attachment: CRATE_ART.path, name: CRATE_ART.name }],
        embeds: [...(payload.embeds || []), new EmbedBuilder({
            title: 'Treasure Crate found!', color: 0xffcf40,
            description: 'Saved to your inventory. Use /inventory to open it.',
            image: { url: `attachment://${CRATE_ART.name}` },
        })],
    };
}
