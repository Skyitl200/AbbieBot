# Programme updates

Members open **`/programupdates` with no typed options**. The ephemeral menu guides them through actions, programme, country, state/province/region, topic, applicant type, and available school/source selections. A 249-country location catalogue supplies country and regional dropdowns with Previous/Next pagination. Entire country is always an option. This catalogue does not mean every school in every location is monitored.

The nine programmes are Nursing, Dental Hygiene, Dental Assisting, X-Ray Technology, Ultrasound Technology, Respiratory Therapy, Physical Therapist Assistant, Physician Assistant, and Medicine.

## Member menu

- Find schools and requirements: choose programme/location and a tracked or discovered school page. Tracked sources show live excerpts, checked timestamps, and source links. Newly discovered pages are clearly labelled unverified search candidates, not official requirements.
- Subscribe to updates: preview programme, location, applicant category, topic and school, then Save subscription. Up to 20 subscriptions are allowed per member. Countrywide and all-applicant sources match narrower applicable subscriptions.
- Compare two school sources: select the first and second school/source separately, including across pages. Sources remain separate; the bot does not equate different requirements. Save subscription subscribes to both selected schools.
- Manage subscriptions: select a saved subscription to remove it. Existing subscriptions from the original typed command remain available.
- Request coverage: choose programme and location, then Request coverage. Requests are limited to one per hour and go to the review channel when configured.

Only the menu owner can use its controls. Sessions expire after an hour of inactivity. Stale or replayed controls are rejected. Users are not asked to paste URLs. Links come from tracked official sources, the configured school-search service, or built-in official directories. A generated Google school-search link is offered when no school results are available; it is a search link, not a fabricated school address.

## Railway and moderator setup

1. Deploy with the existing persistent PostgreSQL database. The existing `temp_data` table is reused; no migration is required. Server commands register at startup.
2. Run **`/programupdatesadmin setup`** and select the public updates channel and moderator review channel from Discord's channel selectors. The bot needs View Channel, Send Messages and Embed Links in both.
3. Set **`BRAVE_SEARCH_API_KEY`** in Railway to enable live worldwide school-page discovery. Without this key, members can still browse tracked sources, subscribe, request coverage and use directory/search links, but the bot cannot populate new school pages through live search.
4. Moderators can select **Find and approve an official source** in the programme menu, or open **`/programupdatesadmin add-source`**. Choose programme, country, region, topic, applicant type and a discovered page. The bot finds the URL. Verify that it is the official organisation page and applies to the selected scope, then press **Approve official source**. A first snapshot is saved as a baseline.
5. Run **`/programupdatesadmin check`** to check immediately. Checks run in the background; use **`/programupdatesadmin sources`** for status.

Administration is separated from the member menu. The admin command defaults to Manage Server permission, and source approval/change review check permissions on every interaction. Additional commands: `/programupdatesadmin requests`, `/programupdatesadmin source-remove id:<source ID>`. List commands support optional page numbers. No URL field is exposed in either command.

No initial school catalogue is populated. Source discovery is not automatic approval, and source requests do not begin monitoring until a moderator approves a page. Official directories are navigation aids, not comprehensive school requirements databases. There is no claim of worldwide school completeness.

## Scheduled checks and review

Checks run at 00:00 and 12:00 UTC. Manual checks are limited to once every 10 minutes. Up to 50 sources per server are supported. The first successful check records a baseline silently. Subsequent checks normalize HTML/text or RSS/Atom content and compare hashes; unchanged pages produce no messages. Navigation, scripts and styles are removed. Previously saved sources with CSS section selectors continue to use them.

Changed text goes to the moderator review channel as added/removed excerpts with programme, location, applicant category, topic and source link. Approve update publishes the excerpts and notifies matching subscribers in batches; Ignore change advances the baseline silently. Source checks pause while a review is pending. Moderators must verify the applicable intake year, dates and eligibility on the source before publishing. Excerpts are not a complete admission decision or AI-generated advice.

Errors preserve the previous successful snapshot. PostgreSQL advisory locks coordinate checks/reviews across replicas. Publication progress is saved so notification retries do not republish the main update. Discord nonce enforcement handles short-term retries; a crash between a send and its database write can still duplicate a post after Discord's nonce window. Delivery is best-effort, not exactly-once across two services. Session handlers reuse their database connection for nested lookups to avoid exhausting the pool.

## Retrieval scope

Only public HTTPS on port 443 is fetched. DNS is validated and pinned, redirects are revalidated, and private/local/special IP addresses, URL credentials, unsupported content types and oversized responses are rejected. DNS and request timeouts, a 2 MB response limit and a 120,000-character text limit bound retrieval.

This version supports readable HTML/text and RSS/Atom. PDF extraction, authenticated or JavaScript-only portals, automatic translation and AI interpretation are not included. Do not bypass blocked automated access. An unreadable candidate cannot be approved as a monitored source. No AI key is needed, and requirements or institutional URLs are never invented.

## Validation

Run `npm run test:program-updates`. Coverage includes worldwide dropdown pagination, member-owned/stale/expired sessions, subscription workflows, permission checks, empty school results, source discovery, HTML/RSS extraction, network validation, change/review lifecycle and notification retries. `tests/study-time.test.js` covers the existing statistics feature.
