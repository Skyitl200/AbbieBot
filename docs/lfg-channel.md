# LFG channel restriction

`/lfg` and every creation step (subject, program, description, capacity and
publication) run only in the user-designated text channel **1553916775928959049**.
The ID is pinned in `src/services/lfg/channelAccess.js`; channel renames, fancy
letters, duplicate names and incomplete channel caches cannot change access.

Elsewhere, users receive a private reply:
“You can only use the /lfg command in the LFG text channel.”

The check runs before quota usage, setup state changes, room changes or posts.
Subscribers follow the same rule. Threads have different IDs and are not allowed.
Existing Join Study Room links stay functional. No LFG_CHANNEL_ID environment
variable is required; the exact channel ID comes from the server owner.
