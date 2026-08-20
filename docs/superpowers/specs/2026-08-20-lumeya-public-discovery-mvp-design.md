# Lumeya Public Discovery MVP

## Purpose

Complete the existing static Lumeya website as a coherent public discovery product. A visitor must be able to discover, understand, locate, and contact practitioners, services, places, and events without creating an account.

## Product boundary

The MVP is a curated discovery platform. It is not a marketplace, social network, CRM, medical record system, native booking engine, or authenticated provider workspace. Legacy pages remain available, but Shop, Open Mic, Club, Projects, Cabinet, and Telegram login do not appear in primary navigation.

The public navigation is:

1. Discover
2. Services
3. Practitioners
4. Map
5. Events
6. About

## Architecture

The existing HTML, CSS, and vanilla JavaScript architecture remains. No framework, build system, or new runtime dependency is introduced.

`discovery-data.js` is the browser-side source of truth for the first curated MVP dataset. It contains normalized practitioners, services, places, event formats, and relationships. Catalog pages and the map consume the same records so entity names, statuses, locations, and links cannot drift independently.

`menu.js` owns the public shell. It renders the approved navigation on every page, hides dormant account and language controls, maintains accessible menu state, and marks the current page.

`translations.js` keeps all dictionaries but always activates English for public rendering. Stored language preferences are ignored during this phase.

## Public pages

### Discover

The homepage explains the international platform, exposes the discovery loop, links directly to core entity catalogs, shows an honest event availability state, and offers the two no-account feedback actions.

### Services

Every service card shows title, description, availability status, duration, format, location, practitioner or provider, and a contact action. Filters cover topic, format, availability, and provider.

### Practitioners

Every practitioner record includes a visual identity slot, short description, approach, fields, location, languages, online availability, experience, services, places, events, external links, and contact action. Existing detail pages receive a shared standardized discovery panel without deleting their supplied content.

### Places and map

The map uses Leaflet 1.9.4 from the official CDN setup and OpenStreetMap tiles with attribution. It renders practitioners and real places only. City-level coordinates are explicitly labelled when a precise public address is unavailable. City and topic filters update both map markers and the list. The Map and List toggle uses one filtered result set.

### Events

Scheduled database events and static event formats are separate. Formats are always labelled as concepts or recurring formats. If scheduled events cannot be loaded, the page and calendar show `Events temporarily unavailable` instead of an empty successful state.

### About and feedback

The About page explains purpose, curation, information responsibility, product boundaries, and how practitioners or places can participate. The feedback page contains `Suggest a practitioner, service, or place` and `What are you looking for?` forms.

## Submission flow

Public forms collect only the minimum contact and request information. The browser first calls a dedicated Supabase RPC. The RPC accepts only the two public request kinds, validates lengths, inserts a pending submission, exposes no read operation, and does not trust browser identity or role data.

If Supabase or the RPC is unavailable, the form preserves entered data and reveals a prefilled Telegram fallback. The user explicitly chooses to continue in Telegram. No login is required.

## Security boundary

The existing Telegram ID and localStorage identity model is dormant in the public MVP. Public pages do not advertise Cabinet, Favorites, reminders, role-based editing, or native booking. Existing migrations and code remain for later reconstruction.

The new public RPC is the only new anonymous database capability. It has a narrow kind whitelist, text limits, no public read path, explicit function grants, fixed search path, and an RLS-protected target table. Existing unsafe legacy RPC exposure is documented but not redesigned in this phase.

## Error handling and accessibility

Catalogs provide loading, empty, and unavailable states. Forms use inline validation and status regions. Menus, filters, toggles, dialogs, and cards remain keyboard operable. Focus is visible, interactive controls have accessible names, and motion respects reduced-motion preferences.

## Verification

The repository verifier covers expected pages, local links and assets, JavaScript syntax, HTML structure, the final navigation contract, English-only public configuration, normalized discovery records, map dependencies, submission fallback, and unsafe secret patterns.

Manual verification covers desktop and mobile layouts, keyboard operation, fresh storage, forced Russian storage, unavailable Supabase, form success and fallback paths, map filtering, event unavailable states, browser console output, production HTTP responses, and deployed assets.

## Completion criteria

The MVP is complete when all public routes load, the discovery relationships are visible and consistent, every required entity field is rendered, no login is needed for core actions, database failure has an honest fallback, automated verification passes, production is deployed and checked, secrets remain uncommitted, executable bits are normalized, and the intended Git worktree is clean.
