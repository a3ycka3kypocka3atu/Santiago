# Andrij Profile Ecosystem Design

## Goal

Create a full public web presence for Andrij Pycha inside the Santiago platform. The profile should feel like the living center of an ecosystem: personal purpose work, networking, project incubation, conscious relationships, media/interviews, recording services, marketing, automation, and educational events.

The public copy must not mention admin status. It should present Andrij as a founder, connector, ideologist, facilitator, media creator, and builder of community platforms.

## Source Material

- User notes from the conversation.
- `Životopis.docx` from the desktop.
- Existing Santiago surfaces: `masters.html`, `profile*.html`, `services.html`, `services.js`, `projects.html`, `projects.js`, `events.html`, `translations.js`, and the Telegram/Supabase submission and booking flow.

## Content Positioning

Use grounded visionary language:

- Andrij helps people see purpose, hidden patterns, strengths, relationships, and project potential.
- Santiago is positioned as a space where people can develop themselves, find collaborators, and turn ideas into real projects.
- The work blends practical tools with deeper inner work: AI, media, automation, marketing, facilitation, personal branding, community, and conscious connection.
- Avoid unsupported medical or therapeutic claims. Phrase intuitive work as pattern recognition, reflective guidance, purpose discovery, and conscious self-understanding.

## Website Changes

### Profile

Add a new `profile-andrij.html` page based on the existing master profile pattern. The page should include:

- Hero with name, title, short manifesto, and languages/location.
- About section linking his international experience, community work, media, AI, and platform building.
- Direction cards:
  - Purpose and self-discovery.
  - Networking and community building.
  - Media/interviews and recording production.
  - Startup, marketing, automation, and ethical agency work.
  - Conscious relationships and matching/event formats.
  - Alternative history, alternative science, energy literacy, and educational lectures.
- Projects/services/event connection section.
- CTA cards to services, projects, events/calendar, and Telegram booking/submission.

### Masters

Add Andrij as a public master/creator card in `masters.html`, with filters that match:

- direction: mind, media, incubator/community if available;
- format: individual, group, b2b;
- role: practices, production, facilitation/strategy if available.

If filter options need small expansion, keep them conservative and compatible with current JS.

### Services

Add static service cards in `services.js`:

- Personal brand and purpose discovery session.
- Networking/event facilitation.
- Interview and 4K recording production.
- Startup, marketing, automation consultation.
- Conscious relationship discovery format.
- Lectures/workshops on alternative history/science and energy understanding.

Each service should point to either `profile-andrij.html`, `events.html`, `openmic.html`, or a future detail page if no dedicated offer page exists.

### Projects

Add or refine projects in `projects.js` so Andrij's ecosystem appears as connected initiatives:

- Santiago Networking Platform.
- Conscious Relationships Platform.
- Santiago Talks / Interview project.
- Ethical Marketing and Automation Agency.
- Alternative Knowledge Lab.

These should connect to the existing incubator, club, digital platform, and open mic ideas without duplicating too heavily.

### Events

Update `events.html` from empty placeholder into a real program concept page with current event formats:

- Networking and mutual-help evenings.
- Conscious relationship meetings.
- Santiago Talks / interview nights.
- Project co-creation and startup circles.
- Alternative history/science lectures.

Keep date-specific scheduling routed to `calendar.html` and Telegram bot links until real dates are provided.

## Data Flow

For this iteration, content is static website content:

- Service booking buttons already use `request_service_booking` with service slugs.
- Andrij services can be bookable through the existing service modal if listed in `services.js`.
- Event creation and publishing still run through the Telegram submission flow.
- Future database mentor/profile linkage can come after the public pages are in place.

## Error Handling

- If a service has no dedicated detail page, route to `profile-andrij.html` or a relevant existing page rather than a dead link.
- Booking requires Telegram login; the existing modal already handles login-required states.
- Do not add admin-only claims or links to private tools.

## Testing

- Open the relevant pages locally and verify:
  - `masters.html` shows Andrij and filters still work.
  - `profile-andrij.html` renders on desktop and mobile.
  - `services.html` shows new services, filters work, and booking modal opens.
  - `projects.html` shows new connected projects and filters/sorting still work.
  - `events.html` no longer reads like an empty placeholder.
- Check console for obvious JS errors.

## Scope Boundaries

This iteration does not build:

- a database-backed public mentor profile model;
- a full admin panel;
- dedicated long-form offer pages for every service;
- final dated events;
- payment flow or automatic matching engine.

Those belong in later platform work after the public identity and booking surfaces are coherent.
