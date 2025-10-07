// src/pages/api/proxy-image.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = (req.query.url as string) || "";
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "Invalid url" });
    return;
  }
  try {
    const upstream = await fetch(url, { headers: { "User-Agent": "music-widget/1.0 (+https://github.com/oyuh/music-widget)" } });
    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }
    const ct = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    // Album art images are immutable - cache aggressively for 7 days on Vercel Edge
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } catch {
    res.status(500).json({ error: "Proxy error" });
  }
}
