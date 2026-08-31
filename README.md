# Lumeya

Lumeya, previously developed as Santiago Way, SunGuide, and Santiago, is an international platform for discovering holistic services, practitioners, places, events, and approaches to wellbeing and conscious living.

The project is in a rebranding and reconstruction phase. The canonical vision, desired product concept, and staged development plan are maintained in `../Projects/Lumeya`. Older names may remain in code, content, URLs, and infrastructure until separate implementation work updates them safely.

## Public Discovery MVP

The current release candidate is intentionally public and guest-only. Its first
complete journey is:

`Deep Massage & Tea Ceremony → Ivan Protinyak → Santiago Studio Praha → public request`

The catalogue uses `discovery-data.js` as its normalized public source. The
street address and coordinates of Santiago Studio are not published in the
approved source material, so the place remains list-only and the map creates no
synthetic marker.

The browser configuration now points to Lumeya's confirmed dedicated Supabase
project and contains only its publishable key. A service-role key must never
appear in browser source.

Run the local release gate with:

```sh
npm run verify
```

Database migrations and the Telegram notification worker live under `bot/`.
Private platform features such as browser login, Cabinet, favourites and native
booking remain dormant for this MVP.
