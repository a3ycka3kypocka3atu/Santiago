# Calendar Event Popup Design

Date: 2026-05-19

## Goal

The Calendar "Add event" action should be a website-native workflow with three clear choices instead of a Telegram-first path. The calendar layout should feel calmer and operational: no cropped grid, no oversized day tiles, and no low-contrast modal.

## Approved Flow

1. Link existing event
   - Pick an existing confirmed event.
   - Pick calendar date.
   - Enter start and end time.
   - Show calculated duration.
   - Save directly to calendar.

2. Create new event
   - Use the same request shape as Cabinet "New event": title plus details for admin.
   - Send a master submission to admin.
   - Show a temporary pending item in the calendar when date/time are present.
   - The real public event remains admin-approved.

3. Quick calendar note / simple event
   - Enter title, date, start time, end time, visibility, and location.
   - Save directly to calendar.

## UI Direction

Use a restrained operational layout: compact calendar cells, flat cards, clear borders, strong text contrast, and a three-option selector at the top of the modal. The modal changes visible fields per mode so the user only sees what is needed for that choice.

## Data Rules

Instructors can link their own confirmed events. Admins who have a master profile act as that master in this popup, so they see their own master events/formats rather than the full admin event catalog. Direct calendar saves use `create_master_calendar_event`; new event requests use `create_master_submission`.
