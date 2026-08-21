# Lumeya release verification

Lumeya's public frontend remains static HTML, CSS and vanilla JavaScript. The
repository-level verification layer uses Node.js standard-library APIs only;
there is no frontend build or test dependency installation step.

## Prerequisites

- Node.js 18 or newer.
- No Supabase, Telegram or Vercel credentials.
- Git is recommended for the secret scan so ignored local environment files
  are not read.

## Commands

Run the complete local and CI gate:

```sh
npm run verify
```

The complete command includes a temporary HTTP server bound to
`127.0.0.1`. In a restricted sandbox that forbids local port binding, run the
deterministic non-network portion instead:

```sh
npm run verify:static-only
```

The full HTTP smoke check must still pass in CI or another environment that
allows a loopback listener before release.

Individual checks are also available:

```sh
npm run verify:pages
npm run verify:links
npm run verify:assets
npm run verify:js
npm run verify:static
npm run verify:mvp
npm run verify:journey
npm run verify:security
npm run verify:secrets
npm run verify:smoke
```

Every command exits with status 0 only when its selected checks pass.

## Release contract

| Check | Enforced contract |
| --- | --- |
| `pages` | Every registered public and account HTML file exists and is non-empty. The Public Discovery registry includes `map.html`, `about.html`, and `suggest.html`. Unregistered root HTML is reported. |
| `links` | Local HTML and JavaScript page references exist. Pure and cross-page fragments must resolve to an actual target ID. External URLs are intentionally not fetched. |
| `assets` | Referenced local scripts, styles, media and CSS `url()` assets exist. |
| `js` | Root frontend scripts, bot scripts and inline page scripts parse with `node --check`; application code is not executed. |
| `static` | Every HTML file has its required document markers. Unbalanced `script`, `style`, or `div` tags are release failures. |
| `mvp` | Public pages declare English, core pages expose exactly Discover, Services, Practitioners, Map, Events and About in primary navigation, required discovery scripts are connected, legacy/account/language controls are not visible in the core shell, the map has Leaflet resources, the suggestion page has a form, and every new-tab link has a safe `rel`. |
| `journey` | The factual Deep Massage → Ivan → Santiago Studio → request slice has symmetric relationships and working local routes; conceptual places and synthetic map coordinates are rejected. |
| `security` | Browser configuration has no hard-coded Supabase project, the request migration exposes only the narrow RPC, legacy RPCs are revoked, rate/retention controls exist, and the no-account Telegram/admin-notification path is connected. |
| `secrets` | Tracked and unignored source text is scanned for a small set of obvious private-key, provider-token, bot-token and privileged literal-assignment patterns. Values are never printed. |
| `smoke` | Every expected page and key public asset returns HTTP 200 with the expected content type from a local static server. |

The contract and page/script registries live in `verify/config.js`. Product
changes that add or replace a required public page must update that registry in
the same change.

The current integration contract requires `discovery-data.js` on catalog and
profile surfaces, `profile-enhancements.js` plus the profile data hooks on each
practitioner page, and `public-forms.js` on the public suggestion page. The
legacy identity-dependent `submission-requests.js` is intentionally excluded
from the public deployment and must not be referenced by HTML.

## Continuous integration

`.github/workflows/verify.yml` runs `npm run verify` on every push and pull
request with read-only repository permissions. The project has no root runtime
dependencies, so CI intentionally does not run `npm install`.

## Deployment boundary

`.vercelignore` keeps the static-site deployment separate from the bot,
environment files, documentation, verification tooling, agent configuration,
accidental legacy folders and unused source videos. Only the two videos still
referenced by the public site are included. This boundary complements—but does
not replace—secret scanning and production environment review.

## Deliberate limitations

- These checks do not contact Supabase, Telegram, Vercel or arbitrary external
  links.
- Syntax and source contracts do not prove browser behavior, accessibility,
  responsive layout, network requests, RLS/RPC behavior or successful form
  delivery.
- The secret scan is heuristic and cannot prove that repository history or
  external deployment configuration is clean.
- Final release verification still requires browser QA, online/offline form
  tests, Supabase security checks, preview-deployment HTTP checks, and
  post-deploy production checks.

After applying migration 0016 to the confirmed Lumeya project, run the disposable
live database contract from `bot/`:

```sh
npm run test:public-mvp
```

This requires the dedicated project's URL, publishable key and service-role key
in the local environment. It must never be run against another ecosystem
project.
