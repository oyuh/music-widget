// src/pages/api/lastfm/recent.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getRequestId, logDebug, logError, logInfo, logWarn, serializeError } from "@/utils/serverLog";

const LFM_KEY = process.env.NEXT_PUBLIC_LFM_KEY!;
const LFM_SECRET = process.env.LFM_SHARED_SECRET!;

// In-memory cache with TTL
const cache = new Map<string, { data: unknown; expires: number }>();

function sign(params: Record<string, string>) {
  const keys = Object.keys(params).sort();
  const sigBase = keys.map(k => `${k}${params[k]}`).join("") + LFM_SECRET;
  return crypto.createHash("md5").update(sigBase, "utf8").digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = getRequestId(req);
  const t0 = Date.now();
  try {
    const { user, limit = "1", sk } = req.query as { user?: string; limit?: string; sk?: string };
    if (!user) {
      logWarn("api.lastfm.recent.missing_user", { requestId, method: req.method || "", path: req.url || "" });
      return res.status(400).json({ error: "Missing user" });
    }

    logInfo("api.lastfm.recent.start", {
      requestId,
      method: req.method || "",
      path: req.url || "",
      user: String(user),
      limit: String(limit),
      hasSessionKey: Boolean(sk),
    });

    // Create cache key based on user, limit, and sk presence
    const cacheKey = `recent:${user}:${limit}:${sk ? "auth" : "public"}`;
    const now = Date.now();

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now) {
      logDebug("api.lastfm.recent.cache_hit", {
        requestId,
        cacheKey,
        ttlMs: cached.expires - now,
      });
      // Return cached data with appropriate headers
      res.setHeader("Cache-Control", "public, max-age=3, s-maxage=3, stale-while-revalidate=30");
      res.setHeader("X-Cache", "HIT");
      logInfo("api.lastfm.recent.end", {
        requestId,
        status: 200,
        cache: "HIT",
        durationMs: Date.now() - t0,
      });
      return res.status(200).json(cached.data);
    }

    const base: Record<string, string> = {
      method: "user.getRecentTracks",
      user: String(user),
      limit: String(limit),
      api_key: LFM_KEY,
    };

    let url: string;
    if (sk) {
      const params = { ...base, sk: String(sk) };
      const api_sig = sign(params);
      const qs = new URLSearchParams({ ...params, api_sig, format: "json" });
      url = `https://ws.audioscrobbler.com/2.0/?${qs.toString()}`;
    } else {
      const qs = new URLSearchParams({ ...base, format: "json" });
      url = `https://ws.audioscrobbler.com/2.0/?${qs.toString()}`;
    }

    const upstreamT0 = Date.now();
    const r = await fetch(url);
    const j = await r.json();

    logInfo("api.lastfm.recent.upstream", {
      requestId,
      upstreamHost: "ws.audioscrobbler.com",
      upstreamStatus: r.status,
      upstreamOk: r.ok,
      upstreamMs: Date.now() - upstreamT0,
      cache: "MISS",
    });

    if (r.ok) {
      // Cache for 3 seconds - balances freshness with request reduction
      cache.set(cacheKey, {
        data: j,
        expires: now + 3000,
      });

      // Clean up old cache entries periodically
      if (cache.size > 100) {
        let removed = 0;
        for (const [key, value] of cache.entries()) {
          if (value.expires <= now) {
            cache.delete(key);
            removed++;
          }
        }
        if (removed > 0) {
          logDebug("api.lastfm.recent.cache_cleanup", { requestId, removed });
        }
      }
    }

    // Aggressive caching headers - clients can cache for 3s, Vercel Edge can serve stale for 30s
    res.setHeader("Cache-Control", "public, max-age=3, s-maxage=3, stale-while-revalidate=30");
    res.setHeader("X-Cache", "MISS");
    logInfo("api.lastfm.recent.end", {
      requestId,
      status: r.ok ? 200 : 400,
      durationMs: Date.now() - t0,
      cache: "MISS",
    });
    return res.status(r.ok ? 200 : 400).json(j);
  } catch (e) {
    logError("api.lastfm.recent.error", {
      requestId,
      durationMs: Date.now() - t0,
      error: serializeError(e),
    });
    const error = e as Error;
    return res.status(500).json({ error: error.message ?? "Internal error" });
  }
}
