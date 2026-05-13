# Santiago Platform: Current State And Next Work Plan

## Current State

The platform now has the working backend foundation for the first real MVP:

- Telegram profile login works through `get_profile_by_telegram_id`.
- The live database has services, events, favorites, subscriptions, reminder notifications, bookings, and submissions.
- Two public services exist in Supabase.
- One public test event exists for calendar and reminder testing.
- Saving an event creates a favorite, an active event reminder subscription, and two pending reminder jobs.
- The cabinet can show the logged-in admin profile and saved event reminder state.
- The Telegram bot is the main operational backend for role flows, submissions, and reminder delivery.

## Product Direction From User

Admin work should stay Telegram-first for now. The admin does not need a full website admin panel immediately.

Content will come later, after the mechanics work reliably.

The website should focus on being useful for visitors, residents, mentors, and later content discovery. The bot can continue doing heavy admin actions, while the site can show states and activate bot flows where needed.

## What We Still Do Not Have

### Mentor Profile System

The database can store users with an instructor role, and the bot can collect submissions, but the platform does not yet have a complete mentor profile system.

Missing:

- public mentor profile records connected to users;
- mentor profile listing on the website;
- profile publish/approve status;
- profile edit/update flow after initial approval;
- links between mentor, services, events, and future audience;
- mentor-specific cabinet view with real submitted/published items.

### Submission Review Visibility

The bot can collect submissions, and the database has a `submissions` table. The website admin panel does not need to manage them yet, but the system still needs a clean operational loop.

Missing:

- bot command/menu for admin to list pending submissions;
- approve/reject actions in Telegram;
- status updates in Supabase;
- Telegram notification back to mentor after approval/rejection;
- optional website cabinet visibility for mentor: pending, approved, rejected.

### Booking And Event Participation Loop

The website can request a booking through the database function, but the complete user journey is not finished.

Clarified scope:

- private bookings are not a global website list;
- users see only their own booking status;
- mentors/organizers see counts and private booking state only for their own events/services;
- admin/master sees platform counts and operational health, not casual access to all booking rows;
- public “I will come” participation is separate from private booking and can be shown on event pages;
- if event capacity is limited, the public page can show taken/left places.

### Notification Plan Beyond Reminders

Event reminders work for saved events. More notification types should be planned, but not all built immediately.

Useful next notifications:

- booking requested -> admin;
- booking approved/rejected -> user;
- submission approved/rejected -> mentor;
- new event from saved mentor -> user;
- new date/open seat for saved service -> user;
- discount/special offer for saved service -> user;
- event changed/cancelled -> saved/booked users.

Admin does not need separate website notifications now because Telegram is the admin control surface.

### Club / Resident Value Layer

The role exists, but the value is mostly promised by the site copy.

Missing:

- real club-only events;
- resident-only offers or discounts;
- early access logic;
- cabinet section with actual resident benefits;
- clear path for visitor to become resident;
- visibility rules tested with real resident account.

### Content Layer

Content is intentionally postponed until mechanics are ready.

Future content needs:

- real event/service/mentor content;
- images and media assets;
- published mentor profiles;
- real community/club offer;
- possibly projects/articles/content cards later.

### Deployment And Operations

The local system works, but production setup should be tightened later.

Needed:

- set `PUBLIC_SITE_URL` in `bot/.env`;
- confirm final deployed website URL;
- run bot 24/7 on server or hosting;
- remove or rename test event when real events are ready;
- commit and keep migrations in order;
- add a small smoke-test checklist for login, save, reminder, booking, and submission flows.

## Recommended Next Work

Build the next step as one combined Telegram-first operations plan:

1. Website booking requests create private Supabase bookings and show only the user's own status.
2. Public “I will come” participation is visible on the event page/calendar, including capacity counts when relevant.
3. Submission requests from mentors are stored in Supabase and visible to admin/master in Telegram.
4. Files stay in Telegram; the website cabinet shows only text/status/admin message/final link.
5. Admin/master answers each submission in Telegram: accept, reject, ask for info, or send final published link.
6. Mentor sees submitted/in-work/published/rejected request states in the website cabinet.
7. Mentor sees stats for their own linked events/services: saved count, public attendee count, booking count.
8. Admin/master can switch website cabinet view between admin, visitor, resident, and mentor to test the platform.

This keeps admin work inside the bot, while the website becomes the user-facing status and discovery layer.

## Later Work

After the above flow works:

1. Add mentor public profiles.
2. Add real club/resident content and restrictions.
3. Add saved-mentor and saved-service notifications.
4. Add better content and visuals.
5. Add website admin tools only if Telegram admin becomes too limiting.
