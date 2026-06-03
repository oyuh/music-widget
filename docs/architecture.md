# Architecture

The app is a Bun monorepo deployed as a **single Railway service** plus a Redis
database.

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
```

## Packages

- `apps/web` — SvelteKit SPA (`adapter-static`, CSR). The editor (`/`), the
  standalone widget (`/w`), and the auth callback (`/callback`).
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
- `GET /robots.txt`, `/sitemap.xml`.

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
