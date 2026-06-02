# Local Development

This repo is a Bun workspace with a Vite React frontend and a Cloudflare Worker API. Local development has two supported modes:

- Wrangler preview: fastest way to run the Worker against local files.
- Docker full stack: closest local test of the deployed shape, including Redis.

## Install

```bash
bun install
```

## Environment Files

Use `.env.local` for Vite public values:

```bash
VITE_LFM_KEY=your-lastfm-api-key
VITE_LFM_CALLBACK=http://localhost:8787/callback
```

Use `apps/api/.dev.vars` for Worker-only secrets:

```bash
LFM_API_KEY=your-lastfm-api-key
LFM_SHARED_SECRET=your-lastfm-shared-secret
REDIS_URL=redis://default:password@proxy-host:proxy-port
```

`REDIS_URL` is optional for basic local development. When it is missing or invalid, the Worker skips Redis cache reads/writes and still calls Last.fm from the Worker.

Wrangler loads Worker secrets from `apps/api/.dev.vars`. Do not rely on root `.env` for Worker secrets when `.dev.vars` exists.

## Full Worker Preview

Build the static frontend and serve it through Wrangler:

```bash
bun run build:web
bun run dev:api
```

Open:

```text
http://127.0.0.1:8787
```

This is the closest local match to production because static assets and `/api/*` are both served by the Worker.

## Docker Full Stack

Use this when you want to test the app container and Redis together:

```bash
bun run docker:dev
```

This requires Docker Desktop with the Linux engine running.

That command:

- Reads `.env`, `.env.local`, and `apps/api/.dev.vars` if they exist.
- Generates `.docker/local.env` for Docker Compose.
- Builds the app image from `Dockerfile`.
- Uses Node to run Wrangler inside Docker and Bun for workspace commands.
- Installs CA certificates in the image so workerd can call Last.fm over HTTPS.
- Starts a local `redis:7-alpine` container.
- Starts Wrangler in the app container on `http://127.0.0.1:8787`.
- Forces `REDIS_URL=redis://redis:6379` inside Docker so Redis testing does not depend on Railway.

Run it in the background with:

```bash
bun run docker:dev -- --detach
```

Build the images without starting containers:

```bash
bun run docker:build
```

Follow logs:

```bash
bun run docker:logs
```

Stop everything:

```bash
bun run docker:down
```

After the app starts, check:

```text
http://127.0.0.1:8787/api/health
```

With the Docker Redis service running, the health response should report Redis as `connected`. If `LFM_API_KEY` or `LFM_SHARED_SECRET` is missing, the stack still boots, but Last.fm API routes return a server configuration error until those values are set.

Useful direct checks:

```bash
curl http://127.0.0.1:8787/api/health
curl "http://127.0.0.1:8787/api/lastfm/recent?user=rj&limit=1"
curl "http://127.0.0.1:8787/api/lastfm/trackInfo?artist=Radiohead&track=Creep"
```

Expected signs of a healthy stack:

- `/api/health` returns `{"ok":true,"redis":"connected"}`.
- A valid public Last.fm user returns `200`.
- Repeating the same recent-track request within a few seconds returns `x-cache: L1`.
- Last.fm user mistakes return Last.fm JSON like `{"message":"User not found","error":6}` instead of a Worker 500.

## Frontend-Only Dev

For faster UI iteration:

```bash
bun run dev:web
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8787`, so keep `bun run dev:api` running in another terminal when testing live Last.fm calls.

## Checks

```bash
bun run typecheck
bun run build
```

Useful local routes:

- `http://127.0.0.1:8787/`
- `http://127.0.0.1:8787/w#<widget-config>`
- `http://127.0.0.1:8787/callback?token=<lastfm-token>`
- `http://127.0.0.1:8787/api/health`
- `http://127.0.0.1:8787/api/lastfm/recent?user=<lastfm-user>&limit=1`

## Troubleshooting

- Port `8787` already in use: stop local Wrangler or run `bun run docker:down`.
- Docker starts but requests hang: rebuild the latest image with `bun run docker:dev -- --detach`; the image must include Node and CA certificates.
- `/api/health` says `disabled`: no `REDIS_URL` reached the Worker.
- `/api/health` says `error`: Redis is configured but unreachable.
- Recent track route returns `400` with `User not found`: Last.fm rejected the username.
- Recent track route returns `500` about missing credentials: fill `LFM_API_KEY` and `LFM_SHARED_SECRET` in `apps/api/.dev.vars`.
