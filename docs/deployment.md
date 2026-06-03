# Deployment (Railway)

The app deploys as **one Railway service** (Bun + Hono serving the SvelteKit SPA
and the API) plus a **Railway Redis** database. No Cloudflare, no Vercel.

Build is driven by the repo `Dockerfile` (multi-stage `oven/bun`: install →
build the SPA → run the server). `railway.json` points at it and uses
`/api/ping` as the healthcheck.

## 1. Create the project

1. Push the branch you want to deploy (e.g. `the-refactor`, which doubles as
   staging):
   ```bash
   git push -u origin the-refactor
   ```
2. Railway → **New Project → Deploy from GitHub repo** → select the repo → set
   the **deploy branch** to `the-refactor`.
   - (CLI alternative: `railway login` → `railway init` → `railway up`.)

## 2. Add Redis

In the project: **New → Database → Redis**.

## 2b. Add Postgres (usage log)

In the project: **New → Database → Postgres**. This powers the widget usage log
(which Last.fm usernames open/copy the overlay, plus device fingerprint, current
song, metadata) and the contact-email form. It's **optional**: with no
`DATABASE_URL` set, the endpoints no-op / 503 (fail open). Tables are created via
**Drizzle migrations applied automatically on the server's first write** — no
manual migration step. When you change `apps/server/src/schema.ts`, run
`bun run db:generate` and commit the new file in `apps/server/drizzle/`.

Query it any time from the Railway Postgres console, e.g.:

```sql
-- most-active widgets (deduped per user+device+event)
select last_seen_at, event, lfm_user, seen_count, track_name, track_artist
from widget_events order by last_seen_at desc limit 50;

-- contact emails with their linked Last.fm username (for outage notices)
select email, lfm_user, updated_at from contacts order by updated_at desc;
```

## 3. Set variables on the app service

| Variable | Value | When |
|---|---|---|
| `LFM_API_KEY` | your Last.fm API key | runtime |
| `LFM_SHARED_SECRET` | your Last.fm shared secret | runtime (**secret**) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | runtime (private networking) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | runtime (private networking) — enables the usage log |
| `VITE_LFM_KEY` | the same Last.fm API key (public) | **build** |
| `VITE_LFM_CALLBACK` | `https://<your-domain>/callback` | **build** |

`PORT` is injected by Railway automatically. Railway passes service variables as
Docker build args, and the `Dockerfile` declares `ARG VITE_LFM_KEY`,
`ARG VITE_LFM_CALLBACK`, `ARG VITE_COMMIT`/`ARG RAILWAY_GIT_COMMIT_SHA`, so the
public values get inlined into the SPA at build time.

> **Build-time vs runtime matters.** `VITE_*` values are baked into the browser
> bundle during the build. `VITE_LFM_CALLBACK` in particular must be the final
> public domain **before** you build — otherwise the "Connect" button points at
> the wrong place. Change the domain later → redeploy.

## 4. Domain

Settings → Networking → **Generate Domain** (e.g. `…up.railway.app`). Set
`VITE_LFM_CALLBACK` to `https://<that-domain>/callback` and redeploy so it's
baked in. (Custom-domain cutover is in §7.)

## 5. Last.fm app settings

In your Last.fm API account, set the **Callback URL** to
`https://<your-domain>/callback`.

## 6. Smoke test

```bash
curl https://<domain>/api/ping       # {"ok":true}
curl https://<domain>/api/health     # {"ok":true,"redis":"connected","db":"connected"}
curl -i "https://<domain>/api/lastfm/recent?user=rj&limit=1"  # 200 (fallback path)
curl -i -X POST https://<domain>/api/log/widget \
  -H 'content-type: application/json' \
  -d '{"event":"open","lfmUser":"rj","fp":"test"}'            # 204 (silent)
curl -i -X POST https://<domain>/api/contact \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","lfmUser":"rj","fp":"test"}'  # {"ok":true}
```

Then in a browser: open `/`, set a username, drag things, **Copy widget URL**,
open `/w#…`, and try **Connect** (private profile). Public widgets call Last.fm
directly from the browser, so most traffic never touches the server.

## 7. Zero-downtime cutover from Vercel

The live domain (e.g. `apple.jamlog.lol`) currently points at Vercel. Move it
**after** the Railway deploy is verified on its `…up.railway.app` URL.

1. **Lower the DNS TTL** for the `apple` record (to e.g. 300s) a little ahead of
   time, wherever DNS for `jamlog.lol` is managed.
2. Railway → app service → Settings → Networking → **Custom Domain** → add
   `apple.jamlog.lol`. Railway shows a **CNAME target** and provisions a cert.
3. Make sure `VITE_LFM_CALLBACK=https://apple.jamlog.lol/callback` is set and the
   service has been **redeployed** with it (so the built SPA uses the real
   callback), and the Last.fm callback URL matches.
4. In your DNS provider, change the `apple` **CNAME** from the Vercel target to
   the Railway target.
5. During propagation both hosts serve correctly (Vercel = old build, Railway =
   new), so there's no downtime. Once it's fully propagated and verified, you can
   remove the domain from Vercel / retire the Vercel project.
6. Merge `the-refactor` → `main` once you're happy.

> Private networking note: `${{Redis.REDIS_URL}}` resolves to
> `redis.railway.internal` (IPv6); `Bun.redis` handles it. If `/api/health` ever
> reports `error`, fall back to the Redis service's public connection URL.
