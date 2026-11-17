# Study-time leaderboard

Use `/studytime` to open the monthly server leaderboard. The buttons switch between this month, all time, and personal statistics. `/studytime view:stats` shows the member's tier, next tier, leaderboard rank, tier rank, time until promotion, and source breakdown. Use `member` to inspect another member or `period:all` for all-time statistics. Rankings show ten people per page.

Tracking starts when this feature is deployed. It does not invent historical study time. Each server has independent records.

## Credit rules

- Voice: real connected time in any voice or stage channel, excluding bots and the server's AFK channel. Muted, deafened, and solo study sessions count. Moving between channels continues the session. Time is checkpointed every minute and settled on leave; live totals include the current interval.
- Microbemon: 30 seconds per successful, owner-authorized interaction saved by the game, including opening the game and collection navigation. Invalid, stale, or unauthorized actions earn nothing. Opening a rename modal alone earns nothing; submitting the rename does. A display retry never repeats credit.
- `/test`: 30 seconds per answered question, correct or incorrect, across classes, chapters, and question types. Skipping, previewing, ordering individual options, and clicking Next do not add credit. Reward retries reuse the question receipt.
- Resources: 20 seconds per Open resource click on a tracked resource card. Deliveries with the same Discord interaction ID count once. Different clicks are separate credits.

These are additive study-credit estimates: game, question, and resource bonuses also apply while a member is in voice. They are not a claim that the member spent that exact duration watching or studying.

## Future videos and links

Members with Manage Server permission can publish a tracked card with `/studytime view:resource title:<title> url:<https URL>`. The public Open resource button credits the clicking member and replies privately with the destination link. The exported `createStudyResourceMessage` helper can be reused by future video/resource posting features. Only HTTPS destinations are allowed.

Discord does not notify bots when someone clicks an ordinary URL, a normal link button, or watches an uploaded video. Those clicks cannot be credited retroactively. Post the tracked resource card alongside a video or use its shareable HTTPS link.

## Monthly tiers

| Tier | Hours required |
| --- | ---: |
| Fresh Scholar | 0 |
| Budding Bookworm | 1 |
| Page Turner | 3 |
| Focus Pro | 6 |
| Knowledge Builder | 10 |
| Exam Expert | 20 |
| A+ Scholar | 40 |
| Master | 60 |
| Grandmaster | 80 |
| Study Sage | 140 |
| Mythic Mind | 200 |

Tiers are shown in the stats card; the feature does not create or assign Discord roles. Month boundaries use America/New_York, including daylight-saving changes. Monthly views reset automatically at the next calendar month while past months and all-time totals remain saved.

## Persistence and recovery

Uses the existing PostgreSQL `temp_data` table, with non-expiring `study-time:<guild>:<user>` aggregate rows and `study-resource` definitions. Deduplication receipts expire after 90 days. Microbemon updates and their study-time credit share the same database transaction. Question credits are persisted independently of the answer's Merit Coin reward, so a coin retry cannot add time twice. Errors are logged without changing a saved collection.

Voice tracking has a two-minute checkpoint lease. Startup clears old active-session timestamps and begins tracking members currently connected, preventing offline gaps from being counted as study. After longer connection gaps, unobserved time is conservatively omitted. Existing totals survive restarts. Tracking initialization retries every minute if PostgreSQL is unavailable and refuses volatile memory fallback. The current deployment runs one bot replica; coordinate voice ownership before running multiple replicas.

`/studytime` is a server command and does not consume an additional global slash-command slot. Existing XP `/leaderboard` behavior is unchanged. No schema migration or new environment variables are required.

Validation: `node --test tests/study-time.test.js` covers month/DST splits, concurrent receipt deduplication, rollback/retry, atomic game saves, answered-question retries, voice joins/moves/leaves and restart recovery, ranking and pagination, resource credit and invalid URLs, owner-bound controls, and unavailable persistence.
