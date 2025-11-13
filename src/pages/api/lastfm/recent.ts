// src/pages/api/lastfm/recent.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

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
  try {
    const { user, limit = "1", sk } = req.query as { user?: string; limit?: string; sk?: string };
    if (!user) return res.status(400).json({ error: "Missing user" });

    // Create cache key based on user, limit, and sk presence
    const cacheKey = `recent:${user}:${limit}:${sk ? "auth" : "public"}`;
    const now = Date.now();

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now) {
      // Return cached data with appropriate headers
      res.setHeader("Cache-Control", "public, max-age=3, s-maxage=3, stale-while-revalidate=30");
      res.setHeader("X-Cache", "HIT");
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

    const r = await fetch(url);
    const j = await r.json();

    // Log recent track info
    if (r.ok && j?.recenttracks?.track) {
      const tracks = Array.isArray(j.recenttracks.track) ? j.recenttracks.track : [j.recenttracks.track];
      const recentTrack = tracks[0];
      if (recentTrack) {
        const trackName = recentTrack.name || 'Unknown';
        const artistName = recentTrack.artist?.['#text'] || recentTrack.artist || 'Unknown';
        const isNowPlaying = recentTrack['@attr']?.nowplaying === 'true';
        const duration = recentTrack.duration ? `${Math.round(parseInt(recentTrack.duration) / 1000)}s` : 'N/A';
        console.log(`🎵 [API Recent Track] ${isNowPlaying ? '▶️ NOW PLAYING' : '⏹️ RECENT'}: "${trackName}" by ${artistName} (Duration: ${duration}) [User: ${user}]`);
      }
    }

    if (r.ok) {
      // Cache for 3 seconds - balances freshness with request reduction
      cache.set(cacheKey, {
        data: j,
        expires: now + 3000,
      });

      // Clean up old cache entries periodically
      if (cache.size > 100) {
        for (const [key, value] of cache.entries()) {
          if (value.expires <= now) {
            cache.delete(key);
          }
        }
      }
    }

    // Aggressive caching headers - clients can cache for 3s, Vercel Edge can serve stale for 30s
    res.setHeader("Cache-Control", "public, max-age=3, s-maxage=3, stale-while-revalidate=30");
    res.setHeader("X-Cache", "MISS");
    return res.status(r.ok ? 200 : 400).json(j);
  } catch (e) {
    const error = e as Error;
    return res.status(500).json({ error: error.message ?? "Internal error" });
  }
}
