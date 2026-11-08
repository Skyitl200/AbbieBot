# LFG channel restriction

`/lfg` and every creation step (subject, program, description, capacity and
publication) run only in the designated LFG text channel. Attempts elsewhere
receive a private redirect before quota usage, setup state, room changes or posts.
Subscribers follow the same channel rule.

Set `LFG_CHANNEL_ID` to pin the allowed channel. Otherwise StudyBot finds exactly
one server text channel named `lfg` or `looking-for-group`, ignoring case,
separators and emoji decorations. Missing or multiple matching channels block
creation until the channel is unambiguous or its ID is configured. Threads and
voice channels are not accepted. Existing Join Study Room links stay functional.
