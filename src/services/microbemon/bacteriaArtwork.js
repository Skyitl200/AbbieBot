import { PNG } from 'pngjs';
import { BACTERIA } from './bacteria.js';

const portraits = new Map();
// Small original schematic portraits. Colors are fictional, not Gram-stain results.
export function bacteriaArtwork(id, shiny = false) {
    const index = BACTERIA.findIndex(species => species.id === id);
    if (index < 0) return null;
    const species = BACTERIA[index];
    const name = `${id}${shiny ? '-shiny' : ''}.png`;
    if (portraits.has(name)) return { name, buffer: portraits.get(name) };
    const png = new PNG({ width: 360, height: 240 });
    const hue = (index * 47 + (shiny ? 173 : 0)) % 360;
    const rgb = [0, 120, 240].map(offset => Math.round(145 + 90 * Math.cos((hue + offset) * Math.PI / 180)));
    const ellipse = (cx, cy, rx, ry, color) => {
        for (let y = Math.max(0, cy - ry); y <= Math.min(239, cy + ry); y++) for (let x = Math.max(0, cx - rx); x <= Math.min(359, cx + rx); x++) {
            if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
            const i = (y * png.width + x) * 4;
            png.data.set([...color, 255], i);
        }
    };
    for (let y = 0; y < 240; y++) for (let x = 0; x < 360; x++) {
        const glow = Math.max(0, 1 - Math.hypot((x - 180) / 220, (y - 120) / 170));
        png.data.set([12 + glow * 14, 23 + glow * 22, 38 + glow * 25, 255], (y * 360 + x) * 4);
    }
    for (let n = 0; n < 10; n++) ellipse(20 + (n * 79 + index * 11) % 320, 15 + (n * 43) % 210, 2, 2, [75, 106, 126]);
    if (!species.shape) {
        // An abstract roster badge avoids inventing morphology for an uncertain name.
        ellipse(180, 120, 66, 66, [27, 47, 63]);
        ellipse(180, 103, 20, 25, rgb);
        ellipse(180, 100, 10, 15, [27, 47, 63]);
        ellipse(187, 125, 7, 15, rgb);
        ellipse(187, 155, 7, 7, rgb);
    } else {
        const rx = species.shape === 'rod' ? 104 : 65;
        ellipse(180, 130, rx + 6, 61, [6, 16, 26]);
        ellipse(180, 121, rx, 55, rgb.map(channel => Math.round(channel * 0.6)));
        ellipse(180, 114, rx - 5, 49, rgb);
        ellipse(157, 90, 24, 9, rgb.map(channel => Math.min(255, channel + 55)));
        // Mascot facial marks are decorative; they are not organelles or a nucleus.
        ellipse(158, 116, 6, 8, [16, 29, 42]); ellipse(201, 116, 6, 8, [16, 29, 42]);
        ellipse(180, 139, 14, 7, [16, 29, 42]); ellipse(180, 135, 14, 5, rgb);
    }
    if (shiny) {
        for (let d = -10; d <= 10; d++) {
            ellipse(295 + d, 42, 1, 1, [255, 230, 140]);
            ellipse(295, 42 + d, 1, 1, [255, 230, 140]);
        }
    }
    const buffer = PNG.sync.write(png);
    portraits.set(name, buffer);
    return { name, buffer };
}
