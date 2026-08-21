# Lumeya Public MVP Security Boundary

## Current browser model

The public MVP is guest-only. Browser authentication is deliberately dormant:

- a Telegram user ID in a URL is not accepted as proof of identity;
- no browser profile is restored from `localStorage`;
- private profile, booking, submission, favourite, subscription, and admin RPCs are not part of the public product;
- the browser uses only the Supabase publishable key loaded from `public-config.js`;
- the Supabase service-role key must exist only in the bot/server environment.

The repository still contains private-platform UI and bot workflows for future work. They are not a secure authenticated browser experience and must remain hidden/dormant until a real Supabase Auth session and matching RLS design are implemented.

## Public request intake

`suggest_listing` and `looking_for` requests use the isolated `public_discovery_requests` table. Public roles cannot select from, update, or delete this table. The only browser permission is execution of `submit_public_discovery_request`, a validated insert-only `SECURITY DEFINER` function with an empty `search_path`.

The browser validates required values, length, enum, and URL format. The database repeats those checks. A honeypot field provides basic automated-spam filtering. The RPC also limits a browser fingerprint to five requests per hour when proxy headers are available. This is containment, not a replacement for edge-level abuse protection.

Form values are not autosaved while the user types. If a send attempt fails, the current values are saved in that browser's `localStorage` for up to seven days. The user can copy the request and open the Telegram bot. Local drafts are not encrypted. Forms tell users not to submit passwords, payment data, medical records, or other sensitive information.

Stored requests expire after 90 days. `delete_expired_public_discovery_requests` is callable only by the service role and must be scheduled by the production operator. The bot claims pending notifications with `FOR UPDATE SKIP LOCKED`, sends them to `ADMIN_CHAT_ID`, and records success or retry state.

## Migration status

`bot/schema.sql` is the migration-0001 baseline, not a safe final state. The authoritative final schema is that baseline followed by every numbered migration through `0016_public_discovery_security.sql`. Migration 0016 is prepared locally but is **not confirmed as applied to Lumeya's dedicated Supabase project**.

Before a public release, a collaborator with access to the intended Supabase project must:

1. Confirm the project is the correct Lumeya environment and take an appropriate backup.
2. Review the baseline and apply migrations in order through `0016_public_discovery_security.sql`.
3. Confirm anonymous callers can execute only `submit_public_discovery_request` from the new public flow.
4. Confirm anonymous callers cannot read `public_discovery_requests` or private platform tables.
5. Confirm only confirmed public events and published public services are readable.
6. Configure `SUPABASE_PUBLISHABLE_KEY` in the bot test environment and run `npm run test:public-mvp` from `bot/`. The test submits one disposable request, checks anonymous denial/public reads, verifies service-role access, and removes the test row.
7. Run Supabase security and performance advisors after the migration and resolve any relevant findings.

Until that is done, the website must treat request submission and event loading as unavailable and preserve the Telegram fallback. Repository code does not prove live database state.

## Bot environment

The bot requires all of the following values at startup:

- `BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_CHAT_ID`
- `PUBLIC_SITE_URL`

`PUBLIC_SITE_URL` must be an absolute HTTPS URL. `ADMIN_CHAT_ID` must be a valid numeric Telegram chat ID. There are no personal or dead deployment defaults. Do not commit `.env` files, tokens, service-role keys, or production identifiers.

Optional comma-separated `ADMIN_USERNAMES` and `INSTRUCTOR_USERNAMES` values can support the legacy bot role-upgrade flow. They have no hard-coded personal defaults and do not replace database authorization.

The website fallback opens the bot with `start=public_request`. The user must paste the copied request into the chat. This flow skips the legacy profile middleware, so it does not create a platform account. The bot records the request when the new table is available and always attempts to notify the configured admin chat.

## Known limits before broad launch

- Live Supabase reachability, grants, RLS, bot availability, and production deployment still require external verification.
- The public endpoint has validation, a honeypot and a basic database rate limit, but no CAPTCHA/Turnstile, reputation check or moderation queue UI.
- Telegram fallback also needs network access; it cannot deliver while the device is fully offline.
- The in-memory Telegram conversation session can be lost when the bot process restarts.
- Administrative review currently depends on direct database access and Telegram notification. The notification worker and retention cleanup require a continuously running bot process or equivalent scheduler.
- Legacy private-platform code remains in the repository. Re-enabling it requires real authentication, new authorization tests, and an RLS review; public caller-supplied IDs must not be restored as identity.

Before exposing the forms to high traffic, add edge-level rate limiting or Turnstile and verify the 90-day cleanup schedule.
