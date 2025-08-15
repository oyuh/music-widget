// src/pages/api/lastfm/trackInfo.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

const LFM_KEY = process.env.NEXT_PUBLIC_LFM_KEY!;
const LFM_SECRET = process.env.LFM_SHARED_SECRET!;

function sign(params: Record<string, string>) {
  const keys = Object.keys(params).sort();
  const sigBase = keys.map(k => `${k}${params[k]}`).join("") + LFM_SECRET;
  return crypto.createHash("md5").update(sigBase, "utf8").digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { artist, track, sk } = req.query as { artist?: string; track?: string; sk?: string };
    if (!artist || !track) return res.status(400).json({ error: "Missing artist/track" });

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
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(r.ok ? 200 : 400).json(j);
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? "Internal error" });
  }
}
