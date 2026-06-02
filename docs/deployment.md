# Deployment

This project deploys as:

- Frontend: Vite React static assets.
- API: Cloudflare Worker.
- Static hosting: Cloudflare Workers Static Assets.
- Shared cache: Railway Redis through Railway TCP Proxy.
- Local full-stack test: Docker Compose with app + local Redis.

No Vercel or Node serverless functions are used in production.

## 1. Verify Locally

Install dependencies:

```bash
bun install
```

Run checks:

```bash
bun run typecheck
bun run build
```

Run the Docker full-stack test:

```bash
bun run docker:dev -- --detach
```

Check the local Worker:

```bash
curl http://127.0.0.1:8787/api/health
curl "http://127.0.0.1:8787/api/lastfm/recent?user=rj&limit=1"
```

Expected:

- `/api/health` returns Redis `connected`.
- A valid Last.fm user returns `200`.
- Repeating the same recent-track request quickly returns `x-cache: L1`.

Stop local containers when finished:

```bash
bun run docker:down
```

## 2. Create Railway Redis

1. Create/open the Railway project.
2. Add a Redis database service.
3. Open the Redis service settings.
4. Enable TCP Proxy for Redis.
5. Copy the TCP Proxy hostname and port.

Do not use a `*.railway.internal` hostname for Cloudflare. Workers run outside Railway and need the public TCP Proxy.

Build the production `REDIS_URL`:

```bash
redis://default:<password>@<tcp-proxy-host>:<tcp-proxy-port>
```

Example shape:

```bash
redis://default:password@shuttle.proxy.rlwy.net:15140
```

Use `rediss://` only if your Railway Redis proxy is configured for TLS.

## 3. Configure Cloudflare Worker

Log in to Cloudflare from your local machine:

```bash
cd apps/api
bunx wrangler login
```

Set production secrets:

```bash
wrangler secret put LFM_API_KEY
wrangler secret put LFM_SHARED_SECRET
wrangler secret put REDIS_URL
```

Secret meanings:

- `LFM_API_KEY`: Last.fm API key.
- `LFM_SHARED_SECRET`: Last.fm shared secret for session exchange/signatures.
- `REDIS_URL`: Railway Redis TCP Proxy connection string.

Keep these out of Git. The public Vite values are separate:

```bash
VITE_LFM_KEY=your-lastfm-api-key
VITE_LFM_CALLBACK=https://your-production-domain/callback
```

Set Vite values in `.env.local` before building locally, or in CI build environment variables if CI deploys the Worker.

## 4. Review Worker Config

Worker config lives in:

```text
apps/api/wrangler.toml
```

Important production settings:

```toml
name = "music-widget"
main = "src/index.ts"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "../web/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*", "/robots.txt", "/sitemap.xml"]
```

Change `name` if needed before the first deploy.

## 5. Deploy

From the repo root:

```bash
bun run deploy
```

This builds `apps/web/dist`, then runs `wrangler deploy` from `apps/api`.

## 6. Add Domain

You can use the default `workers.dev` URL or attach a custom domain in Cloudflare:

1. Open Cloudflare dashboard.
2. Go to Workers & Pages.
3. Select the deployed Worker.
4. Add a custom domain or route.
5. Update `VITE_LFM_CALLBACK` / Last.fm callback URL to match:

```text
https://your-domain/callback
```

Then rebuild and redeploy so the frontend auth link uses the production callback.

## 7. Post-Deploy Smoke Tests

```bash
curl https://your-domain/api/health
curl -i "https://your-domain/api/lastfm/recent?user=rj&limit=1"
curl -i "https://your-domain/api/lastfm/trackInfo?artist=Radiohead&track=Creep"
```

Expected:

- Health returns `{"ok":true,"redis":"connected"}`.
- Recent tracks returns `200` for a valid public Last.fm user.
- A repeat recent-track request returns `x-cache: L1` or `x-cache: REDIS`.
- Track info returns `200`.

Also manually test:

- `/`
- `/w#<existing-widget-config>`
- `/callback?token=<lastfm-token>`
- Private profile connection flow.

## Troubleshooting

- `500 Server missing Last.fm credentials`: set `LFM_API_KEY` and `LFM_SHARED_SECRET` as Worker secrets.
- `/api/health` says `disabled`: `REDIS_URL` is not configured for the Worker.
- `/api/health` says `error`: Cloudflare cannot reach Railway Redis. Check TCP Proxy host, port, password, and whether you accidentally used `*.railway.internal`.
- Recent route returns `400 {"message":"User not found","error":6}`: Last.fm rejected the username.
- Local Docker requests hang: rebuild the image. The Dockerfile must include Node and CA certificates.
- Last.fm HTTPS fails in Docker with a certificate error: rebuild the latest Docker image so `ca-certificates` is installed.

## References

- Cloudflare Workers Static Assets routing: https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Railway Redis: https://docs.railway.com/databases/redis
- Railway TCP Proxy: https://docs.railway.com/networking/tcp-proxy
