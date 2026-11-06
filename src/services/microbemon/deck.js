import { PNG } from 'pngjs';
import { readFile } from 'node:fs/promises';
import { speciesArtwork } from './artwork.js';
import { speciesById } from './catalog.js';

export const BOX_SIZE = 12;
export function deckPage(profile, requested = 0) {
    const pages = Math.max(1, Math.ceil(profile.pets.length / BOX_SIZE));
    const page = Math.max(0, Math.min(Math.floor(Number(requested)) || 0, pages - 1));
    return { page, pages, start: page * BOX_SIZE, pets: profile.pets.slice(page * BOX_SIZE, (page + 1) * BOX_SIZE) };
}
const thumbnails = new Map();
const W = 180, H = 120;
async function thumbnail(pet) {
    const key = `${pet.speciesId}:${Boolean(pet.shiny)}`;
    if (thumbnails.has(key)) return thumbnails.get(key);
    const asset = speciesArtwork(pet.speciesId, pet.shiny);
    if (!asset) throw new Error('Unknown pet portrait');
    const source = PNG.sync.read(await readFile(asset.path));
    const result = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const src = (Math.floor(y * source.height / H) * source.width + Math.floor(x * source.width / W)) * 4;
        source.data.copy(result, (y * W + x) * 4, src, src + 4);
    }
    // Cache only small thumbnails, not full-size decoded portraits.
    if (thumbnails.size >= 38) thumbnails.delete(thumbnails.keys().next().value);
    thumbnails.set(key, result);
    return result;
}
const FONT = {
    '0':'01110/10001/10011/10101/11001/10001/01110', '1':'00100/01100/00100/00100/00100/00100/01110',
    '2':'01110/10001/00001/00010/00100/01000/11111', '3':'11110/00001/00001/01110/00001/00001/11110',
    '4':'00010/00110/01010/10010/11111/00010/00010', '5':'11111/10000/10000/11110/00001/00001/11110',
    '6':'01110/10000/10000/11110/10001/10001/01110', '7':'11111/00001/00010/00100/01000/01000/01000',
    '8':'01110/10001/10001/01110/10001/10001/01110', '9':'01110/10001/10001/01111/00001/00001/01110',
    A:'01110/10001/10001/11111/10001/10001/10001', B:'11110/10001/10001/11110/10001/10001/11110',
    C:'01111/10000/10000/10000/10000/10000/01111', D:'11110/10001/10001/10001/10001/10001/11110',
    E:'11111/10000/10000/11110/10000/10000/11111', F:'11111/10000/10000/11110/10000/10000/10000',
    G:'01111/10000/10000/10111/10001/10001/01111', H:'10001/10001/10001/11111/10001/10001/10001',
    I:'01110/00100/00100/00100/00100/00100/01110', J:'00111/00010/00010/00010/00010/10010/01100',
    K:'10001/10010/10100/11000/10100/10010/10001', L:'10000/10000/10000/10000/10000/10000/11111',
    M:'10001/11011/10101/10101/10001/10001/10001', N:'10001/11001/10101/10011/10001/10001/10001',
    O:'01110/10001/10001/10001/10001/10001/01110', P:'11110/10001/10001/11110/10000/10000/10000',
    Q:'01110/10001/10001/10001/10101/10010/01101', R:'11110/10001/10001/11110/10100/10010/10001',
    S:'01111/10000/10000/01110/00001/00001/11110', T:'11111/00100/00100/00100/00100/00100/00100',
    U:'10001/10001/10001/10001/10001/10001/01110', V:'10001/10001/10001/10001/10001/10001/01010',
    W:'10001/10001/10001/10101/10101/10101/01010', X:'10001/10001/01010/00100/01010/10001/10001',
    Y:'10001/10001/01010/00100/00100/00100/00100', Z:'11111/00001/00010/00100/01000/10000/11111',
    '*':'00000/10101/01110/11111/01110/10101/00000', '-':'00000/00000/00000/11111/00000/00000/00000'
};
function rect(png, x, y, w, h, color) {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
        const offset = (row * png.width + col) * 4;
        png.data[offset] = color[0]; png.data[offset + 1] = color[1]; png.data[offset + 2] = color[2]; png.data[offset + 3] = 255;
    }
}
function text(png, label, x, y, color, scale = 2) {
    for (const char of label.toUpperCase()) {
        const glyph = FONT[char]?.split('/');
        if (glyph) for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) if (glyph[gy][gx] === '1') rect(png, x + gx * scale, y + gy * scale, scale, scale, color);
        x += 6 * scale;
    }
}
export async function renderDeckGrid(profile, requested = 0) {
    const { pets, start } = deckPage(profile, requested);
    const png = new PNG({ width: 804, height: 552 });
    rect(png, 0, 0, png.width, png.height, [12, 22, 30]);
    const images = [];
    for (const pet of pets) images.push(await thumbnail(pet));
    for (let i = 0; i < BOX_SIZE; i++) {
        const x = 10 + i % 4 * 196, y = 10 + Math.floor(i / 4) * 180;
        const pet = pets[i];
        const border = pet?.shiny ? [245, 199, 75] : [45, 180, 165];
        rect(png, x, y, 192, 172, pet ? border : [30, 48, 58]);
        rect(png, x + 3, y + 3, 186, 166, [22, 37, 47]);
        if (!pet) { text(png, 'EMPTY', x + 42, y + 75, [62, 81, 90]); continue; }
        for (let row = 0; row < H; row++) images[i].copy(png.data, ((y + 6 + row) * png.width + x + 6) * 4, row * W * 4, (row + 1) * W * 4);
        text(png, `${start + i + 1}${pet.shiny ? ' *' : ''}`, x + 8, y + 130, border);
        text(png, speciesById(pet.speciesId).common.slice(0, 29), x + 8, y + 151, [218, 235, 237], 1);
        if (profile.companion === pet.id) {
            rect(png, x + 137, y + 10, 44, 19, [12, 34, 38]);
            text(png, 'FAV', x + 141, y + 13, [106, 245, 204]);
        }
    }
    return PNG.sync.write(png);
}
