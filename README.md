# Last.fm Music Widget

A now-playing widget for Last.fm, meant to sit in a stream as an OBS/Streamlabs/XSplit
browser source. You build the overlay in a drag-and-drop editor, copy the resulting
URL, and drop it into your scene. The whole design lives in the URL, so there's no
account and nothing to save on a server.

Live at **[fast.jamlog.lol](https://fast.jamlog.lol)**.

## What it actually does

The editor (`/`) is a canvas where you place and style the pieces of the widget:
album art, title, artist, album, a progress bar, and an elapsed/remaining duration
readout. You can drag elements around, resize them, snap them to each other, set
per-element fonts/colors/shadows, and pick a switch animation for when the track
changes. State autosaves to `localStorage` as you go.

When you're happy with it, the entire config is serialized to JSON, base64url-encoded,
and stuffed into the widget URL's hash (`/w#<blob>`). The widget page (`/w`) reads that
hash back, polls Last.fm for the user's current track, and renders. Because everything
is in the hash, the URL is the document , copy it, share it, paste it into OBS, done.

There are two layout engines. The original (`version: 1`) is a fixed grid. The current
one (`version: 2`) is free positioning: every element has an `x/y/w/h`, a z-index, and
optional snap relationships to other elements. The `version` flag in the encoded config
decides which renderer (`WidgetLegacy.svelte` / `WidgetV2.svelte`) runs, and there's a
`migrateToV2` step that converts an old grid design into the equivalent free layout so
nothing breaks. See [config.ts](apps/web/src/lib/config.ts) for the full shape.

### Polling and progress

Last.fm doesn't push, so the widget polls `user.getRecentTracks` and watches the
`nowplaying` flag. The interval adapts to how active the page is and whether a track
just changed , 2.5s right after a song change, 5s while something's playing, backing
off to 10s and then 20s once the tab has been idle for a couple minutes
([nowplaying.svelte.ts](apps/web/src/lib/nowplaying.svelte.ts)). Between polls the
progress bar is ticked locally from the track's reported duration, with pause detection
and a resume-position estimate so the bar doesn't sit frozen or jump around.

### Why public calls go straight from the browser

Last.fm rate-limits roughly **5 requests/sec per IP**. If every viewer's widget fetched
through our server, all of them would share the server's one IP and get throttled the
moment a streamer with any audience went live. So public lookups (recent tracks, track
info) fire **directly from each viewer's browser** to `ws.audioscrobbler.com`
([lastfm-client.ts](apps/web/src/lib/lastfm-client.ts)) , every viewer spends their own
per-IP budget. Album art and color extraction load straight from Last.fm's CDN the same
way (it sends `Access-Control-Allow-Origin: *`). If a direct call fails on the transport
level (network/CORS), it falls back to the server proxy.

Private profiles are the exception. A hidden listening profile has to be requested with
a signed call, and the signature needs the Last.fm shared secret, which never leaves the
server. Those requests always go through `/api/lastfm/*`, which signs them server-side
([lastfm.ts](apps/server/src/lastfm.ts)).

## Layout

```
apps/
  web/     SvelteKit SPA , editor (/), widget (/w), Last.fm auth callback (/callback)
  server/  Hono on Bun , /api/*, serves the built SPA, talks to Redis + Postgres
```

- **Web** ([apps/web](apps/web)): SvelteKit with `adapter-static` (it's a pure SPA, CSR
  only), Svelte 5 runes, Tailwind v4.
- **Server** ([apps/server](apps/server)): Hono on Bun. In production it serves both the
  static build and the API on a single port; in dev, Vite serves the UI and proxies
  `/api` to it. Redis (`Bun.redis`) is a small cache in front of the signed/proxied
  Last.fm paths, and Postgres (Drizzle, `drizzle-orm/bun-sql`) backs optional usage
  analytics and contact emails. Both are **fail-open** , if either is unreachable the
  widget still serves; you just lose caching or logging.

A few details worth knowing about the server:

- The proxy cache is short on purpose: recent-tracks responses live for 3s, track-info
  for 24h.
- There's a lenient per-IP rate limit (60 requests / 10s, ~360/min) that normal polling
  never comes near; it only trips on abusive bursts, and it fails open when Redis is down
  ([security.ts](apps/server/src/security.ts)).
- The image proxy is host-allowlisted (Last.fm/Spotify/Apple/etc. CDNs only) so it can't
  be turned into an open SSRF proxy.

## Running it locally

You need [Bun](https://bun.sh) 1.3+, and optionally Docker for local Redis/Postgres.

```bash
bun install
bun run services:up   # Redis + Postgres in Docker (optional , both fail open)
bun run dev           # Vite UI on :5173, Hono API on :8787
```

Then open <http://localhost:5173>. Config is read from a repo-root `.env` (server) and
`.env.local` (frontend `VITE_*`); copy [`.env.example`](.env.example) to start.

| Variable | Side | Purpose |
|---|---|---|
| `LFM_API_KEY` / `LFM_SHARED_SECRET` | server | Last.fm credentials (the secret signs private/proxied calls) |
| `REDIS_URL` | server | cache + rate-limit store; unset = no cache, no limiting |
| `DATABASE_URL` | server | Postgres for the visitor log + contacts; unset = off |
| `CRON_SECRET` | server | bearer token guarding `POST /api/cron/cleanup`; unset = route disabled |
| `PORT` / `LOG_LEVEL` | server | bind port / log verbosity |
| `VITE_LFM_KEY` | frontend (build) | public Last.fm key used for the browser-direct calls |
| `VITE_LFM_CALLBACK` | frontend (build) | Last.fm auth callback URL |

## API

Everything lives under `/api`. The Last.fm routes exist mostly as the fallback and the
signed path for private profiles , the common case never touches them.

| Route | Purpose |
|---|---|
| `GET /api/ping` | liveness; always 200 while the process is up |
| `GET /api/health` | reports Redis (and informational Postgres) status; may 503 if Redis is configured but down |
| `GET /api/lastfm/recent`, `/trackInfo` | signed/cached proxy , used for private profiles and as the browser-direct fallback |
| `POST /api/lastfm/session` | exchange a Last.fm auth token for a session key (signed) |
| `GET /api/proxy-image` | album-art fetch fallback; host-allowlisted |
| `POST /api/log/widget` | fire-and-forget visitor log, one row per visitor (fail-open) |
| `POST /api/contact` | store a contact email against a Last.fm username |
| `POST /api/cron/cleanup` | visitor-log housekeeping (dedupe + prune); requires `CRON_SECRET` |
| `GET /robots.txt`, `/sitemap.xml` | the usual |

## Deploying (Railway)

It ships as one service plus the Redis and Postgres plugins. The `Dockerfile` builds the
SPA and starts the Hono server, which serves both.

1. Point Railway at the repo and add the **Redis** and **Postgres** plugins.
2. Set the service variables: `LFM_API_KEY`, `LFM_SHARED_SECRET`,
   `REDIS_URL=${{Redis.REDIS_URL}}`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, plus the
   build-time `VITE_LFM_KEY` and `VITE_LFM_CALLBACK=https://<domain>/callback`.
3. Deploy. Drizzle migrations are applied on the server's first write, so there's no
   manual migrate step.

After changing [`apps/server/src/schema.ts`](apps/server/src/schema.ts), run
`bun run db:generate` and commit the generated file under `apps/server/drizzle/`. To
apply migrations by hand, point `DATABASE_URL` at the target and run `bun run db:migrate`.

## Scripts

| Script | Does |
|---|---|
| `bun run dev` | Vite UI + Hono API together (Vite proxies `/api`) |
| `bun run build` | build the SvelteKit SPA |
| `bun test` | unit tests |
| `bun run services:up` / `services:down` | local Redis + Postgres in Docker |
| `bun run db:generate` / `db:migrate` | generate / apply Drizzle migrations |

## License

You may use, copy, and modify this for personal use, including self-hosting and
streaming. You may **not** redistribute, republish, or pass it off as your own;
commercial redistribution needs explicit permission. Contributions are welcome and
credited, and contributing means you agree to these terms.

Questions or redistribution requests: [me@lawsonhart.me](mailto:me@lawsonhart.me).
