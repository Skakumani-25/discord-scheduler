# VC Scheduler

A web app for planning Discord voice chat sessions. People log in with Discord, mark when they're free, see when their group overlaps, schedule sessions with RSVPs, and get a reminder from a Discord bot before a session starts.

**Live:** https://discord-scheduling.duckdns.org (the old address, https://skakumani-scheduler.duckdns.org, redirects there)

## Screenshots

> Add screenshots here before submitting, e.g. `docs/screenshots/availability.png`.

| Availability calendar | Group sessions | Find a time |
| --- | --- | --- |
| _screenshot_ | _screenshot_ | _screenshot_ |

| Members and presence | Discord servers | Mobile |
| --- | --- | --- |
| _screenshot_ | _screenshot_ | _screenshot_ |

## Features

- **Discord login** (OAuth2, `identify` + `guilds` scopes). Sessions use an httpOnly JWT cookie.
- **Weekly availability calendar**: drag across the grid (or tap start and end on touch screens) to add time by category (Gaming, Studying, Talking, Movie, Other). Optional weekly repeat for up to 12 weeks, created in one request and kept at the same local time across daylight-saving changes. An exact date/time form covers blocks that cross midnight.
- **Status**: Available, Busy, Away or Do not disturb, with an optional note and auto-clear. Shown to everyone in your groups without needing a time block.
- **Groups**
  - *Custom groups* joined with an invite code.
  - *Discord server groups* created from a server the bot is in. Membership is verified with Discord, not trusted from the browser.
- **Find a time**: shared free windows for any subset of members, by category and minimum length, highlighted on a group calendar with one column per member.
- **Sessions** with Going / Maybe / Can't go RSVPs, counts, an optional voice channel (server groups) and an "Open in Discord" link.
- **Discord bot** (runs in the same process as the API)
  - DM reminders before sessions, at each user's chosen lead time. Each reminder is claimed atomically so it's never sent twice. Falls back to the group's announcement channel when DMs are closed.
  - Announces new sessions in the group's announcement channel.
  - Live presence (online, idle, do not disturb, offline) next to member names, which each user can hide.
- **Settings**: timezone (all times are stored in UTC and shown in yours), reminder lead time, presence visibility.
- **Accessible, responsive UI**: dark theme with design tokens, keyboard navigation, visible focus, labelled forms, no color-only status, tested at 375 to 1440px. See [docs/ui-design-rules.md](docs/ui-design-rules.md).

## Tech stack

| Area | Technology |
| --- | --- |
| Front end | React 19, Vite, TypeScript, plain CSS with design tokens, lucide-react icons, self-hosted Inter |
| API | Node 22, Express 5, TypeScript, helmet, express-rate-limit |
| Data | PostgreSQL 16, Prisma 6 |
| Discord | discord.js 14 (bot), Discord OAuth2 and REST API |
| Scheduling | node-cron (reminder scheduler, every minute) |
| Tests | Vitest (server: services, routes, middleware, bot) |
| Hosting | Docker Compose on AWS EC2: app + Postgres + Caddy (automatic HTTPS) |
| CI/CD | GitHub Actions |

## Architecture

```mermaid
flowchart LR
    Browser["Browser<br/>React SPA"] -- HTTPS --> Caddy

    subgraph EC2["AWS EC2 · Docker Compose"]
        Caddy["Caddy<br/>TLS + reverse proxy"]
        subgraph App["app container"]
            API["Express API<br/>/api, /auth"]
            Bot["Discord bot<br/>discord.js"]
            Cron["Reminder scheduler<br/>node-cron"]
        end
        DB[("PostgreSQL<br/>Prisma")]
    end

    Caddy --> API
    API --- Bot
    Cron --> Bot
    API --> DB
    Cron --> DB
    API -- "OAuth2 + user guilds" --> DiscordAPI["Discord REST API"]
    Bot -- "DMs, announcements" --> DiscordAPI
    Bot <-- "Gateway: guilds, members,<br/>presence, voice states" --> Gateway["Discord Gateway"]
    GH["GitHub Actions<br/>CI then deploy"] -- "SSH: git pull,<br/>docker compose up" --> EC2
```

- In production Express also serves the built React app; unknown `/api` routes return JSON 404s.
- The bot shares the API's process so routes can check membership, permissions and channels using the bot's cache and REST client. The app still runs without a bot token; Discord-dependent features then return `503`.

## Data model

| Model | Purpose |
| --- | --- |
| `User` | Discord identity, timezone, reminder lead time, status (+ note, expiry), presence visibility, encrypted Discord OAuth token (never returned by the API) |
| `AvailabilityBlock` | A user's free time: category, start, end, optional note |
| `Group` | `CUSTOM` (invite code) or `DISCORD_SERVER` (linked guild id), optional announcement channel |
| `GroupMember` | User in a group with role `OWNER` or `MEMBER` (unique per group and user) |
| `Event` | A session in a group: title, category, times, description, optional voice channel |
| `EventRsvp` | `GOING`, `MAYBE` or `NOT_GOING` per user and event |
| `MeetingChannel` | Voice channels a server group allows sessions to use |
| `Reminder` | Pending/sent reminder per user and event (`sentAt` null until a scheduler run claims it) |

Deleting a user, group or event cascades to the rows that depend on it.

## Local setup (Windows)

Prerequisites: [Node.js 22](https://nodejs.org), [Docker Desktop](https://www.docker.com/products/docker-desktop/), Git. Commands are for PowerShell; run them one line at a time.

1. **Start Postgres** in Docker:
   ```powershell
   docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=scheduler -p 5432:5432 postgres:16
   ```
2. **Create a Discord application** at https://discord.com/developers/applications (see [Discord setup](#discord-developer-portal-settings)). Add the redirect `http://localhost:3000/auth/discord/callback`.
3. **Configure the server**:
   ```powershell
   Copy-Item .env.example server\.env
   notepad server\.env
   ```
   Fill in the values (see [environment variables](#environment-variables)). For the database above:
   `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scheduler?schema=public`
4. **Install, migrate and start the API** (port 3000):
   ```powershell
   cd server
   npm install
   npx prisma migrate deploy
   npm run dev
   ```
5. **Start the front end** in a second terminal (port 5173; it proxies `/api` and `/auth` to port 3000):
   ```powershell
   cd client
   npm install
   npm run dev
   ```
6. Open http://localhost:5173 and log in with Discord.

Checks: `npm test` and `npm run build` in `server/`, and `npm run build` and `npm run lint` in `client/`.

## Environment variables

Copy [.env.example](.env.example). Locally it goes in `server/.env`. On the production server it goes in `.env` in the repository root, where `docker-compose.yml` reads it.

| Variable | Purpose |
| --- | --- |
| `DISCORD_CLIENT_ID` | Discord application ID; used for OAuth and the bot invite link |
| `DISCORD_CLIENT_SECRET` | OAuth client secret for exchanging the login code |
| `DISCORD_BOT_TOKEN` | Bot login token. Optional; without it the bot and reminders don't start |
| `DISCORD_REDIRECT_URI` | OAuth callback URL; must match a redirect in the Developer Portal |
| `DATABASE_URL` | PostgreSQL connection string (local development; Compose builds it in production) |
| `POSTGRES_PASSWORD` | Password for the Compose Postgres container (production) |
| `JWT_SECRET` | Signs the login cookie |
| `TOKEN_ENCRYPTION_KEY` | Encrypts stored Discord OAuth tokens (AES-256-GCM). Falls back to a key derived from `JWT_SECRET` |
| `CLIENT_URL` | Where users land after logging in; also linked from bot announcements |
| `PORT` | API port, default `3000` (optional) |
| `NODE_ENV` | Set to `production` by Compose: serves the built client, enables secure cookies and proxy trust |

## CI/CD

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every push to `main` and on pull requests:
  1. Server: `npm ci`, `prisma generate`, `npm run build`, `npm test`
  2. Client: `npm ci`, `npm run build`, `npm run lint`
- **Deploy** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs after CI succeeds on `main`. It SSHes into the EC2 instance and runs `git pull` and `docker compose up -d --build`.
- **On startup** the app container runs `prisma migrate deploy`, then starts the API and bot. Compose waits for Postgres to be healthy first, and every service restarts automatically.
- **HTTPS**: Caddy obtains and renews certificates for the domain in the [Caddyfile](Caddyfile).
- **After changing the Caddyfile or the server's `.env`**, run `docker compose up -d --force-recreate app caddy` on the server, because a normal deploy doesn't reload them.

## Discord bot

### Inviting the bot

Use **Servers → Invite the bot** in the app. The link is built from `DISCORD_CLIENT_ID` by `GET /api/discord/invite-url` and requests:

- Scopes: `bot` and `applications.commands` (no slash commands are registered yet)
- Permissions: View Channels, Send Messages, Connect (permission integer `1051648`)

After inviting it, select **Refresh** on the Servers page, then **Create group** for that server. Other members of the server join it from the same page.

### Discord Developer Portal settings

- **Bot → Privileged Gateway Intents**: enable **Server Members Intent** and **Presence Intent**. Without them Discord rejects the bot's login, which also stops reminders. Message Content Intent is not needed.
- **Bot → Public Bot**: on, if people other than the app owner should be able to invite it. Leave **Requires OAuth2 Code Grant** off.
- **OAuth2 → Redirects**: add the exact callback for each environment:
  - `http://localhost:3000/auth/discord/callback`
  - `https://discord-scheduling.duckdns.org/auth/discord/callback`
- The login flow requests the `identify` and `guilds` scopes.

## Security

- **Access control**: every group endpoint checks membership, and admin actions check the owner role or Manage Server.
- **Cookies**: the login cookie is httpOnly, `SameSite=Lax`, and secure in production. The OAuth `state` parameter is required and checked.
- **Discord tokens** are encrypted at rest and never returned by the API or logged.
- **Headers**: helmet sets security headers, including a CSP that only allows Discord's CDN for images.
- **Rate limits**: 30 requests per 15 minutes per IP on `/auth`, and 300 writes per 15 minutes per user (or IP when signed out) on `/api`.
- **Errors**: all errors return JSON. Server errors are logged without request query strings or database query details.

## Known limitations

- **No group DM import.** Discord doesn't let bots read group DMs, so friends outside a shared server use a custom group with an invite code.
- **Invisible users appear offline.** Discord reports Invisible exactly like Offline.
- **Large servers:** in servers with more than 1,000 members, offline members may show as "unknown" because the full member list isn't cached.
- **Server membership is checked when joining.** Leaving the Discord server doesn't remove someone from its group, and there's no "leave group" or "delete group" yet.
- **Discord sign-in expires after about 7 days** (no refresh token is stored). Users are asked to log in again to list their servers.
- **Reminders are sent at most once.** If both the DM and the announcement channel fail, the reminder is logged and not retried.
- **Session times can only be changed through the API** (`PATCH /api/events/:id`); there's no edit form yet.
- **The group calendar only shows upcoming availability**, so earlier weeks are empty.
- **Keyboard users** add availability with the exact date/time form; selecting on the calendar grid needs a mouse or touch.
- **Rate limits are kept in memory**, which suits the single-server deployment but resets on restart.
