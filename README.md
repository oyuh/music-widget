# Fast Music — Last.fm Now-Playing Widget for Streaming

A customizable Last.fm "now playing" overlay for **OBS, Streamlabs, XSplit**, and
any software with a browser source — built around a visual, drag-and-drop editor.
Design your widget in the browser, copy a URL, and paste it into your scene.

**Live:** [fast.jamlog.lol](https://fast.jamlog.lol)

## Features

- **Visual editor** — click elements, drag to reposition, resize with handles,
  nudge with arrow keys, and tweak everything (fonts, colors, sizes, drop
  shadows, layout, progress bar) in a contextual inspector. Autosaves locally.
- **Portable design** — your entire design is encoded in the widget URL's hash,
  so the copied URL carries everything. Import/export and reusable presets too.
- **Scales to hundreds of viewers** — public Last.fm calls go **directly from
  each viewer's browser**, so every widget spends its own per-IP rate budget
  instead of funneling through one server IP (see *How it works* below).
- **Bring your own API key (BYOK)** for faster, fully isolated updates.
- **Private profiles** — connect via Last.fm auth to show a hidden listening
  profile (signed server-side).
- **Live progress** with smart polling, pause detection, and position estimation.
- **Transparent, OBS-ready** — no background, drops straight onto a scene.
- **"Add to stream" guide** — a built-in modal with per-platform browser-source
  setup steps and the recommended source size.
- **Desktop-only editor** — phones get a friendly gate (the editor needs a
  pointer + wide screen); the widget URL itself works anywhere, including OBS.
- **Service + Last.fm status** shown in the editor footer.

## How it works (and why it scales)

Last.fm rate-limits **~5 requests/sec per IP**. If every viewer's widget fetched
through the server, all of them would share the server's single IP and get
throttled. Instead:

- **Public** recent-tracks / track-info calls go **straight from the viewer's
  browser** to Last.fm (`apps/web/src/lib/lastfm-client.ts`). Album art + color
  extraction load from Last.fm's CDN directly (both send `Access-Control-Allow-Origin: *`).
  A network/CORS failure falls back to the server proxy.
- **Private** profiles must be signed with the Last.fm shared secret, which never
  leaves the server — those go through `/api/lastfm/*`.
- The server adds a small Redis cache (fail-open) and lenient per-IP rate
  limiting in front of the proxy/signed paths.

## Tech stack

- **Bun** monorepo (1.3+).
- **Frontend** (`apps/web`): SvelteKit SPA (`adapter-static`, CSR), Svelte 5
  runes, Tailwind v4.
- **Backend** (`apps/server`): Hono on Bun — serves the built SPA and `/api/*` on
  one port.
- **Redis** cache (`Bun.redis`) and **Postgres** via **Drizzle ORM**
  (`drizzle-orm/bun-sql`) for optional usage analytics + contact emails. Both are
  **fail-open** — if they're unreachable, the widget still serves.
- **Railway** for hosting (one app service + Redis + Postgres plugins).

```
apps/
  web/     SvelteKit SPA — editor (/), widget (/w), auth callback (/callback)
  server/  Hono + Bun — API, static SPA host, Redis, Postgres (Drizzle)
```

## Quick start (hosted app)

1. Make sure your player is **scrobbling to Last.fm**.
2. Open [fast.jamlog.lol](https://fast.jamlog.lol), enter your username, and
   design the widget.
3. Click **Copy URL**, then **Add to stream** for per-platform instructions.
4. In OBS/Streamlabs add a **Browser Source** (XSplit: **Web Page**), paste the
   URL, and set the size shown in the modal.

## Local development

Requires [Bun](https://bun.sh) 1.3+ and (optionally) Docker for Redis/Postgres.

```bash
bun install
bun run services:up   # local Redis + Postgres via Docker (optional)
bun run dev           # Vite UI on :5173, Hono API on :8787
```

Open <http://localhost:5173>. Env is read from the repo-root `.env` (server) and
`.env.local` (frontend `VITE_*`); copy [`.env.example`](.env.example) to start.

| Variable | Where | Purpose |
|---|---|---|
| `LFM_API_KEY` / `LFM_SHARED_SECRET` | server | Last.fm credentials (secret) |
| `REDIS_URL` | server | cache (fail-open; unset = no cache) |
| `DATABASE_URL` | server | Postgres for visitor log + contacts (fail-open; unset = off) |
| `CRON_SECRET` | server | bearer token guarding `POST /api/cron/cleanup` (unset = route off) |
| `PORT` / `LOG_LEVEL` | server | bind port / log verbosity |
| `VITE_LFM_KEY` | frontend (build) | public Last.fm key for browser calls |
| `VITE_LFM_CALLBACK` | frontend (build) | Last.fm auth callback URL |

## API

- `GET /api/ping` / `GET /api/health` — liveness / dependency status.
- `GET /api/lastfm/recent`, `/trackInfo` — proxy + cache (private/fallback).
- `POST /api/lastfm/session` — Last.fm token → session key (signed).
- `GET /api/proxy-image` — album-art proxy fallback (host-allowlisted).
- `POST /api/log/widget` — silent, fail-open visitor log (one row per visitor).
- `POST /api/contact` — store a contact email, linked to a Last.fm username.
- `POST /api/cron/cleanup` — scheduled visitor-log housekeeping (dedupe + prune); needs `CRON_SECRET`.
- `GET /robots.txt`, `/sitemap.xml`.

## Deploying (Railway)

Deploys as **one service** (the `Dockerfile` builds the SPA and runs the Hono
server) plus **Redis** and **Postgres** plugins.

1. Point Railway at the repo; add **Redis** and **Postgres** plugins.
2. Set service variables: `LFM_API_KEY`, `LFM_SHARED_SECRET`,
   `REDIS_URL=${{Redis.REDIS_URL}}`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`,
   and the build-time `VITE_LFM_KEY` / `VITE_LFM_CALLBACK=https://<domain>/callback`.
3. Deploy. Postgres tables are created by **Drizzle migrations applied
   automatically on the server's first write** — no manual step.

After changing `apps/server/src/schema.ts`, run `bun run db:generate` and commit
the new file in `apps/server/drizzle/`. To apply migrations manually, point
`DATABASE_URL` at the target and run `bun run db:migrate`.

## Scripts

| Script | Does |
|---|---|
| `bun run dev` | Vite UI + Hono API (with proxy) |
| `bun run build` | build the SvelteKit SPA |
| `bun test` | unit tests |
| `bun run services:up` / `services:down` | local Redis + Postgres (Docker) |
| `bun run db:generate` / `db:migrate` | generate / apply Drizzle migrations |

## License

Permission is granted to use, copy, and modify this software for personal use,
including local hosting and streaming integration.

**Restrictions:**
- You may NOT redistribute, publish, or claim this code as your own.
- Commercial redistribution requires explicit permission from the author.
- Contact the author for redistribution rights.

**Contributions** are welcome and credited; by contributing you agree to these terms.

[**Email me**](mailto:me@lawsonhart.me)
