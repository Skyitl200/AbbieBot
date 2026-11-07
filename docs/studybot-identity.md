# StudyBot identity

The bot uses the StudyBot username and embed branding. On Discord ClientReady,
it changes its account username only if different, and replaces server nicknames
matching AbbieBot, Abbie Bot, TitanBot or Titan Bot. Other custom nicknames are
preserved. Rename failures are logged and do not stop the bot from starting.

Discord username changes are rate-limited; a failed attempt is retried on the
next startup. The application title in the Discord Developer Portal is separate
and may still need to be changed by the application owner.

Existing repository URLs, database names and payment callback URLs stay valid.
