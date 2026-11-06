# TitanBot - Ultimate Discord Bot

**TitanBot** is a powerful, feature-rich Discord bot designed to enhance your server experience with comprehensive moderation tools, engaging economy systems, utility features, and much more. Built with modern Discord.js v14 and PostgreSQL for optimal performance and data persistence.

[![Support Server](https://img.shields.io/badge/-Support%20Server-%235865F2?logo=discord&logoColor=white&style=flat-square&logoWidth=20)](https://discord.gg/8kJBYhTGW9)
[![Discord.js](https://img.shields.io/npm/v/discord.js?style=flat-square&labelColor=%23202225&color=%23202225&logo=npm&logoColor=white&logoWidth=20)](https://www.npmjs.com/package/discord.js)
![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-%23336791?logo=postgresql&logoColor=white&style=flat-square&logoWidth=20)

## Table of Contents

- [Features Overview](#features-overview)
- [Quick Setup](#quick-setup)
- [Manual Installation Steps](#manual-installation-steps)
- [Support Server](https://discord.gg/QnWNz2dKCE)
- [Required Bot Intents](#bot-intents)
- [Contributing](CONTRIBUTING.md)

<a name="features-overview"></a>
## Features Overview

TitanBot offers a complete suite of tools for Discord server management and community engagement:

<table>
<tr>
<td width="50%" valign="top">

### Moderation & Administration
- **Mass Actions** - Bulk ban/kick capabilities
- **User Notes** - Keep detailed moderation records
- **Case Management** - View and track all mod actions

### Economy System
- **Shop & Inventory** - Buy and manage items
- **Gambling** - Risk it for rewards
- **Pay System** - Transfer money between users

### Fun & Entertainment
- **Random Facts** - Learn something new
- **Wanted Poster** - Create fun wanted images
- **Text Reversal** - Reverse any text

### Advanced Ticket System
- **Claim & Priority** - Staff ticket management
- **Ticket Limits** - Prevent spam
- **Transcript System** - Save ticket history

### Server Stats
- **Member Counter** - Live member count channels
- **Voice Counters** - Track voice stats
- **Dynamic Updates** - Real-time channel updates

### Reaction Roles
- **Role Assignment** - Self-assignable roles
- **Emoji Selection** - Reaction-based system
- **Multi-role Support** - Multiple role options

</td>
<td width="50%" valign="top">

### Leveling & XP System
- **XP Tracking** - Automatic message-based XP
- **Level Roles** - Auto-assign roles by level
- **Custom Configuration** - Personalize leveling

### Giveaways & Events
- **Multiple Winners** - Support multi-winner giveaways
- **Auto Picking** - Automatic winner selection
- **Reroll System** - Pick new winners if needed

### Birthday System
- **Birthday Tracking** - Never miss a birthday
- **Auto Announcements** - Celebrate automatically
- **Timezone Support** - Accurate worldwide tracking

### Utility Tools
- **Report System** - Report issues to staff
- **Todo Lists** - Personal task management
- **First Message** - Jump to channel's first message

### Welcome System
- **Welcome Messages** - Greet new members
- **Auto Roles** - Assign roles on join
- **Custom Embeds** - Personalized messages
  
### Music
- **24/7 Mode** - Play music 24/7
- **Interative Button System** - Manage music through buttons
- **Supports EVERY platform** - Supports spotify, deezer, youtube, apple music
  
</td>
</tr>
</table>

<a name="quick-setup"></a>
## Quick Setup (Recommended for non-coders)

### Video Tutorial
For a detailed step-by-step setup guide, watch our comprehensive video tutorial:
[**TitanBot Setup Tutorial**](https://www.youtube.com/@TouchDisc)

## Docker Deployment (Recommended)

TitanBot is fully containerized for easy deployment.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/codebymitch/TitanBot.git
   cd TitanBot
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Set at minimum `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`. Docker Compose also reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from `.env` (defaults: `titanbot` / `password` / `titanbot`).

3. **Build and start the containers:**
   ```bash
   docker compose up -d --build
   ```

4. **Check status:**
   ```bash
   docker compose ps
   curl http://localhost:3000/health
   ```

This starts the bot and PostgreSQL. The compose file sets `POSTGRES_SSL=false` and `AUTO_MIGRATE=true` for the bundled database. Music uses public Lavalink v4 nodes from `lavalink/nodes.json` by default.

### Music

Music uses [Lavalink v4](https://github.com/lavalink-devs/Lavalink) via [Riffy](https://github.com/riffy-rb/riffy), similar to [Musicify](https://github.com/codebymitch/Musicify).

1. By default, the bot loads multiple public v4 SSL nodes from [`lavalink/nodes.json`](lavalink/nodes.json) (sourced from [lavalink.darrennathanael.com](https://lavalink.darrennathanael.com/SSL/Lavalink-SSL/)). Edit that file to add or remove nodes.
2. To self-host Lavalink instead, run `docker compose --profile local-lavalink up -d` and set single-node env vars in `.env`:
   ```env
   LAVALINK_HOST=lavalink
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   ```
   Remove or rename `lavalink/nodes.json` so the bot falls back to those env vars.
3. Override nodes inline with `LAVALINK_NODES` (JSON array) or point at another file with `LAVALINK_NODES_FILE`.
4. Use `/play <song>` from a voice channel, or `/join` to connect without playing. Prefix shortcuts: `join`, `np`, `leave`, `pause`, `resume`, `skip`, `stop`, `volume <0-100>`, or `music <subcommand>`. Use `/nowplaying` and `/queue` for status; `/music` for loop, shuffle, seek, and other controls.

### Using GitHub Container Registry

The bot is automatically published to GitHub Container Registry on every push to main.

```bash
docker pull ghcr.io/codebymitch/titanbot:main
```

<a name="manual-installation-steps"></a>
## Manual Installation Steps

### Prerequisites
- Node.js 20.10.0 or higher
- PostgreSQL server (recommended) or memory storage fallback
- Discord bot application with proper intents

1. **Clone the Repository**
   ```bash
   git clone https://github.com/codebymitch/TitanBot.git
   cd TitanBot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration (only the following variables require configuration, leave remaining variables as default):
   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_client_id_here
   GUILD_ID=your_discord_guild_id_here

   # PostgreSQL Configuration (Primary Database)
   POSTGRES_URL=postgresql://postgres:yourpassword@localhost:5432/titanbot
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=titanbot
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=yourpassword
   ```

   Production note:
   - `NODE_ENV=production`
   - `LOG_LEVEL=warn` for a clean production console (critical issues + startup status)
   - `LOG_LEVEL=info` if you want more detailed operational logs
   - If your chosen `PORT` is already used, TitanBot automatically tries the next port(s)

   Environment options reference:
   - `NODE_ENV`: `development`, `production`, `test` (any non-`production` value is treated as non-production)
   - `LOG_LEVEL`: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`
   - Accepted aliases for `LOG_LEVEL` in this bot: `warns`, `warning`, `warnings` → `warn`

   Recommended production `.env` (easy mode + default mode):
   ```env
   NODE_ENV=production
   LOG_LEVEL=warn
   WEB_HOST=0.0.0.0
   PORT=3000
   PORT_RETRY_ATTEMPTS=5
   ```
   This gives clear startup/online status messages while keeping logs simple for non-technical operators.
   If port `3000` is busy, the bot tries the next available ports automatically (up to `PORT_RETRY_ATTEMPTS`).

### Multiple servers

Slash commands are registered **globally** on startup (via `CLIENT_ID`), so the bot works in every server it is invited to. `GUILD_ID` stays in the tutorial `.env` for setup steps but is not used for command registration.

Notes:
- Global slash commands may take up to about an hour to propagate on first deploy
- Each server has **isolated** data: config, economy, tickets, leveling, dashboards, warnings, etc. (all keys are scoped as `guild:{guildId}:...`)
- In the [Discord Developer Portal](https://discord.com/developers/applications), ensure your bot is not restricted to a single guild if you plan to invite it elsewhere
- Generate an OAuth2 invite URL from the [Discord Developer Portal](https://discord.com/developers/applications) (OAuth2 → URL Generator, scopes: `bot` and `applications.commands`)

4. **Setup PostgreSQL Database** (Optional but recommended)
   ```bash
   # Create database and user
   createdb titanbot
   createuser titanbot
   psql -c "ALTER USER titanbot PASSWORD 'yourpassword';"
   psql -c "GRANT ALL PRIVILEGES ON DATABASE titanbot TO titanbot;"
   ```

5. **Verify Database Setup**
   ```bash
   npm run migrate:check
   ```

6. **Start the Bot**
   ```bash
   npm start
   ```

> **Note on database migrations:** Schema tables and legacy key migrations run
> **automatically on startup**, so` managed hosts like **Railway** need no manual
> migration step — just deploy/restart. To disable auto-migration set
> `AUTO_MIGRATE=false`. You can still run a manual key migration locally with
> `node scripts/migrate-keys.js --dry-run` (preview) or `node scripts/migrate-keys.js`.
<a name="bot-intents"></a>

## Required Bot Intents
TitanBot requires the following Discord intents:
- **Guilds**
- **Guild Messages**
- **Message Content**
- **Guild Members**
- **Guild Message Reactions**
- **Guild Voice States**
- **Direct Messages**
- **Bot**
- **Applications.commands**

### Required Permissions
- **View Channels**
- **Send Messages**
- **Embed Links**
- **Attach Files**
- **Read Message History**
- **Manage Messages**
- **Manage Channels**
- **Manage Roles**
- **Kick Members**
- **Manage Messages**
- **Ban Members**
- **Moderate Members**
- **Connect**

## License

TitanBot is released under the MIT License. See [LICENSE](LICENSE) for details.

## Thank You

Thank you for choosing TitanBot for your Discord server! We're constantly working to improve and add new features based on community feedback.

*Last updated: May 2026*


### Study Sanctuary rules preset

Moderators with Manage Messages can run `/embedbuilder template:study-rules` to
open the six-rule academic community template as a private, editable teal embed.
Choose **Post Embed**, then select the rules channel. The bot needs Send Messages
and Embed Links in that channel. The template does not post automatically or
edit/delete an existing rules message. Keep or remove the old message separately
as appropriate. Discord controls the embed background; the template customizes
the accent color, headings, spacing, and emojis. Custom embed previews preserve
moderator-entered emojis, footers, and optional timestamps. Run `npm run test:rules` to verify
the preview and posting flow.

### Microbemon

Run `/microbemon` inside a server, then choose **Explore**.
Use `/microbemon` to play; the old `/test microbemon` option has been removed. `/test` keeps setup and feedback private while posting questions and their figures publicly; only the initiating student can answer.
After a successful catch is saved, the public card opens the **Microbedeck** on
the newly caught pet, with its portrait, shiny status, level, habitat, basic
facts, and nickname/companion controls. The Microbedeck button reopens the saved
collection at any time. The standalone command is registered per server at startup using Discord's
separate server-command allowance, preserving all 100 existing global commands.
Registration upserts only `/microbemon`; it does not replace unrelated server
commands. Restart after joining a new server to register the command there.
Normal `/test` study sessions are unchanged. The first version has 19 organisms
from the lab notes, easy study battles, three free capture attempts per encounter,
collection browsing, nicknames, and a favorite companion. Each successful catch awards
5–30 Merit Coins and displays the new wallet balance; correct `/test` answers use
the same range. Higher amounts have higher odds (weight = amount minus 4).
Catch rewards and pets commit together, and quiz reward retries preserve the original
amount without awarding twice. Microbemon does not spend Merit Coins. Every organism has a standalone portrait in its own habitat or life-cycle
setting, plus a separate shiny portrait. The same species/variant appears in
encounters and collections. Parasite environment labels distinguish outdoor
transmission scenes from the adult host habitat. These are original stylized
characters, not diagnostic microscopy images. Sessions are public in the channel;
only the player who started the session controls battles, catches, and pet names.

Rarity tiers share total encounter weights of 55% common, 30% uncommon, 12% rare,
and 3% epic, divided uniformly among each tier's organisms. Every encounter has
an independent 1/1,000 shiny roll. Shiny status is cosmetic and has the same
capture rules. Explore has a 30-second cooldown; encounters expire after 15
minutes. Collections hold up to 240 captured pets in 20 boxes of 12, including duplicates.

The existing PostgreSQL `temp_data` table stores one namespaced, non-expiring
profile per server/member. A database transaction with a per-profile advisory
lock commits the encounter and collection together. Stale buttons and repeated
catch requests cannot award a second pet. Persistent PostgreSQL is required;
the game refuses volatile in-memory fallback. No migration or Discord token is
needed for `npm run test:microbemon`; the persistence tests use a transaction
adapter, not a live database. Production connection and Discord behavior still
need live verification after deployment. The bot needs Embed Links and Attach
Files to show the artwork.

Scientific corrections include Ascaris versus pinworm life cycles, Giardia as a
flagellated protist, Toxoplasma tissue cysts, and the intestinal fluke name
Fasciolopsis buski. Game rarity is not real-world prevalence or medical severity.

Microbemon battle questions now use 70 original questions based on the supplied
`Chapter 12 (1).pptx` lecture outline (Nester, 10th edition), with slide references
stored on each question. Each species receives 7–17 applicable questions across
movement, nutrition, host cells, appearance, transmission, disease, and life
cycles. Shared group facts are used where the slides do not discuss a species
individually. Questions shuffle their choices and do not repeat within an
encounter until the available pool is exhausted; feedback uses the selected
question's explanation. Existing in-progress questions remain answerable.
The uploaded full textbook PDF was not accessible; these new questions are
verified against the lecture slides, not claimed to come from reading that PDF.

The **Microbedeck** button opens a storage-box overview of owned pets, with 12
numbered portraits per box, shiny highlights, companion markers, owned/species
counts, and an owned-pet dropdown. Previous/Next Box browses larger collections;
selecting a pet opens its existing detail/nickname/companion card. The
**Microbemon** navigation button returns to the game or active encounter. Older
Microbedeck buttons are supported. If another player clicks a deck or game
navigation button on a public card, they open their own session rather than
changing the original player's collection. Battle and pet-edit controls remain
owner-only. The renderer uses `pngjs` and bounded small-thumbnail caching; no
Discord credentials or external image service is needed to build a box preview.

### Microbemon teams, leveling, and storage

All 20 boxes are available, including empty boxes; the box dropdown jumps directly
to a page. New catches stop at 240 owned pets. Previously saved pets are never
deleted to enforce the new capacity; any legacy overflow remains viewable.
Full storage still allows study battles, but catching requires a free slot.

Choose a favorite companion in Microbedeck to set the default battler for the
next encounter. During an encounter, **Switch Microbemon** opens your owned-pet
picker. Each pet keeps its remaining HP for that encounter, including when
switched out and back in. Fainted pets cannot be selected. A fresh encounter
restores the team to full health. Until the first catch, a researcher study kit
lets a new player battle and catch their first pet.

Base HP is 100 at level 1 and increases by 10 per level. Wild HP scales with its
level too. Correct-answer damage is 25 + 3 × (ally level − 1); an incorrect answer
allows wild damage of 20 + 2 × (wild level − 1). The active pet gains 20 XP for a
correct answer and 40 XP for a successful catch. Other pets receive no passive
XP. The next level costs 50 + 25 × (current level − 1) XP, carrying surplus XP
forward, up to level 100. Level-ups increase max HP (and current HP by the
increase) and strengthen future attacks. Shinies have identical battle rules.
These gains share the same atomic profile transaction as the answered question
or catch; retries cannot grant extra XP. Existing pet levels are retained and
start with zero XP; existing encounter HP percentages are preserved on upgrade.

Use **Release** on a pet's detail card, then confirm **Release permanently**
within 60 seconds. This removes only that pet and its XP. Cancel keeps it. The
current active battler cannot be released during a live encounter; switch first.
Release confirmations are bound to the player and pet, expire, and are single-use.
The original habitat artwork is retained; the proposed flat 2D redraw was cancelled.

### Anatomy Lab model practice

`/test` → **Anatomy Lab** → **Reproductive System** → select one or more
**Early Development Models** → **Multiple choice** or **Type in answer**.
Eight models are configured, including the 16-cell stage. This authored section
works without saved database questions; **Other saved lab categories** retains
access to existing lab quizzes. Typed mode accepts curated biological synonyms.
Questions use the same public-card, owner-only answer controls and Merit Coin rewards.

Original photographs have not yet been installed: names, locations, and process
questions are available now, and the model picker states this limitation.
Photo-dependent identification questions are excluded until the matching original
image is present. Place the eight user-supplied photos in `study-assets/lab-models/`
using each `expectedImageFile` from `study-data/lab-models/early-development.json`.
They will appear inline automatically, enabling their identification questions.
Do not substitute generated images for the user's physical models.
