// src/pages/api/proxy-image.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getRequestId, logError, logInfo, logWarn, safeUrlForLog, serializeError } from "@/utils/serverLog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = getRequestId(req);
  const t0 = Date.now();
  const url = (req.query.url as string) || "";
  if (!url || !/^https?:\/\//i.test(url)) {
    logWarn("api.proxy-image.invalid_url", {
      requestId,
      method: req.method || "",
      path: req.url || "",
    });
    res.status(400).json({ error: "Invalid url" });
    return;
  }
  try {
    const safe = safeUrlForLog(url);
    logInfo("api.proxy-image.start", {
      requestId,
      method: req.method || "",
      path: req.url || "",
      upstreamHost: safe.host || "",
      upstreamPath: safe.pathname || "",
    });

    const upstreamT0 = Date.now();
    const upstream = await fetch(url, { headers: { "User-Agent": "music-widget/1.0 (+https://github.com/oyuh/music-widget)" } });
    if (!upstream.ok) {
      logWarn("api.proxy-image.upstream_not_ok", {
        requestId,
        upstreamStatus: upstream.status,
        upstreamMs: Date.now() - upstreamT0,
      });
      res.status(upstream.status).end();
      return;
    }
    const ct = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    // Album art images are immutable - cache aggressively for 7 days on Vercel Edge
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buf = Buffer.from(await upstream.arrayBuffer());

    logInfo("api.proxy-image.ok", {
      requestId,
      status: 200,
      contentType: ct,
      bytes: buf.byteLength,
      durationMs: Date.now() - t0,
    });
    res.status(200).send(buf);
  } catch (e) {
    logError("api.proxy-image.error", {
      requestId,
      durationMs: Date.now() - t0,
      error: serializeError(e),
    });
    res.status(500).json({ error: "Proxy error" });
  }

  console.log(`Proxied image: ${url}`);
}
