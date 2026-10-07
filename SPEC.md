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

- Schedule = chunks (config): start, end, label, color, 0 to 3 checklist items. Only the current chunk shows.
- One countdown ring to the end of the current chunk; beeps at zero. Between chunks it counts down to the next timed calendar event today (ring full until the last hour).
- Analog clock with colored arcs for the current half-day's chunks; hour hand sweeps over them.
- Checkmarks saved on the server per chunk per day.
- Sleep screen before `wake` and after the last chunk.
- Calendar (one private iCal feed, `KID_ICS_URL`): all-day marker events decide home vs away days and no-school days (`calendarMarkers` in config). Other events today form the "Today" list. Events with `#countdown` in the description show "N days until X".
- Away days: no routines, just clock, weather, and the day's events.
- Weather: icon, temp, one short phrase.
- No random facts, messages, or other extras.

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
- `/home`, `/wiki`, `/amp`: open by default. Optional PIN (`PARENT_PIN_HASH`); a correct PIN sets a 10-year cookie so devices never re-login. Tradeoff accepted: anyone on the Wi-Fi can read calendar and tasks.
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
- Dependencies: `express`, `ical.js` (recurring calendar events). Possibly one small Markdown renderer for the wiki.
- Remove `googleapis` and the OAuth stubs.

## Phases

- **P0 Foundation:** git init, secrets layout, config loader, SQLite setup, shared theme, NSSM service, pre-commit check, README rewrite. Done: running on the server as a service.
- **P1 Kid board:** chunk schedule, analog clock, single countdown with beep, simple weather, calendar feed with home/away/no-school markers, Today list, `#countdown`. Built; deploy pending.
- **P2 Homepage:** Top 3 from Todoist, 7-day calendar.
- **P3 Editable data:** roadmap and trip planning tables with browser edit forms; port the existing roadmap content.
- **P4 Wiki:** render, edit, page list.
- **P5 (v2) AMP:** test against real AMP, port parsing from the separate AMP launcher project, host stats.
- **Later:** media page, tablet hardening.

## Open questions

1. ~~Top 3 source~~ Resolved: a saved Todoist filter. Server runs the filter query (`TODOIST_TOP3_QUERY` in `.env`) against Todoist's tasks-by-filter endpoint. The morning Claude run stays the only thing that sets the Top 3.
2. ~~Server Node version~~ Resolved: Node 24, git installed.
3. ~~Kid calendar~~ Resolved: one dedicated kid calendar feed with all-day home/away/no-school marker events.

## Out of scope (decided)

Voice announcements, Notion, random facts, tablet write access to calendar/tasks, Google OAuth.
