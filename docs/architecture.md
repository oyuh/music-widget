# Architecture

The app is a Bun monorepo deployed as a **single Railway service** plus Redis and
Postgres databases.

```
Browser ──────────────► Last.fm API (ws.audioscrobbler.com)   ← direct, CORS
   │   (public recent / trackInfo + album art, per-user IP)
   │
   ▼
Railway service (Bun + Hono)            Railway Redis
   • serves the SvelteKit SPA           (private networking,
   • /api/* for signed/private calls     *.railway.internal)
   • image-proxy fallback, sitemap          ▲
   • talks to Redis (Bun.redis) ───────────┘
   • usage log + contacts (Drizzle ORM) ► Railway Postgres
```

## Packages

- `apps/web` — SvelteKit SPA (`adapter-static`, CSR). The editor (`/`), the
  standalone widget (`/w`), and the auth callback (`/callback`). The editor is
  **desktop-only** (`$lib/device.ts` UA check) — on mobile, `/` shows a gate with
  an email-capture box and source/site links; `/w` stays usable everywhere so
  embeds and shared links work on any device. The editor's "Add to stream" button
  opens a setup modal (`$lib/editor/SetupModal.svelte`) with per-platform
  (OBS/Streamlabs/XSplit) browser-source instructions and the widget URL.
- `apps/server` — Hono on Bun. Serves the built SPA (`apps/web/build`) and the
  API on one port (`$PORT`).

## Request flow (the important part)

Last.fm rate-limits **~5 requests/sec per IP**. If every user's request went
through the server, all 200+ users would share the server's single IP and get
throttled. Instead:

- **Public** recent-tracks / track-info calls go **directly from each user's
  browser** to Last.fm (`$lib/lastfm-client.ts`). Each user spends their own
  per-IP budget, so the shared API key only sees a small aggregate rate. Album
  art and color extraction also load straight from Last.fm's CDN (both send
  `Access-Control-Allow-Origin: *`). A network/CORS failure falls back to the
  server proxy.
- **Private** profiles (a connected session key) must be signed with the Last.fm
  **shared secret**, which never leaves the server — those calls go through
  `/api/lastfm/*`.
- **BYOK**: a user can paste their own Last.fm API key (stored in the widget
  config, so it travels to the `/w` page in OBS) for faster, fully-isolated
  requests.

## Server API

- `GET /api/ping` — liveness (always 200; Railway healthcheck).
- `GET /api/health` — `{ ok, redis }` (200 connected/disabled, 503 on Redis error).
- `GET /api/lastfm/recent`, `/trackInfo` — proxy + cache (used for private/sk
  calls and as a fallback).
- `POST /api/lastfm/session` — Last.fm token → session key (signed).
- `GET /api/proxy-image` — album-art proxy fallback (host-allowlisted).
- `POST /api/log/widget` — usage log: records a widget open/copy (Last.fm
  username, device fingerprint, current song, request metadata). Fire-and-forget
  and **silent** (always 204), fails open when no `DATABASE_URL` is set.
- `POST /api/contact` — saves a contact email (for outage notifications), linked
  to a Last.fm username. Has a form UI, so it returns real codes (200 / 400 / 429 / 503).
- `GET /robots.txt`, `/sitemap.xml`.

## Usage log + contacts (Postgres via Drizzle)

Persistence uses **Drizzle ORM** on Bun's native SQL client
([`drizzle-orm/bun-sql`](https://orm.drizzle.team)). Schema lives in
`apps/server/src/schema.ts`; migrations are generated with `bun run db:generate`
into `apps/server/drizzle/` and **applied automatically on the server's first
write** (the bun-sql migrator). Like Redis, Postgres is **fail-open**: a missing
or unreachable DB is logged and ignored, never blocking a request.

- **`widget_events`** — `POST /api/log/widget` fires from the browser when a
  widget is opened (`/w` loads for a username) or its URL is copied. The server
  sanitizes the untrusted body (length-capped fields, event coerced to
  `open`/`copy`), adds IP / user-agent / referer, and **upserts**: a unique index
  on `(lfm_user, fingerprint, event)` means repeat events from the same device
  bump `seen_count` / `last_seen_at` and refresh the latest song **instead of
  duplicating rows**. The route is silent (always 204) and has its own per-IP
  rate limit (30/min) on top of the global `/api` limiter.
- **`contacts`** — `POST /api/contact` upserts by email (no duplicates) and links
  it to a username: the one submitted with the form, or — when absent — recovered
  from `widget_events` by matching the **same device fingerprint**. So an outage
  email can name the user's widget. Rate-limited to 5 per 10 min per IP.

## Caching & resilience (server side)

`Bun.redis` over Railway private networking, with an in-memory L1 + Redis L2,
request coalescing, and `x-cache` headers. Redis is **fail-open**: if it's
unreachable the server skips the cache (a circuit breaker avoids per-request
timeout penalties) and still serves. It recovers automatically when Redis
returns.

## Abuse prevention

- Lenient per-IP rate limit on `/api/*` (Redis sliding window, fails open, never
  bans — just a temporary 429). Mostly relevant to the private/proxy paths.
- Image-proxy host allowlist (Last.fm/Spotify/Apple CDNs) to prevent open-proxy
  / SSRF.
- `X-Content-Type-Options: nosniff`, capped `limit` param.
