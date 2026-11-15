// Package the approved normal/shiny sheet regions as individual Discord portraits.
// The bounded disk cache avoids decoding full sheets for every interaction.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../../assets/microbemon/sheets/', import.meta.url);
export const PORTRAITS = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')).species;
let directory;
let decodedSheet;
let decodedNumber;
const cached = new Map();
export function portraitPath(id, shiny = false) {
    const entry = PORTRAITS[id];
    if (!entry) return null;
    const key = `${id}${shiny ? '-shiny' : ''}`;
    if (cached.has(key)) return cached.get(key);
    if (!directory) directory = mkdtempSync(join(tmpdir(), 'microbemon-v2-'));
    if (decodedNumber !== entry.sheet) {
        decodedSheet = PNG.sync.read(readFileSync(new URL(`sheet-${entry.sheet}.png`, root)));
        decodedNumber = entry.sheet;
    }
    const rect = shiny ? entry.shiny : entry.normal;
    if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > decodedSheet.width || rect.y + rect.height > decodedSheet.height) throw new Error(`Invalid portrait region: ${key}`);
    const output = new PNG({ width: rect.width, height: rect.height });
    PNG.bitblt(decodedSheet, output, rect.x, rect.y, rect.width, rect.height, 0, 0);
    const path = join(directory, `${key}.png`);
    writeFileSync(path, PNG.sync.write(output));
    cached.set(key, path);
    return path;
}
