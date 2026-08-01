# Santiago Way International Platform Positioning

## Purpose

Santiago Way is an international discovery and cooperation platform for holistic living, natural wellbeing, traditional knowledge, conscious communities, and ethical projects.

It connects people with events, services, products, places, practitioners, organisations, educational experiences, communities, and projects. It also helps practitioners, organisers, producers, and project creators present their work, reach relevant audiences, receive requests, and find partners.

The public positioning must not depend on Prague or any other single local community.

## Product Direction

The initial product model is discovery and cooperation. Marketplace transactions, payments, reviews, verification, city and country hubs, memberships, and partner matching can be added later when the platform has enough real offers and users.

Telegram is one available communication and operational channel. It is not the identity of the platform, the only way to communicate, or a permanent architectural constraint. Future website-native and other communication systems should be able to coexist with or replace Telegram flows.

## Current Change

This is a small, reversible positioning correction rather than a platform restructuring.

- Make English the only active public language for now.
- Hide all visible language selectors, including selectors inside menus.
- Keep the existing translation dictionaries and selector markup so multilingual support can be restored later.
- Ignore previously saved language choices and consistently render English.
- Update the homepage title, description, and main hero positioning in English.
- Update the current platform plan so future work follows this direction.
- Keep existing section names, including "Masters."
- Preserve current calendars, pages, listings, profiles, data models, and working flows.

## Homepage Message

The homepage should introduce Santiago Way as an international platform, not primarily as a studio, club, or Prague community.

Recommended core copy:

- Title: **Santiago Way**
- Main message: **Discover holistic events, services, products, places, practitioners, communities, and projects in one connected platform.**

The existing homepage sections can remain beneath this message. They are current parts of the broader platform and can be reorganised during later information-architecture work.

## Language Behaviour

The shared language layer should use English as the fixed active language. Hiding controls through the shared stylesheet avoids repetitive edits across every HTML page. Existing translation data should not be deleted.

When multilingual support returns, the fixed-English override and shared hiding rule can be removed, allowing the existing selectors and dictionaries to be reused.

## Out of Scope

- Redesigning pages or navigation
- Renaming existing sections
- Removing Telegram features
- Changing calendars or event behaviour
- Database or backend migrations
- Adding new platform objects or marketplace transactions
- Rewriting all existing page content
- Removing non-English translations

## Verification

- A visitor with any old saved language preference sees English.
- No language selector is visible on desktop or mobile.
- Homepage metadata and hero copy reflect the international platform.
- Existing navigation, calendar links, and feature scripts still load.
- The change remains easy to reverse when multilingual work resumes.
