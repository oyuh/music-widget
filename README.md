# Music Widget

[![CI](https://github.com/oyuh/music-widget/actions/workflows/ci.yml/badge.svg)](https://github.com/oyuh/music-widget/actions/workflows/ci.yml)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.3-000000?logo=bun&logoColor=white)
[![License](https://img.shields.io/badge/license-source--available-blue)](LICENSE)

A Last.fm now-playing overlay that runs as a browser source in OBS, Streamlabs, or XSplit. You lay the overlay out in a drag-and-drop editor, and the editor hands you a URL to paste into your scene. The entire design is serialized into that URL, so there are no accounts and nothing is persisted server-side.

Technically it's a TypeScript monorepo: a SvelteKit editor and widget SPA, a Bun + Hono API, and a local Redis + Postgres dev stack.

- Live app: [fast.jamlog.lol](https://fast.jamlog.lol)

## Contents

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
- [Environment Variables](#environment-variables)
- [Common Commands](#common-commands)
- [API Surface](#api-surface)
- [Deployment](#deployment)
- [Operational Notes](#operational-notes)
- [Known Constraints](#known-constraints)
- [Contributing](#contributing)
- [License](#license)

## How It Works

### The Editor

The editor (`/`) is a canvas for laying out the widget's pieces: album art, title, artist, album, a progress bar, and an elapsed/remaining time readout. Elements can be dragged, resized, and snapped to each other, and each one carries its own font, colors, and shadow, plus a per-track-change animation. State autosaves to `localStorage` on every change, so closing the tab doesn't lose work.

### The Widget URL

The full config is serialized to JSON, base64url-encoded, and packed into the widget URL's hash (`/w#<blob>`). The widget page (`/w`) decodes the hash, polls Last.fm for the current track, and renders. Because the config lives entirely in the hash, the URL *is* the document: copy it into OBS and it renders, no server round-trip for the design itself.

### Layout Engines

There are two layout engines, and the `version` flag in the encoded config picks which renderer runs:

- **`version: 1`** (legacy) is a fixed grid, rendered by [`WidgetLegacy.svelte`](apps/web/src/lib/WidgetLegacy.svelte).
- **`version: 2`** (current) is free positioning. Every element gets `x/y/w/h`, a z-index, and optional snap relationships to other elements, rendered by [`WidgetV2.svelte`](apps/web/src/lib/WidgetV2.svelte).

A `migrateToV2` step upgrades old grid designs into the equivalent free layout, so existing v1 URLs keep working. The full config shape lives in [`config.ts`](apps/web/src/lib/config.ts).

### Polling and Progress

Last.fm has no push API, so the widget polls `user.getRecentTracks` and watches the `nowplaying` flag. Since every widget polls from its viewer's own IP (see [below](#browser-direct-lastfm-calls)), the cadence is a flat 1 second regardless of playback state, so track changes, pauses, and playback starting all land within about a second ([`nowplaying.svelte.ts`](apps/web/src/lib/nowplaying.svelte.ts)). The only backoff is a hidden tab (5s), which OBS browser sources never trigger because they always report as visible.

Between polls the progress bar ticks locally off the track's reported duration, with pause detection and a resume-position estimate so the bar doesn't freeze or jump.

### Browser-Direct Last.fm Calls

Last.fm rate-limits at roughly 5 requests per second per IP. If every viewer fetched through the server, they'd all share the server's single IP, and any streamer with a real audience going live would throttle everyone at once.

So public lookups (recent tracks, track info) go straight from each viewer's browser to `ws.audioscrobbler.com` ([`lastfm-client.ts`](apps/web/src/lib/lastfm-client.ts)), and each viewer spends their own per-IP budget. Album art and color extraction load directly from Last.fm's CDN the same way, since it sends `Access-Control-Allow-Origin: *`. A transport-level failure (network or CORS) falls back to the server proxy.

Private profiles go browser-direct too, with one extra step. A hidden listening profile requires a signed call, and the signature needs the Last.fm shared secret, which never leaves the server. Last.fm signatures carry no timestamp or nonce, so the server signs the recent-tracks URL once (`GET /api/lastfm/sign-recent`) and the browser reuses that pre-signed URL for every poll, straight against Last.fm from the viewer's IP ([`lastfm.ts`](apps/server/src/lastfm.ts)). The signed proxy routes remain as the fallback if signing or the direct call fails.

## Repository Layout

```text
.
├── apps/
│   ├── web/                # SvelteKit SPA: editor (/), widget (/w), auth callback (/callback)
│   └── server/             # Bun/Hono API; serves the built SPA, talks to Redis + Postgres
├── scripts/                # cron cleanup helper
├── tests/                  # unit tests
├── docker-compose.dev.yml  # local Redis + Postgres stack
├── Dockerfile              # production image: builds the SPA, starts the Hono server
├── railway.json            # Railway deployment config
├── drizzle.config.ts       # Drizzle Kit migration config
└── package.json            # Bun workspace scripts
```

## Architecture

### Web App: `apps/web`

A SvelteKit single-page application built with `adapter-static` (pure SPA, CSR only), Svelte 5 runes, and Tailwind v4.

Responsibilities:

- The drag-and-drop editor, presets, and per-element styling.
- Encoding and decoding the widget config to and from the URL hash.
- Browser-direct Last.fm polling and widget rendering.
- The Last.fm auth callback for private-profile sessions.

Key files:

- [`config.ts`](apps/web/src/lib/config.ts): config schema, encode/decode, v1→v2 migration
- [`editor.svelte.ts`](apps/web/src/lib/editor.svelte.ts): editor state
- [`nowplaying.svelte.ts`](apps/web/src/lib/nowplaying.svelte.ts): polling + progress
- [`lastfm-client.ts`](apps/web/src/lib/lastfm-client.ts): browser-direct Last.fm client
- [`WidgetLegacy.svelte`](apps/web/src/lib/WidgetLegacy.svelte) / [`WidgetV2.svelte`](apps/web/src/lib/WidgetV2.svelte): renderers

### Server App: `apps/server`

A Bun-powered Hono service. In production it serves both the static build and the API on one port; in dev, Vite serves the UI and proxies `/api` to it. Redis (`Bun.redis`) is a small cache in front of the signed/proxied Last.fm paths, and Postgres (Drizzle, `drizzle-orm/bun-sql`) backs the optional usage analytics and contact emails.

Responsibilities:

- One-time signing of private-profile poll URLs, plus the fallback proxy for browser-direct calls.
- Exchanging Last.fm auth tokens for session keys.
- A host-allowlisted album-art image proxy.
- Fire-and-forget visitor logging and contact storage.
- Per-IP rate limiting and visitor-log cleanup.

Key files:

- [`index.ts`](apps/server/src/index.ts): routing + static serving
- [`lastfm.ts`](apps/server/src/lastfm.ts): signing, proxy, session exchange
- [`security.ts`](apps/server/src/security.ts): rate limiting, image-proxy allowlist
- [`schema.ts`](apps/server/src/schema.ts): Drizzle schema

## Local Development

**Prerequisites**

- Bun 1.3.x or newer
- Docker (optional, for local Redis + Postgres; both fail open without it)

**Quick start**

```bash
bun install
bun run services:up   # Redis + Postgres in Docker (optional)
bun run dev           # Vite UI on :5173, Hono API on :8787
```

Then open `http://localhost:5173`.

## Environment Variables

Config is read from a repo-root `.env` (server) and `.env.local` (frontend `VITE_*` values). Copy [`.env.example`](.env.example) to get started.

| Variable | Side | Purpose |
|----------|------|---------|
| `LFM_API_KEY` / `LFM_SHARED_SECRET` | server | Last.fm credentials (the secret signs private/proxied calls) |
| `REDIS_URL` | server | cache + rate-limit store; unset = no cache, no limiting |
| `DATABASE_URL` | server | Postgres for the visitor log + contacts; unset = off |
| `CRON_SECRET` | server | bearer token guarding `POST /api/cron/cleanup`; unset = route disabled |
| `PORT` / `LOG_LEVEL` | server | bind port / log verbosity |
| `VITE_LFM_KEY` | frontend (build) | public Last.fm key for browser-direct calls |
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
| `GET /robots.txt`, `/sitemap.xml` | Crawler files |

## Deployment

### Railway

The whole thing ships as one Railway service plus the Redis and Postgres plugins. The `Dockerfile` builds the SPA and starts the Hono server, which serves both.

1. Point Railway at the repo and add the **Redis** and **Postgres** plugins.
2. Set the service variables: `LFM_API_KEY`, `LFM_SHARED_SECRET`, `REDIS_URL=${{Redis.REDIS_URL}}`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, plus the build-time `VITE_LFM_KEY` and `VITE_LFM_CALLBACK=https://<domain>/callback`.
3. Deploy. Drizzle migrations run on the server's first write, so there's no manual migrate step.

### Database Migrations

After changing [`schema.ts`](apps/server/src/schema.ts), run `bun run db:generate` and commit the generated file under `apps/server/drizzle/`. To apply migrations by hand, point `DATABASE_URL` at the target and run `bun run db:migrate`.

## Operational Notes

**Caching.** The proxy cache is deliberately short: recent-tracks responses live for 1 second, track-info for 24 hours.

**Rate limiting.** A lenient per-IP limit (60 requests / 10s, roughly 360/min) that normal polling never approaches. It only trips on abusive bursts and fails open when Redis is down ([`security.ts`](apps/server/src/security.ts)).

**Image proxy.** Host-allowlisted (Last.fm/Spotify/Apple/etc. CDNs only), so it can't be turned into an open SSRF proxy.

**Fail-open services.** Redis and Postgres are both optional. If either is unreachable, the widget keeps serving; you lose caching/rate limiting or visitor logging until it's back.

## Known Constraints

- The design lives entirely in the URL hash. No accounts, no server-side saves. Lose the URL, lose the design (the editor keeps a `localStorage` autosave as a safety net).
- Last.fm calls go browser-direct by design, public and private alike (private via a one-time server-signed URL). The server proxy is only the fallback.
- Last.fm has no event stream, so "now playing" is polled and runs about a second behind reality.
- Browser-direct calls necessarily expose the Last.fm API key in DevTools (it's a query param on every request, including the pre-signed private URLs). This is how the Last.fm API works for any client-side app: the key is not a credential, the shared secret is, and the secret stays server-side.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the checks to run before opening a PR, and how contributions are licensed.

## License

Source-available for personal use, including self-hosting and streaming with it. Redistribution, republishing, and commercial redistribution require permission. See [LICENSE](LICENSE) for the full terms.

Questions or redistribution requests: [me@lawsonhart.me](mailto:me@lawsonhart.me).
