# Music Widget

[![CI](https://github.com/oyuh/music-widget/actions/workflows/ci.yml/badge.svg)](https://github.com/oyuh/music-widget/actions/workflows/ci.yml)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
[![License](https://img.shields.io/badge/license-source--available-blue)](#license)

Music Widget is a Last.fm now-playing overlay for your stream. It sits in OBS (or Streamlabs, or XSplit) as a browser source and shows whatever you're listening to. Under the hood it's a TypeScript monorepo: a SvelteKit editor + widget SPA, a Bun/Hono API, and a local Redis + Postgres dev stack. You build the overlay in a drag-and-drop editor, copy the URL it gives you, and paste that into your scene. The whole design lives inside the URL itself, so there's no account to make and nothing saved on a server.

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

The editor (`/`) is a canvas where you lay out the pieces of the widget: album art, title, artist, album, a progress bar, and an elapsed/remaining time readout. Drag things around, resize them, snap them to each other, give each element its own font, colors, and shadow, and pick an animation for when the track switches. Everything autosaves to `localStorage` as you go, so you can close the tab without losing your work.

### The Widget URL

Happy with the design? The whole config gets serialized to JSON, base64url-encoded, and packed into the widget URL's hash (`/w#<blob>`). The widget page (`/w`) reads that hash back out, polls Last.fm for your current track, and renders. Since everything lives in the hash, the URL literally is the document: copy it, share it, paste it into OBS, done.

### Layout Engines

There are two layout engines. The original (`version: 1`) is a fixed grid. The current one (`version: 2`) is free positioning: every element gets an `x/y/w/h`, a z-index, and optional snap relationships to other elements. The `version` flag in the encoded config decides which renderer runs (`WidgetLegacy.svelte` vs `WidgetV2.svelte`), and a `migrateToV2` step converts old grid designs into the equivalent free layout so nothing breaks. The full config shape is in [config.ts](apps/web/src/lib/config.ts).

### Polling and Progress

Last.fm doesn't push updates, so the widget polls `user.getRecentTracks` and watches the `nowplaying` flag. Because every widget polls from its viewer's own IP (see below), the cadence is a flat 1 second whether something is playing or not, so track changes, pauses, and playback starting all show up within about a second ([nowplaying.svelte.ts](apps/web/src/lib/nowplaying.svelte.ts)). The only backoff is a hidden tab (5s), which OBS browser sources never hit since they always report as visible. Between polls the progress bar ticks along locally using the track's reported duration, with pause detection and a resume-position estimate so the bar doesn't freeze up or jump around.

### Browser-Direct Last.fm Calls

Last.fm rate-limits at roughly 5 requests per second per IP. If every viewer's widget fetched through the server, they'd all be sharing the server's single IP, and the moment a streamer with any real audience went live, everyone would get throttled. So public lookups (recent tracks, track info) go straight from each viewer's browser to `ws.audioscrobbler.com` ([lastfm-client.ts](apps/web/src/lib/lastfm-client.ts)), and each viewer spends their own per-IP budget. Album art and color extraction load directly from Last.fm's CDN the same way (it sends `Access-Control-Allow-Origin: *`). If a direct call fails at the transport level (network/CORS), it falls back to the server proxy.

Private profiles go browser-direct too, with one extra step. A hidden listening profile has to be requested with a signed call, and the signature needs the Last.fm shared secret, which never leaves the server. But Last.fm signatures carry no timestamp or nonce, so the server only needs to sign the recent-tracks URL once (`GET /api/lastfm/sign-recent`) and the browser then reuses that pre-signed URL for every poll, straight against Last.fm from the viewer's own IP ([lastfm.ts](apps/server/src/lastfm.ts)). The signed proxy routes stick around as the fallback if signing or the direct call fails.

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

What it handles:

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

The server is a Bun-powered Hono service. In production it serves both the static build and the API on one port; in dev, Vite serves the UI and proxies `/api` over to it. Redis (`Bun.redis`) acts as a small cache in front of the signed/proxied Last.fm paths, and Postgres (Drizzle, `drizzle-orm/bun-sql`) backs the optional usage analytics and contact emails.

What it handles:

- One-time signing of private-profile poll URLs, plus the fallback proxy for browser-direct calls.
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
- Docker (optional, for local Redis + Postgres; both fail open without it)

### Quick Start

```bash
bun install
bun run services:up   # Redis + Postgres in Docker (optional)
bun run dev           # Vite UI on :5173, Hono API on :8787
```

Then open `http://localhost:5173`.

## Environment Variables

Config is read from a repo-root `.env` (server) and `.env.local` (frontend `VITE_*` values). Copy [.env.example](.env.example) to get started.

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

Run these from the repository root.

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

Everything lives under `/api`. The Last.fm proxy routes mostly exist as the fallback; the common case (public and private alike) polls Last.fm directly and never touches them.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/ping` | Liveness; always 200 while the process is up |
| `GET /api/health` | Reports Redis (and informational Postgres) status; may 503 if Redis is configured but down |
| `GET /api/lastfm/recent`, `/trackInfo` | Signed/cached proxy, the fallback when browser-direct calls fail |
| `GET /api/lastfm/sign-recent` | Signs a private-profile recent-tracks URL once; the browser then polls Last.fm directly with it |
| `POST /api/lastfm/session` | Exchange a Last.fm auth token for a session key (signed) |
| `GET /api/proxy-image` | Album-art fetch fallback; host-allowlisted |
| `POST /api/log/widget` | Fire-and-forget visitor log, one row per visitor (fail-open) |
| `POST /api/contact` | Store a contact email against a Last.fm username |
| `POST /api/cron/cleanup` | Visitor-log housekeeping (dedupe + prune); requires `CRON_SECRET` |
| `GET /robots.txt`, `/sitemap.xml` | The usual |

## Deployment

### Railway

The whole thing ships as one Railway service plus the Redis and Postgres plugins. The `Dockerfile` builds the SPA and starts the Hono server, which serves both.

1. Point Railway at the repo and add the **Redis** and **Postgres** plugins.
2. Set the service variables: `LFM_API_KEY`, `LFM_SHARED_SECRET`, `REDIS_URL=${{Redis.REDIS_URL}}`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, plus the build-time `VITE_LFM_KEY` and `VITE_LFM_CALLBACK=https://<domain>/callback`.
3. Deploy. Drizzle migrations run on the server's first write, so there's no manual migrate step.

### Database Migrations

After changing [apps/server/src/schema.ts](apps/server/src/schema.ts), run `bun run db:generate` and commit the generated file under `apps/server/drizzle/`. To apply migrations by hand, point `DATABASE_URL` at the target and run `bun run db:migrate`.

## Operational Notes

### Caching

The proxy cache is short on purpose: recent-tracks responses live for 1 second, track-info for 24 hours.

### Rate Limiting

There's a lenient per-IP rate limit (60 requests / 10s, so about 360/min) that normal polling never gets close to. It only trips on abusive bursts, and it fails open when Redis is down ([security.ts](apps/server/src/security.ts)).

### Image Proxy

The image proxy is host-allowlisted (Last.fm/Spotify/Apple/etc. CDNs only), so nobody can turn it into an open SSRF proxy.

### Fail-Open Services

Redis and Postgres are both optional. If either one is unreachable, the widget keeps serving; you just lose caching/rate limiting or visitor logging until it's back.

## Known Constraints

- The design lives entirely in the URL hash. No accounts, no server-side saves. Lose the URL, lose the design (though the editor keeps a `localStorage` autosave as a safety net).
- Last.fm calls go browser-direct by design, public and private alike (private via a one-time server-signed URL). The server proxy is only the fallback.
- Last.fm doesn't push events, so "now playing" is always polled and runs about a second behind reality.
- Browser-direct calls necessarily expose the Last.fm API key in DevTools (it's a query param on every request, including the pre-signed private URLs). That's how the Last.fm API works for any client-side app; the key is not a credential, the shared secret is, and that stays server-side.

## License

You're welcome to use, copy, and modify this for personal use, including self-hosting and streaming with it. You may **not** redistribute it, republish it, or pass it off as your own, and commercial redistribution needs explicit permission. Contributions are welcome and credited; by contributing you're agreeing to these terms.

Questions or redistribution requests: [me@lawsonhart.me](mailto:me@lawsonhart.me).
