// src/pages/api/lastfm/trackInfo.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

const LFM_KEY = process.env.NEXT_PUBLIC_LFM_KEY!;
const LFM_SECRET = process.env.LFM_SHARED_SECRET!;

// In-memory cache for track info (duration data doesn't change)
const cache = new Map<string, { data: unknown; expires: number }>();

function sign(params: Record<string, string>) {
  const keys = Object.keys(params).sort();
  const sigBase = keys.map(k => `${k}${params[k]}`).join("") + LFM_SECRET;
  return crypto.createHash("md5").update(sigBase, "utf8").digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { artist, track, sk } = req.query as { artist?: string; track?: string; sk?: string };
    if (!artist || !track) return res.status(400).json({ error: "Missing artist/track" });

    // Create cache key (track info is same regardless of session key)
    const cacheKey = `info:${artist}:${track}`;
    const now = Date.now();

    // Check cache - track info rarely changes, cache for 1 hour
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now) {
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, immutable");
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached.data);
    }

    const base: Record<string, string> = {
      method: "track.getInfo",
      artist: String(artist),
      track: String(track),
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

    if (r.ok) {
      // Cache track info for 1 hour (track metadata doesn't change)
      cache.set(cacheKey, {
        data: j,
        expires: now + 3600000,
      });

      // Clean up old entries
      if (cache.size > 500) {
        for (const [key, value] of cache.entries()) {
          if (value.expires <= now) {
            cache.delete(key);
          }
        }
      }
    }

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, immutable");
    res.setHeader("X-Cache", "MISS");
    return res.status(r.ok ? 200 : 400).json(j);
  } catch (e) {
    const error = e as Error;
    return res.status(500).json({ error: error.message ?? "Internal error" });
  }

  console.log(`Fetched track info for ${req.query.artist} - ${req.query.track}`);
}
