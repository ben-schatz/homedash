# HomeDash Spec (v0.2 draft)

Self-hosted home dashboard. One Node/Express app on a Windows home server, read over the LAN by a wall tablet and the household's computers. Public repo: no personal data in code or history.

## Surfaces

| Route | Audience | Device | Purpose |
|---|---|---|---|
| `/kid` | Kid | Wall tablet | Routines, today's events, visual timer |
| `/home` | Parent | Laptops/PCs | Personal homepage: Top 3 tasks, calendar, roadmap, trip planning, wiki links |
| `/wiki` | Parent | Laptops/PCs | Server-hosted pages, rendered and editable in the browser |
| `/amp` | Parent | Any | v2 bonus: game server status |

`/` redirects to `/kid` (tablet default). Computers bookmark `/home`.

## Kid board (`/kid`)

- Two short routines (morning, bedtime). 3 to 5 simple items each, defined in local config, not code.
- Checkmarks saved on the server per day; reset overnight.
- Visual countdown rings to the morning and bedtime targets (times in config). Purpose: teach a young kid that time drains as you do stuff.
- Visual timer: big preset buttons (5/10/15/20 min) plus a shrinking ring. Beeps at the end via Web Audio (no audio files). The browser needs one tap before it will play sound; the timer start tap covers that.
- Big-event countdown bar: any calendar event with `#countdown` in its description shows as "N days until X". For big things only.
- Events: no dedicated kid calendar. Rule (to refine later): an event is shown if it falls on a home day, per the schedule pattern.
- Schedule-aware: config holds which days are home days; on "away" days the board shows a quiet away state instead of routines.
- Weather, stupid simple: one icon, current temp, one short phrase ("Maybe rain", "Snow", "Cold"). Mapped from Open-Meteo weather code and precip chance. No forecast, no details.
- No random facts, messages, or other extras. Big type, dark, minimal text.

## Personal homepage (`/home`)

- Top 3 from Todoist (read, with check-off). No full task dashboard.
- Calendar: next 7 days from ICS feeds.
- Year roadmap: month-by-month seasonal items, editable in the browser.
- Trip planning calendar: "when to think about booking" items (cabins, vacations), editable in the browser.
- Links to wiki pages.

## Wiki (`/wiki`)

- Markdown files in the server's data folder, rendered to HTML for reading. Raw Markdown is never shown unless you hit Edit.
- Edit page: textarea with live preview. Save writes the file.
- Small pages stay Markdown. Structured lists (roadmap, trips) live in the database, not Markdown.

## Data and secrets

| What | Where | In git? |
|---|---|---|
| App code | repo | yes |
| `config.example.json`, `.env.example` | repo | yes (fake values) |
| `.env` (Todoist token, ICS URLs, passwords) | server only | no |
| `config.json` (kid name, routines, times, home-day pattern) | server only | no |
| `data/` (SQLite DB, wiki pages, checkmarks) | server only | no |

- Storage: SQLite via Node's built-in `node:sqlite` (Node 22.13+). No ORM. Wiki pages as files in `data/wiki/`.
- ICS: Google Calendar's "secret address in iCal format". Not public; anyone with the URL can read it, so it lives only in `.env`. Server fetches every 15 min and caches. No OAuth, no tokens to refresh, no Claude in the loop.
- A pre-commit check script scans staged files for secrets and names on a local blocklist (`.blocklist`, gitignored).
- Fresh repo, so there's no history to clean.

## Security

- LAN only. Bind to the LAN interface; Windows firewall allows the port on the Private profile only.
- `/kid` open (read-mostly, tablet in kiosk).
- `/home`, `/wiki` edit, `/amp`: password gate (session cookie, password hash in `.env`). Anyone on the Wi-Fi could otherwise read the calendar and tasks.
- No HTTPS on LAN for now. Revisit if anything is ever exposed.

## Machines and deploy

- Dev: any dev machine. Push to GitHub.
- Run: home server (Windows 10, Node 24). `git pull` then restart the service. NSSM runs `node server.js` as a Windows service.
- Optional: `scripts/deploy.ps1` on the server to pull and restart in one step.

## Tablet

- Old Kindle Fire running Fully Kiosk Browser (flashing/setup TBD). Keeps screen on, auto-launches URL, locks to the page.
- No write access to calendars or tasks from the tablet. Only routine checkmarks and the timer.
- Frontend JS stays conservative (no newest syntax) so old Fire WebViews work.

## Stack rules

- Node (CommonJS), Express, vanilla HTML/CSS/JS, CSS Grid, dark default. No build step.
- Dependencies: `express` only, plus one small Markdown renderer (vendored `marked` single file) if writing our own isn't worth it.
- Remove `googleapis` and the OAuth stubs.

## Phases

- **P0 Foundation:** git init, secrets layout, config loader, SQLite setup, shared theme, NSSM service, pre-commit check, README rewrite. Code done; first commit, GitHub push, and server install pending.
- **P1 Kid board:** routines from config, server checkmarks, countdown rings, visual timer with beep, simple weather, ICS events filtered by home days, `#countdown` bar, away state.
- **P2 Homepage:** Top 3 from Todoist, 7-day calendar, password gate.
- **P3 Editable data:** roadmap and trip planning tables with browser edit forms; port the existing roadmap content.
- **P4 Wiki:** render, edit, page list.
- **P5 (v2) AMP:** test against real AMP, port parsing from the separate AMP launcher project, host stats.
- **Later:** media page, tablet hardening.

## Open questions

1. ~~Top 3 source~~ Resolved: a saved Todoist filter. Server runs the filter query (`TODOIST_TOP3_QUERY` in `.env`) against Todoist's tasks-by-filter endpoint. The morning Claude run stays the only thing that sets the Top 3.
2. ~~Server Node version~~ Resolved: Node 24, git installed.
3. Which ICS calendars to pull from (kid board filters by home days; homepage shows all).

## Out of scope (decided)

Voice announcements, Notion, random facts, dedicated kid calendar, tablet write access to calendar/tasks, Google OAuth.
