# Study command allowance

The registered study command is `/test`; the legacy `/quiz` module is not registered.
Non-subscribers can start `/test` 50 times in a rolling 24-hour window. One command
invocation counts once, regardless of how many questions are answered. The 51st
invocation returns a private message showing when the oldest use expires.

The Subscriber role bypasses the allowance. Its ID comes from `SUBSCRIBER_ROLE_ID`,
falling back to the existing Subscriber role ID `1552123365760831488`. Guild member
roles are refreshed when available; Sponsor status is not a subscription bypass.
DMs have no guild Subscriber role and use the free allowance.

Usage is stored in PostgreSQL `temp_data` under `quiz:usage:<user ID>`, shared across
channels, guilds, and DMs. An advisory transaction lock protects concurrent first
uses, and interaction IDs prevent duplicate delivery from consuming two uses.
Each record expires after 24 hours. Database outages return a private retry message
instead of silently resetting usage or granting unlimited use. Opening a quiz menu
counts even if the user subsequently abandons the quiz.

Run `node --test tests/study-usage-limit.test.js` for quota and command checks.
