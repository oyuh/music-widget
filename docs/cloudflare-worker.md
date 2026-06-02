# Cloudflare Worker

Cloudflare is the production host for this app. It serves `apps/web/dist` as static assets and runs the Worker script for dynamic routes.

## What Runs Where

- Normal page and asset requests are static files served from Cloudflare.
- `/`, `/w`, and `/callback` use the SPA fallback from `apps/api/wrangler.toml`.
- `/api/*`, `/robots.txt`, and `/sitemap.xml` run through the Worker first.
- The browser never calls Last.fm data APIs directly. It calls this app's Worker routes.
- The Worker calls Last.fm and Railway Redis.

## Configure Wrangler

Worker config lives in:

```text
apps/api/wrangler.toml
```

Current important settings:

```toml
name = "music-widget"
main = "src/index.ts"

[assets]
directory = "../web/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*", "/robots.txt", "/sitemap.xml"]
```

Before production deploy, update `name` if you want a different Worker name.

If you want a custom domain instead of a `workers.dev` URL, configure a Worker custom domain in the Cloudflare dashboard or add route settings to `wrangler.toml`.

## Secrets

Set secrets from `apps/api`:

```bash
cd apps/api
wrangler secret put LFM_API_KEY
wrangler secret put LFM_SHARED_SECRET
wrangler secret put REDIS_URL
```

Use the same Last.fm API key for `LFM_API_KEY` and the Vite public `VITE_LFM_KEY`. Keep `LFM_SHARED_SECRET` and `REDIS_URL` Worker-only.

Last.fm session keys are stored client-side for connected/private widgets and sent only to the Worker API routes.

Cloudflare secrets are encrypted bindings. Do not put `LFM_SHARED_SECRET` or `REDIS_URL` in `wrangler.toml`.

## Deploy

From the repo root:

```bash
bun run deploy
```

This runs:

```bash
bun run build:web
cd apps/api && bun run deploy
```

The Worker asset binding points at `../web/dist`, so the web build must exist before deploy.

Deployment target:

- Static frontend: Cloudflare Workers Static Assets.
- API runtime: Cloudflare Worker.
- Cache: Railway Redis over TCP Proxy.

## Cache Headers

API responses include cache status headers:

- `x-cache: L1`: served from the Worker isolate memory cache.
- `x-cache: REDIS`: served from Railway Redis.
- `x-cache: MISS`: fetched from Last.fm, then cached if the response is cacheable.
- `x-cache: COALESCED`: reused an in-flight Last.fm request for the same cache key.

Image proxy responses use Cloudflare/browser cache headers and are not stored in Redis.

## Health Check

After deploy, open:

```text
https://your-worker-host/api/health
```

Expected Redis states:

- `connected`: Worker can reach Railway Redis TCP Proxy.
- `disabled`: no `REDIS_URL` configured.
- `unhealthy` or `error`: Redis connection failed, but Last.fm API routes should still fail open.

## Post-Deploy Checks

```bash
curl https://your-worker-host/api/health
curl "https://your-worker-host/api/lastfm/recent?user=rj&limit=1"
curl "https://your-worker-host/api/lastfm/trackInfo?artist=Radiohead&track=Creep"
```

Expected:

- `/api/health` returns Redis `connected`.
- The first valid Last.fm request returns `x-cache: MISS`.
- A repeat request inside the TTL returns `x-cache: L1` or `x-cache: REDIS`.

## References

- Cloudflare Workers Static Assets routing: https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
