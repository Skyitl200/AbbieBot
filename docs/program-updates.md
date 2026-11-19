# Programs

## One command, all options

Open `/programs` with no arguments. Member options are Find schools and requirements, Compare two school sources, Subscribe to updates, Manage my subscriptions, Request coverage, and How it works. Moderators additionally see Moderator settings. All configuration is handled through that menu.

Members open **`/programs` with no typed options**. The ephemeral menu guides them through actions, programme, country, state/province/region, topic, applicant type, and available school/source selections. A 249-country location catalogue supplies country and regional dropdowns with Previous/Next pagination. The bundled free Hipo institution directory supplies school choices without an API key, and large lists have alphabetical group selection. Entire country is always an option. This catalogue does not mean every school in every location is monitored.

The nine programmes are Nursing, Dental Hygiene, Dental Assisting, X-Ray Technology, Ultrasound Technology, Respiratory Therapy, Physical Therapist Assistant, Physician Assistant, and Medicine.

## Member menu

- Find schools and requirements: choose programme/location and a tracked or discovered school page. Tracked sources show live excerpts, checked timestamps, and source links. Newly discovered pages are clearly labelled unverified search candidates, not official requirements.
- Subscribe to updates: preview programme, location, applicant category, topic and school, then Save subscription. Up to 20 subscriptions are allowed per member. Countrywide and all-applicant sources match narrower applicable subscriptions.
- Compare two school sources: select the first and second school/source separately, including across pages. Sources remain separate; the bot does not equate different requirements. Save subscription subscribes to both selected schools.
- Manage subscriptions: select a saved subscription to remove it. Existing subscriptions from the original typed command remain available.
- Request coverage: choose programme and location, then Request coverage. Requests are limited to one per hour and go to the review channel when configured.

Only the menu owner can use its controls. Sessions expire after an hour of inactivity. Stale or replayed controls are rejected. Users are not asked to paste URLs. Links come from tracked sources, website addresses in the bundled institution directory, or built-in official directories. No admissions/program URL is fabricated. A generated Google school-search link is offered when no school results are available; it is a search link, not a fabricated school address.

## Railway and moderator setup

1. Deploy with the existing persistent PostgreSQL database. The existing `temp_data` table is reused; no migration is required. Server commands register at startup.
2. Run **`/programs` → **Moderator settings → Set update and review channels**** and select the public updates channel and moderator review channel from Discord's channel selectors. The bot needs View Channel, Send Messages and Embed Links in both.
3. No search API key or search subscription is required. School lists are supplied by a bundled directory snapshot and are available even if the upstream directory is temporarily unavailable. Existing Brave keys are no longer used by this feature.
4. Moderators select **`/programs` → **Moderator settings → Find and approve an official source****. Choose programme, country, region, topic, applicant type and a directory-listed school website. The bot finds the URL. Verify that it is the official organisation page and applies to the selected scope, then press **Approve official source**. A first snapshot is saved as a baseline.
5. Run **`/programs` → **Moderator settings → Check sources now**** to check immediately. Checks run in the background; use **`/programs` → **Moderator settings → View monitored sources**** for status.

Administration is inside the **Moderator settings** option, visible only to members with Manage Server permission. Permissions are rechecked on every settings interaction. Settings include channel configuration, finding/approving sources, source status, coverage requests, checking sources now, and source removal with confirmation. Channel and source selections are dropdowns; no separate administrative slash command or URL entry is required.

The bot creates `/programs` before deleting only the obsolete `/programupdates` and `/programupdatesadmin` server command entries. Existing database records, subscriptions and pending-review buttons retain their internal keys and continue to work.

The bundled directory contains 10,272 institution records across 200 countries before URL validation and deduplication. It is not exhaustive and includes different institution types; it does not certify programme offerings, accreditation, or requirements. Known mismatched regions are excluded. Listings without state/province data remain country-level candidates and are explicitly labelled as region-unverified. Source discovery is not automatic approval, and source requests do not begin monitoring until a moderator approves a page. Official directories are navigation aids, not comprehensive school requirements databases. There is no claim of worldwide school completeness.

## Scheduled checks and review

Checks run at 00:00 and 12:00 UTC. Manual checks are limited to once every 10 minutes. Up to 50 sources per server are supported. The first successful check records a baseline silently. Subsequent checks normalize HTML/text or RSS/Atom content and compare hashes; unchanged pages produce no messages. Navigation, scripts and styles are removed. Previously saved sources with CSS section selectors continue to use them.

Changed text goes to the moderator review channel as added/removed excerpts with programme, location, applicant category, topic and source link. Approve update publishes the excerpts and notifies matching subscribers in batches; Ignore change advances the baseline silently. Source checks pause while a review is pending. Moderators must verify the applicable intake year, dates and eligibility on the source before publishing. Excerpts are not a complete admission decision or AI-generated advice.

Errors preserve the previous successful snapshot. PostgreSQL advisory locks coordinate checks/reviews across replicas. Publication progress is saved so notification retries do not republish the main update. Discord nonce enforcement handles short-term retries; a crash between a send and its database write can still duplicate a post after Discord's nonce window. Delivery is best-effort, not exactly-once across two services. Session handlers reuse their database connection for nested lookups to avoid exhausting the pool.

## Retrieval scope

Only public HTTPS on port 443 is fetched. DNS is validated and pinned, redirects are revalidated, and private/local/special IP addresses, URL credentials, unsupported content types and oversized responses are rejected. DNS and request timeouts, a 2 MB response limit and a 120,000-character text limit bound retrieval.

This version supports readable HTML/text and RSS/Atom. PDF extraction, authenticated or JavaScript-only portals, automatic translation and AI interpretation are not included. Do not bypass blocked automated access. An unreadable candidate cannot be approved as a monitored source. No AI key is needed, and requirements or institutional URLs are never invented.

## Validation

Run `npm run test:program-updates`. Coverage includes worldwide dropdown pagination, member-owned/stale/expired sessions, subscription workflows, permission checks, empty school results, source discovery, HTML/RSS extraction, network validation, change/review lifecycle and notification retries. `tests/study-time.test.js` covers the existing statistics feature.

## Free directory provenance and refresh

Institution names, countries, optional state/province data and listed websites come from [Hipo university-domains-list](https://github.com/Hipo/university-domains-list), revision `d7d2ebe27a53cd7037aab3ee091c5ce6f7e331bb`, bundled on 2026-11-19. The MIT licence and attribution are included in `src/assets/program-updates/UNIVERSITY-DIRECTORY-LICENSE.txt`. The source snapshot contains 10,272 records / 200 country codes; malformed URLs and duplicates are excluded at runtime, so selectable counts are lower.

School website entries are not verified admissions links. HTTP-listed websites are attempted via HTTPS; availability is verified when approving monitoring. Newly selected directory entries show the homepage and verification limits, not invented prerequisite text. Government/accreditor directory links remain available as navigation aids; those directories are not automatically scraped in this version. No Wikidata service is required.

To update the bundled snapshot, run `node scripts/refreshSchoolDirectory.js`, inspect the directory changes and manifest, run programme-update tests, then commit them with a bot release. This refresh does not approve new sources or change members' subscriptions. Programme-source checks still run every 12 hours independently of the school-directory snapshot.

## US states, counties and programme reporting

US listings now use the federal NCES IPEDS **HD2024** institution directory, replacing the Hipo US entries that lacked state/province data. The bundled federal data contains 5,927 active, currently operating postsecondary institutions across all 50 states plus DC and other reporting jurisdictions. Fields include state abbreviation, county, city, listed website, admissions/application URLs, and UNITID. Website validation still excludes entries without a usable listed URL.

For US searches, the selected programme is matched against institutional CIP listings in **C2024_A**, rather than showing every school for every health programme. Mapping: Nursing 51.38/51.39; Dental Assisting 51.0601; Dental Hygiene 51.0602; Radiography 51.0911; Sonography 51.0910; Respiratory Therapy 51.0908; PTA 51.0806; PA 51.0912; Medicine 51.1201/51.1901. These are **2024 reported programme records**, not proof of current recruitment, accreditation, prerequisites or eligibility. New or non-reporting programmes may be absent.

After a US state selection, members can select **All counties** or a county with institutions reporting the selected programme. County lists are paginated. Selecting the whole US skips the county step. County preferences are saved in subscriptions and applied to source/update matching. A countrywide or statewide source still matches a narrower county subscription when its scope is explicitly broad. Non-US country/region dropdowns remain available, but county-level classification is only supplied for US records in this version.

For example, Broward College is listed in Florida / Broward County and reports Nursing, Dental Assisting, Dental Hygiene, PTA, Radiography, Respiratory Therapy and Sonography in the bundled year. This corrects its former US-only directory placement. Florida nursing results include Miami Dade, Palm Beach State and Valencia College as well.

Refresh federal data with `python scripts/refreshUsSchoolDirectory.py --year 2024`; review the resulting data/manifest and run tests before committing. Federal archive URLs and SHA-256 digests are recorded in `us-ipeds-manifest.json`. International records continue to use Hipo; the raw Hipo snapshot is retained for provenance but its US rows are superseded at runtime. This is improved coverage, not a guarantee of every operating institution worldwide.

## Reading requested information directly in Discord

**Find program information** now follows relevant links on the selected institution's domain and relays matching website text directly in Discord, with Previous page / Next page controls. The source reference remains for attribution, not as a substitute for the answer. A school need not already be approved for monitoring to request a live read of its directory-listed website. Subscribing is separate: confirmation has a **View requested information** button, and information results offer **Subscribe to these updates**.

A bounded crawl checks up to seven pages, prioritising programme/admissions/criteria links. It follows only the listed school domain and its subdomains, retaining existing public-HTTPS/DNS safeguards. It can seed from admissions/application URLs supplied by NCES rather than guessing paths. PDFs, external portals, JavaScript-only and blocked pages remain unsupported. If no matching readable information is retrieved, the bot says so instead of replacing it with a generic deadline or invented requirement.

On shared health-science criteria pages, matching programme cards/accordions or heading sections are isolated to avoid mixing another programme's requirements with the selected one. Published intake years and dates are retained, including older dates; users must confirm which intake applies. Explicit international-only material is excluded from domestic requests. General school information, when shown, is labelled separately from programme-specific text. Results are source excerpts, not a guarantee that every page or applicant condition has been found.

The extraction was smoke-tested on captured live Broward home, Health Sciences Admissions and admissions-criteria pages: Nursing results contain the source's January 2027 application period and November 23 date, without the Dental Hygiene March 31 date. Automated tests use synthetic fixtures, not a brittle live deadline assertion.

Requested information results are now published as public channel follow-ups. The dropdown workflow, subscriptions and moderator settings stay ephemeral. Public results have separate requester-owned page controls, valid for 24 hours, and include only the school-information snapshot. Publication failures leave the private result readable and explain the channel-permission requirement.
