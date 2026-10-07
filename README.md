# HomeDash

Self-hosted home dashboard for a Windows home server on a trusted LAN.

- `/kid`: touch-first routine board for a wall tablet (open)
- `/home`: personal homepage for the household computers (optional PIN)
- `/amp`: game server status (optional PIN, v2)

Node.js + Express, vanilla HTML/CSS/JS, SQLite via built-in `node:sqlite`. No build step. See `SPEC.md` for scope and phases.

## Personal data stays out of git

| File | Purpose | Committed |
|---|---|---|
| `.env` | tokens, passwords, calendar URLs | never |
| `config.json` | names, routines, times, location | never |
| `data/` | SQLite database, wiki pages | never |
| `.blocklist` | personal words the pre-commit check rejects | never |
| `*.example*` | templates with fake values | yes |

After cloning, enable the pre-commit check once:

```
npm run setup-hooks
```

`npm run check` scans every file on demand.

## Server setup (Windows 10)

Requires Node 22.13+ and git.

1. Clone and install:
   ```
   git clone <repo-url> D:\Projects\HomeDash
   cd D:\Projects\HomeDash
   npm ci --omit=dev
   ```
2. Copy `.env.example` to `.env` and `config.example.json` to `config.json`, then fill them in.
   - Optional: `npm run hash-pin` prints a `PARENT_PIN_HASH` line. Blank means no PIN.
3. Test: `npm start`, then open `http://localhost:3000` on the server.
4. Allow LAN access (admin PowerShell, Private network profile only):
   ```
   New-NetFirewallRule -DisplayName "HomeDash" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow
   ```
5. Run as a service with NSSM (admin PowerShell):
   ```
   winget install NSSM.NSSM
   nssm install HomeDash "C:\Program Files\nodejs\node.exe" server.js
   nssm set HomeDash AppDirectory D:\Projects\HomeDash
   nssm set HomeDash AppStdout D:\Projects\HomeDash\data\service.log
   nssm set HomeDash AppStderr D:\Projects\HomeDash\data\service.log
   nssm start HomeDash
   ```
6. Reserve the server's IP in the router so the tablet URL never changes.

## Updating the server

From the repo folder in admin PowerShell: `.\scripts\deploy.ps1` (git pull, npm ci, restart service).

## Tablet

Fully Kiosk Browser pointed at `http://SERVER_IP:3000/kid`. Keep screen on while charging.

## Security notes

LAN only, plain HTTP. Parent pages are open unless a PIN is set; a correct PIN sets a signed 10-year cookie. Do not expose the port to the internet.
