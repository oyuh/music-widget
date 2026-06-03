# Local Development

A Bun monorepo: a SvelteKit SPA (`apps/web`) and a Hono/Bun server (`apps/server`).

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- Docker Desktop (for a local Redis; optional)

## Setup

```bash
bun install
```

Create the two env files at the repo root (both are gitignored). Vite reads them
via `envDir`, and Bun loads them for the server.

`.env` (server):

```bash
LFM_API_KEY=your-lastfm-api-key
LFM_SHARED_SECRET=your-lastfm-shared-secret
REDIS_URL=redis://localhost:6379
PORT=8787
LOG_LEVEL=info
```

`.env.local` (frontend, public — exposed to the browser):

```bash
VITE_LFM_KEY=your-lastfm-api-key
VITE_LFM_CALLBACK=http://localhost:5173/callback
```

See `.env.example` for the template.

## Run

```bash
bun run redis:up   # local Redis via docker compose (optional but recommended)
bun run dev        # Vite UI on :5173 + Hono API on :8787 (Vite proxies /api)
```

Open <http://localhost:5173>.

- `/` — the editor
- `/w#<config>` — the standalone widget (what goes in OBS)
- `/callback` — Last.fm auth return

Other scripts:

```bash
bun run dev:web      # just the SvelteKit dev server
bun run dev:server   # just the Hono server (pinned to :8787)
bun run build        # build the SPA to apps/web/build
bun run start        # run the Hono server, serving the built SPA (prod-like)
bun run typecheck    # both workspaces
bun run redis:down   # stop local Redis
```

## Notes

- In dev, public Last.fm calls go **directly** from the browser to Last.fm;
  `/api/*` is only used for private (session-key) calls and as a fallback, so
  the server mostly just serves the UI.
- `REDIS_URL` is optional locally — without it the server simply skips caching.
- A prod-like check: `bun run build && bun run start`, then open
  <http://localhost:8787> (the Hono server serves the built SPA + API).

## Troubleshooting

- Port 8787 or 5173 in use → stop the stray process (or `bun run redis:down`).
- `/api/health` says `error` → Redis is configured but unreachable (fine for
  dev; the app fails open).
- Auth "Connect" sends you to the wrong place → check `VITE_LFM_CALLBACK`.
