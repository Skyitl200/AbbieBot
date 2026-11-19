# Programme updates

`/programupdates` supports Nursing, Dental Hygiene, Dental Assisting, X-Ray Technology, Ultrasound Technology, Respiratory Therapy, Physical Therapist Assistant, Physician Assistant, and Medicine. Locations accept two-letter country codes worldwide, with optional free-text state/province, school, applicant category, and topic filters. Region names should use consistent spelling when registering sources and subscriptions.

## Railway setup

1. Deploy this branch with the existing persistent PostgreSQL database. Existing `temp_data` storage is reused; no migration or new table is required. The bot registers this server command at startup.
2. Run `/programupdates setup channel:#program-updates review-channel:#moderator-review`. The bot needs View Channel, Send Messages, and Embed Links in both channels. Restrict access to the review channel using Discord permissions.
3. Optionally set `BRAVE_SEARCH_API_KEY` in Railway for live worldwide school-page discovery. No search credential is required for approved-source search, subscriptions, monitoring or review. Search results are labelled candidates, not verified official sources or current requirements. Without this credential the bot explains that discovery is not configured instead of inventing results.
4. Add official pages for schools/regulators members request, then run `/programupdates check` to verify operation.

No source is approved automatically by a web search or AI. A moderator with Manage Server must verify that it is an official organisation page before adding it. There is no preloaded worldwide database or claim to cover every school. Built-in official directory links are navigation aids for selected programmes/locations, not monitored school requirements.

## Member commands

- `/programupdates find program:Nursing country:CA region:Ontario applicant:international topic:prerequisites school:Example University`
- `/programupdates compare program:Nursing country:CA school:Example University | Another University`
- `/programupdates subscribe program:Nursing country:CA region:Ontario applicant:international`
- `/programupdates subscriptions page:1`
- `/programupdates unsubscribe id:<subscription ID>`
- `/programupdates request program:Nursing country:ZA school:Example University`

Discord presents programme, topic, applicant and country options as the native command form. Search results include official-source links, source excerpts, and a checked timestamp when retrieval succeeds. Excerpts are not a full admission decision or a substitute for checking the applicable intake year. Compare returns each school's sources separately; it never equates different schools' requirements. A Save subscription button previews/records filters, and only the invoking member can save it. On compare, saving subscribes to the selected programme/location rather than treating `School A | School B` as one school name. Members can save up to 20 subscriptions and request coverage once an hour. No private messages or student-role assignments are performed.

Subscriptions match programme, country, region, school, topic and applicant type. A countrywide or all-applicant source matches applicable narrower subscriptions. Members receive opt-in mentions in the configured public channel after a moderator publishes a matching update. Matching subscriptions are deduplicated by member and notifications are batched. Browsing and preferences are ephemeral.

## Moderator commands

- `/programupdates source-add program:Nursing country:CA school:Example University topic:prerequisites url:https://official-school.example/admissions region:Ontario applicant:international section:#requirements`
- `/programupdates sources page:1`
- `/programupdates requests page:1`
- `/programupdates source-remove id:<source ID>`
- `/programupdates check`

The `school` field may contain a regulator's name when tracking licensing. Supply school/organisation, topic and URL on source-add. `section` is an optional CSS selector to isolate the relevant section and avoid navigation/footer noise. Up to 50 sources per server are supported in this first version. Pages must expose readable HTML/text or RSS/Atom; PDFs, authenticated portals, JavaScript-only pages, and sites that block automated access require another source page. Do not bypass access restrictions.

## Checks and review

A scheduled task checks sources at 00:00 and 12:00 UTC. A manual check is available once per 10 minutes and runs in the background; check /programupdates sources for status. The first successful check saves a baseline without announcing old content as news. Navigation, scripts and styles are removed, normalized source text is hashed, and unchanged pages produce no notifications.

Changes are sent to the review channel as added/removed text, with location, applicant type, topic and official source. A reviewer can **Approve update** or **Ignore change**. Review permissions are checked on every click. A pending review pauses that source until resolved; after resolution the next check catches later changes. Approval publishes the source excerpts, explicitly marked as reviewed changes rather than AI-generated admissions advice. Ignoring advances the baseline silently. Changes to dates/applicability must be verified on the linked page before approving.

Errors preserve the last successful snapshot. Source status shows last check, pending review or failure. PostgreSQL session locks coordinate checks and review across replicas. Publication progress is saved so subscriber-notification retries do not republish the main update. Discord nonce enforcement handles short-term send retries; a crash between a successful Discord send and its database write can still produce a duplicate after Discord's nonce window. This is best-effort deduplication, not an exactly-once guarantee across two services.

Source requests are stored for moderator review and announced in the configured review channel. Sources require manual approval; a request or subscription does not automatically start crawling. Preview drafts expire after an hour and use the existing database expiry mechanism.

## Retrieval limits

Only public HTTPS on port 443 is fetched. DNS results are validated and pinned per request; redirect destinations are revalidated. Private/local/special IP ranges, credentials, oversized responses, unsupported content types and unbounded redirect chains are rejected. Requests have a timeout and a 2 MB response limit. Content sections have a 120,000-character maximum. Search candidates are not fetched until approved by a moderator.

No AI key is needed. This version uses deterministic source excerpts and line comparisons; it does not invent prerequisites, infer eligibility, translate requirements, extract PDFs, or claim to read an entire country's schools. Those can be added as separate, sourced enhancements.

## Validation

Run `npm run test:program-updates`. Tests cover worldwide filters, all nine programmes, HTML/RSS extraction, public-network checks, redirect validation, baseline/change/review lifecycle, retries, notification batches, permission checks, member-owned subscriptions, optional search, and Discord payload constraints.
