# Purple boost announcements

Run `/boosts setup channel:#general` once as a member with **Manage Server**.
This saves the exact destination; the bot does not guess which channel is general.
Use `/boosts preview` for a private sample, `/boosts status` for configuration, and
`/boosts disable` to stop announcements and the associated XP bonus. These are
server-specific slash commands, preserving the existing global command allowance.

New Discord boost system messages (ordinary boosts and tier 1–3 notices) trigger
one public announcement in the chosen channel. Repeat boosts by the same member
are included because receipts identify events, not members or role changes.
The card has the real booster name/avatar, purple accent, winged crystal badge,
eight approved perk descriptions, and Boost Now link. It omits the camera perk.
The potion and equalizer use original generated application emoji, reused across
servers without consuming guild emoji slots; standard emoji serve as fallbacks
if application emoji creation is unavailable. Other icons use Discord's native
emoji rendering. The packaged badge and small emoji assets are optimized exports
of the generated transparent artwork.

Boost Now opens the correct server at `https://discord.com/channels/GUILD_ID`.
The footer explains **Server menu → Server Boost**. It does not use an invented
checkout/deep-link route or an outside payment site. Discord controls link-button
styling; the real button follows Discord's theme rather than the mockup's custom
purple gradient.

## Discord setup requirements

The bot needs **View Channel, Send Messages, Embed Links, Attach Files** in general,
and **View Channel** in the server's system-message channel. Existing Guild Messages
and Guild Members gateway intents are already enabled in this bot.

Discord's **server boost system messages must be enabled** to detect every repeat
boost. If necessary, setup enables only that notification flag with the bot's
Manage Server permission. Other system-message flags remain unchanged. An existing
system-message channel is retained. If none exists, setup assigns general as that
channel, which also becomes the destination for any other enabled native system
notifications. If the bot cannot change settings, an administrator must enable
boost notices manually and rerun setup. Discord's own native boost notice may
appear alongside this announcement; this feature does not delete it.

Boosts that occur while the bot is offline, or while boost system messages are
disabled, cannot be reliably reconstructed from a member's booster-role change.
This implementation handles newly received events and does not replay historical
boosts on startup.

## XP and server permissions

Setup enables **20% extra message XP** for members with an active Discord boost,
when this bot's existing leveling is enabled. The bonus is applied once after any
existing server XP multiplier, rounded down, with the existing message cooldown
and exclusions intact. It does not affect Merit Coins or Subscriber benefits.

The announcement is not a blanket permission grant. Custom roles, external
stickers, lounge voice messages, soundboard, streaming, and command access must
match the server's actual booster-role/channel policy. No role hierarchy or
channel permission overwrites are changed by this feature. Leaderboard recognition
uses the existing leveling system; no separate paid leaderboard is created.

## Reliability and verification

PostgreSQL delivery receipts and transaction advisory locks prevent concurrent or
replayed events from posting again across workers/restarts. Sends also carry the
boost event ID as a Discord nonce with enforcement enabled. The local mutex and
existing key/value storage cover deployments without a PostgreSQL pool; memory
storage does not retain receipts across restarts. Temporary Discord/network failures retry up to three times with a stable nonce.
Failed delivery never writes a success receipt; a final error is logged and the
same event can be retried. Like any
Discord integration, exactly-once delivery across a prolonged API/database outage
cannot be guaranteed.

`npm run test:boosts` tests first/repeat/tier boosts, duplicate suppression,
persistent receipts, private previews, channel permissions, notification setup,
emoji reuse, and XP eligibility. Tests mock Discord sends and do not post to a
real server. No credentials or live deployment are available in this workspace.
