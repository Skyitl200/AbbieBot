import { shinyAnimationPath } from './shinyAnimation.js';
import { fileURLToPath } from 'node:url';
import { PORTRAITS, portraitPath } from './portraits.js';
import { logger } from '../../utils/logger.js';

const origin = (process.env.PUBLIC_BASE_URL || 'https://abbiebot-production-35d6.up.railway.app').replace(/\/+$/, '');
export const artworkURL = name => `${origin}/microbemon/art/${encodeURIComponent(name)}?v=4`;
export function hostedSpeciesArtwork(id, shiny = false) {
    if (!Object.hasOwn(PORTRAITS, id)) return null;
    const name = shiny ? `${id}-shiny.gif` : `${id}.png`;
    return { name, url: artworkURL(name) };
}

// Only approved public artwork is exposed. No profile data or arbitrary paths.
export function registerMicrobemonArtwork(app) {
    app.get('/microbemon/art/:file', (req, res) => {
        const name = req.params.file;
        let path;
        if (name === 'microbemon-home.png') {
            path = fileURLToPath(new URL('../../assets/microbemon/home.png', import.meta.url));
        } else {
            const match = /^([a-z]+)(-shiny)?\.(png|gif)$/.exec(name);
            if (!match || !Object.hasOwn(PORTRAITS, match[1]) || (match[3] === 'gif' && !match[2])) return res.sendStatus(404);
            try { path = match[3] === 'gif' ? shinyAnimationPath(match[1]) : portraitPath(match[1], Boolean(match[2])); }
            catch (error) {
                logger.warn(`Microbemon public artwork failed (${name}): ${error.message}`);
                return res.sendStatus(503);
            }
        }
        res.set('Cache-Control', 'public, max-age=86400');
        return res.sendFile(path, error => {
            if (error && !res.headersSent) res.sendStatus(404);
        });
    });
}

