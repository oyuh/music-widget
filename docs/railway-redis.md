# Railway Redis Setup

Railway hosts the production Redis cache. The Worker runs on Cloudflare, not inside Railway, so it must use Railway's public TCP Proxy. Do not use a `*.railway.internal` hostname in Cloudflare Worker secrets.

## Create Redis

1. Create or open the Railway project for this app.
2. Add a Redis database service.
3. Open the Redis service networking settings.
4. Enable TCP Proxy.
5. Copy the generated proxy host and port.

Railway Redis exposes service variables such as `REDIS_URL`, `REDISHOST`, `REDISPORT`, `REDISUSER`, and `REDISPASSWORD` for Railway-internal service use. Cloudflare cannot use Railway private/internal networking, so production Cloudflare Workers need the TCP Proxy host and port.

## Build `REDIS_URL`

Use the Redis username/password with the TCP Proxy host and port:

```bash
redis://default:<password>@<tcp-proxy-host>:<tcp-proxy-port>
```

Example shape:

```bash
redis://default:password@shuttle.proxy.rlwy.net:15140
```

Use `rediss://` only if the proxy is configured for TLS. The Worker Redis client supports both `redis://` and `rediss://`.

The TCP Proxy is public. Treat the password as a production secret and rotate it if it is exposed.

## Add The Worker Secret

```bash
cd apps/api
wrangler secret put REDIS_URL
```

Paste the full URL when prompted. Do not commit it to the repo.

Also set these Worker secrets if they are not already configured:

```bash
wrangler secret put LFM_API_KEY
wrangler secret put LFM_SHARED_SECRET
```

## Local Testing

Put the same URL in `apps/api/.dev.vars`:

```bash
REDIS_URL=redis://default:password@proxy-host:proxy-port
```

Run:

```bash
bun run build:web
bun run dev:api
```

Then check:

```text
http://127.0.0.1:8787/api/health
```

For local Redis without Railway, run the Docker stack instead:

```bash
bun run docker:dev
```

That uses a `redis:7-alpine` container and sets `REDIS_URL=redis://redis:6379` inside the app container.

## Production Verification

After deploying the Worker, check:

```bash
curl https://your-worker-host/api/health
```

Expected healthy response:

```json
{"ok":true,"redis":"connected"}
```

Then call a valid Last.fm endpoint twice:

```bash
curl -i "https://your-worker-host/api/lastfm/recent?user=rj&limit=1"
curl -i "https://your-worker-host/api/lastfm/recent?user=rj&limit=1"
```

The first request should normally be `x-cache: MISS`. A repeat request inside the TTL should be `x-cache: L1` or `x-cache: REDIS`.

## Failure Behavior

Redis is a cache, not a hard dependency. If Railway Redis is down or the TCP Proxy cannot be reached, the Worker skips cache reads/writes and calls Last.fm from the Worker.

## Current TTLs

- Public recent tracks: 3 seconds.
- Authenticated recent tracks: 3 seconds, keyed by user, limit, and SHA-256 of the Last.fm session key.
- Track info: 24 hours.
- Image proxy: Cloudflare/browser cache headers only, no Redis write.

## Cost Notes

Cloudflare should be able to serve this traffic shape cheaply because static assets are edge-served and only `/api/*` invokes Worker code. Railway Redis cost depends on the active Railway plan and usage. Railway TCP Proxy traffic may count as network egress.

## References

- Railway Redis: https://docs.railway.com/databases/redis
- Railway TCP Proxy: https://docs.railway.com/networking/tcp-proxy
