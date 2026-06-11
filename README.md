# Music Widget

[![CI](https://github.com/oyuh/music-widget/actions/workflows/ci.yml/badge.svg)](https://github.com/oyuh/music-widget/actions/workflows/ci.yml)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
[![License](https://img.shields.io/badge/license-source--available-blue)](#license)

Music Widget is a TypeScript monorepo for a Last.fm now-playing overlay, meant to sit in a stream as an OBS/Streamlabs/XSplit browser source. It includes a SvelteKit editor + widget SPA, a Bun/Hono API, and a local Redis + Postgres development stack. You build the overlay in a drag-and-drop editor, copy the resulting URL, and drop it into your scene. The whole design lives in the URL, so there is no account and nothing to save on a server.

Live links:

- Web app: [fast.jamlog.lol](https://fast.jamlog.lol)

## Contents

- [Music Widget](#music-widget)
  - [Contents](#contents)
  - [How It Works](#how-it-works)
    - [The Editor](#the-editor)
    - [The Widget URL](#the-widget-url)
    - [Layout Engines](#layout-engines)
    - [Polling and Progress](#polling-and-progress)
    - [Browser-Direct Last.fm Calls](#browser-direct-lastfm-calls)
  - [Repository Layout](#repository-layout)
  - [Architecture](#architecture)
    - [Web App: `apps/web`](#web-app-appsweb)
    - [Server App: `apps/server`](#server-app-appsserver)
  - [Local Development](#local-development)
    - [Prerequisites](#prerequisites)
    - [Quick Start](#quick-start)
  - [Environment Variables](#environment-variables)
  - [Common Commands](#common-commands)
  - [API Surface](#api-surface)
  - [Deployment](#deployment)
    - [Railway](#railway)
    - [Database Migrations](#database-migrations)
  - [Operational Notes](#operational-notes)
    - [Caching](#caching)
    - [Rate Limiting](#rate-limiting)
    - [Image Proxy](#image-proxy)
    - [Fail-Open Services](#fail-open-services)
  - [Known Constraints](#known-constraints)
  - [License](#license)

## How It Works

### The Editor

The editor (`/`) is a canvas where you place and style the pieces of the widget: album art, title, artist, album, a progress bar, and an elapsed/remaining duration readout. You can drag elements around, resize them, snap them to each other, set per-element fonts, colors, and shadows, and pick a switch animation for when the track changes. State autosaves to `localStorage` as you go.

### The Widget URL

When you are happy with the design, the entire config is serialized to JSON, base64url-encoded, and stuffed into the widget URL's hash (`/w#<blob>`). The widget page (`/w`) reads that hash back, polls Last.fm for the user's current track, and renders. Because everything is in the hash, the URL is the document: copy it, share it, paste it into OBS, done.

### Layout Engines

There are two layout engines. The original (`version: 1`) is a fixed grid. The current one (`version: 2`) is free positioning: every element has an `x/y/w/h`, a z-index, and optional snap relationships to other elements. The `version` flag in the encoded config decides which renderer (`WidgetLegacy.svelte` / `WidgetV2.svelte`) runs, and a `migrateToV2` step converts an old grid design into the equivalent free layout so nothing breaks. See [config.ts](apps/web/src/lib/config.ts) for the full shape.

### Polling and Progress

Last.fm does not push, so the widget polls `user.getRecentTracks` and watches the `nowplaying` flag. The interval adapts to how active the page is and whether a track just changed: 2.5s right after a song change, 5s while something is playing, backing off to 10s and then 20s once the tab has been idle for a couple minutes ([nowplaying.svelte.ts](apps/web/src/lib/nowplaying.svelte.ts)). Between polls the progress bar is ticked locally from the track's reported duration, with pause detection and a resume-position estimate so the bar does not sit frozen or jump around.

### Browser-Direct Last.fm Calls

Last.fm rate-limits roughly 5 requests/sec per IP. If every viewer's widget fetched through the server, all of them would share the server's one IP and get throttled the moment a streamer with any audience went live. So public lookups (recent tracks, track info) fire directly from each viewer's browser to `ws.audioscrobbler.com` ([lastfm-client.ts](apps/web/src/lib/lastfm-client.ts)), and every viewer spends their own per-IP budget. Album art and color extraction load straight from Last.fm's CDN the same way (it sends `Access-Control-Allow-Origin: *`). If a direct call fails on the transport level (network/CORS), it falls back to the server proxy.

Private profiles are the exception. A hidden listening profile has to be requested with a signed call, and the signature needs the Last.fm shared secret, which never leaves the server. Those requests always go through `/api/lastfm/*`, which signs them server-side ([lastfm.ts](apps/server/src/lastfm.ts)).

## Repository Layout

```text
.
+-- apps/
|   +-- web/                # SvelteKit SPA: editor (/), widget (/w), auth callback (/callback)
|   +-- server/             # Bun/Hono API, serves the built SPA, talks to Redis + Postgres
+-- scripts/                # cron cleanup helper
+-- tests/                  # unit tests
+-- docker-compose.dev.yml  # local Redis + Postgres stack
+-- Dockerfile              # production image: builds the SPA, starts the Hono server
+-- railway.json            # Railway deployment config
+-- drizzle.config.ts       # Drizzle Kit migration config
+-- package.json            # Bun workspace scripts
```

## Architecture

### Web App: `apps/web`

The web app is a SvelteKit single-page application built with `adapter-static` (pure SPA, CSR only), Svelte 5 runes, and Tailwind v4.

Main responsibilities:

- The drag-and-drop editor, presets, and per-element styling.
- Encoding/decoding the widget config to and from the URL hash.
- Polling Last.fm browser-direct and rendering the widget.
- The Last.fm auth callback for private-profile sessions.

Key files:

- [apps/web/src/lib/config.ts](apps/web/src/lib/config.ts)
- [apps/web/src/lib/editor.svelte.ts](apps/web/src/lib/editor.svelte.ts)
- [apps/web/src/lib/nowplaying.svelte.ts](apps/web/src/lib/nowplaying.svelte.ts)
- [apps/web/src/lib/lastfm-client.ts](apps/web/src/lib/lastfm-client.ts)
- [apps/web/src/lib/WidgetLegacy.svelte](apps/web/src/lib/WidgetLegacy.svelte) / [WidgetV2.svelte](apps/web/src/lib/WidgetV2.svelte)

### Server App: `apps/server`

The server is a Bun-powered Hono service. In production it serves both the static build and the API on a single port; in dev, Vite serves the UI and proxies `/api` to it. Redis (`Bun.redis`) is a small cache in front of the signed/proxied Last.fm paths, and Postgres (Drizzle, `drizzle-orm/bun-sql`) backs optional usage analytics and contact emails.

Main responsibilities:

- Signed Last.fm calls for private profiles and the browser-direct fallback proxy.
- Exchanging Last.fm auth tokens for session keys.
- A host-allowlisted album-art image proxy.
- Fire-and-forget visitor logging and contact storage.
- Per-IP rate limiting and visitor-log cleanup.

Key files:

- [apps/server/src/index.ts](apps/server/src/index.ts)
- [apps/server/src/lastfm.ts](apps/server/src/lastfm.ts)
- [apps/server/src/security.ts](apps/server/src/security.ts)
- [apps/server/src/schema.ts](apps/server/src/schema.ts)

## Local Development

### Prerequisites

- Bun 1.3.x or newer
- Docker (optional, for local Redis + Postgres — both fail open without it)

### Quick Start

```bash
bun install
bun run services:up   # Redis + Postgres in Docker (optional)
bun run dev           # Vite UI on :5173, Hono API on :8787
```

Then open `http://localhost:5173`.

## Environment Variables

Config is read from a repo-root `.env` (server) and `.env.local` (frontend `VITE_*` values). Copy [.env.example](.env.example) to start.

| Variable | Side | Purpose |
|----------|------|---------|
| `LFM_API_KEY` / `LFM_SHARED_SECRET` | server | Last.fm credentials (the secret signs private/proxied calls) |
| `REDIS_URL` | server | cache + rate-limit store; unset = no cache, no limiting |
| `DATABASE_URL` | server | Postgres for the visitor log + contacts; unset = off |
| `CRON_SECRET` | server | bearer token guarding `POST /api/cron/cleanup`; unset = route disabled |
| `PORT` / `LOG_LEVEL` | server | bind port / log verbosity |
| `VITE_LFM_KEY` | frontend (build) | public Last.fm key used for the browser-direct calls |
| `VITE_LFM_CALLBACK` | frontend (build) | Last.fm auth callback URL |

## Common Commands

Run from the repository root.

| Command | Purpose |
|---------|---------|
| `bun run dev` | Vite UI + Hono API together (Vite proxies `/api`) |
| `bun run build` | Build the SvelteKit SPA |
| `bun run typecheck` | Typecheck all workspaces |
| `bun test` | Run unit tests |
| `bun run services:up` / `services:down` | Local Redis + Postgres in Docker |
| `bun run db:generate` | Generate Drizzle migrations from the schema |
| `bun run db:migrate` | Apply Drizzle migrations |
| `bun run cron:cleanup` | Run visitor-log housekeeping by hand |

## API Surface

Everything lives under `/api`. The Last.fm routes exist mostly as the fallback and the signed path for private profiles; the common case never touches them.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/ping` | Liveness; always 200 while the process is up |
| `GET /api/health` | Reports Redis (and informational Postgres) status; may 503 if Redis is configured but down |
| `GET /api/lastfm/recent`, `/trackInfo` | Signed/cached proxy, used for private profiles and as the browser-direct fallback |
| `POST /api/lastfm/session` | Exchange a Last.fm auth token for a session key (signed) |
| `GET /api/proxy-image` | Album-art fetch fallback; host-allowlisted |
| `POST /api/log/widget` | Fire-and-forget visitor log, one row per visitor (fail-open) |
| `POST /api/contact` | Store a contact email against a Last.fm username |
| `POST /api/cron/cleanup` | Visitor-log housekeeping (dedupe + prune); requires `CRON_SECRET` |
| `GET /robots.txt`, `/sitemap.xml` | The usual |

## Deployment

### Railway

It ships as one Railway service plus the Redis and Postgres plugins. The `Dockerfile` builds the SPA and starts the Hono server, which serves both.

1. Point Railway at the repo and add the **Redis** and **Postgres** plugins.
2. Set the service variables: `LFM_API_KEY`, `LFM_SHARED_SECRET`, `REDIS_URL=${{Redis.REDIS_URL}}`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, plus the build-time `VITE_LFM_KEY` and `VITE_LFM_CALLBACK=https://<domain>/callback`.
3. Deploy. Drizzle migrations are applied on the server's first write, so there is no manual migrate step.

### Database Migrations

After changing [apps/server/src/schema.ts](apps/server/src/schema.ts), run `bun run db:generate` and commit the generated file under `apps/server/drizzle/`. To apply migrations by hand, point `DATABASE_URL` at the target and run `bun run db:migrate`.

## Operational Notes

### Caching

The proxy cache is short on purpose: recent-tracks responses live for 3 seconds, track-info for 24 hours.

### Rate Limiting

There is a lenient per-IP rate limit (60 requests / 10s, ~360/min) that normal polling never comes near; it only trips on abusive bursts, and it fails open when Redis is down ([security.ts](apps/server/src/security.ts)).

### Image Proxy

The image proxy is host-allowlisted (Last.fm/Spotify/Apple/etc. CDNs only) so it cannot be turned into an open SSRF proxy.

### Fail-Open Services

Redis and Postgres are both optional. If either is unreachable, the widget still serves; you just lose caching/rate limiting or visitor logging.

## Known Constraints

- The design lives entirely in the URL hash. There are no accounts and no server-side saves; losing the URL means losing the design (the editor keeps a `localStorage` autosave as a safety net).
- Public Last.fm calls go browser-direct by design. The server proxy is only the fallback and the signed path for private profiles.
- Last.fm does not push events, so "now playing" is always polled with a few seconds of latency.

## License

You may use, copy, and modify this for personal use, including self-hosting and streaming. You may **not** redistribute, republish, or pass it off as your own; commercial redistribution needs explicit permission. Contributions are welcome and credited, and contributing means you agree to these terms.

Questions or redistribution requests: [me@lawsonhart.me](mailto:me@lawsonhart.me).
