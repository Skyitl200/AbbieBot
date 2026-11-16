import gifenc from 'gifenc';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { portraitPath } from './portraits.js';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const paths = new Map();
let glints;
export const SHINY_FRAMES = 18;
export function shinyAnimationPath(id) {
    if (paths.has(id)) return paths.get(id);
    const path = portraitPath(id, true);
    if (!path) return null;
    const base = PNG.sync.read(readFileSync(path));
    glints ||= PNG.sync.read(readFileSync(new URL('../../assets/microbemon/shiny-glints.png', import.meta.url)));
    const palette = [...quantize(base.data, 252), [255, 255, 255], [255, 246, 199], [230, 215, 255], [248, 252, 255]];
    const particles = [];
    for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
        const gx = Math.floor(x * glints.width / base.width), gy = Math.floor(y * glints.height / base.height);
        const src = (gy * glints.width + gx) * 4;
        if (glints.data[src + 3]) particles.push({ offset: (y * base.width + x) * 4,
            alpha: glints.data[src + 3] / 255, phase: gx * 0.014 + gy * 0.011,
            rgb: [glints.data[src], glints.data[src + 1], glints.data[src + 2]] });
    }
    const gif = GIFEncoder();
    for (let frame = 0; frame < SHINY_FRAMES; frame++) {
        const rgba = Buffer.from(base.data);
        const time = frame / SHINY_FRAMES * Math.PI * 2;
        for (const p of particles) {
            const alpha = p.alpha * Math.pow((1 + Math.sin(time + p.phase)) / 2, 3) * 0.95;
            for (let c = 0; c < 3; c++) rgba[p.offset + c] = Math.round(base.data[p.offset + c] * (1 - alpha) + p.rgb[c] * alpha);
        }
        gif.writeFrame(applyPalette(rgba, palette), base.width, base.height,
            { palette: frame === 0 ? palette : undefined, delay: 160, repeat: 0 });
    }
    gif.finish();
    const output = path.replace(/\.png$/, '.gif');
    writeFileSync(output, gif.bytes());
    paths.set(id, output);
    return output;
}
