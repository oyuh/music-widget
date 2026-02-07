// src/pages/api/lastfm/session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getRequestId, logError, logInfo, logWarn, serializeError } from "@/utils/serverLog";

const LFM_KEY = process.env.NEXT_PUBLIC_LFM_KEY!;
const LFM_SECRET = process.env.LFM_SHARED_SECRET!;

function sign(params: Record<string, string>) {
  const keys = Object.keys(params).sort();
  const sigBase = keys.map(k => `${k}${params[k]}`).join("") + LFM_SECRET;
  return crypto.createHash("md5").update(sigBase, "utf8").digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = getRequestId(req);
  const t0 = Date.now();
  try {
    if (!LFM_KEY || !LFM_SECRET) {
      logError("api.lastfm.session.missing_env", {
        requestId,
        hasKey: Boolean(LFM_KEY),
        hasSecret: Boolean(LFM_SECRET),
      });
      return res.status(500).json({ error: "Server missing Last.fm credentials. Set NEXT_PUBLIC_LFM_KEY and LFM_SHARED_SECRET." });
    }
    if (req.method !== "POST") {
      logWarn("api.lastfm.session.method_not_allowed", { requestId, method: req.method || "", path: req.url || "" });
      return res.status(405).json({ error: "Method not allowed" });
    }
    const { token } = req.body as { token?: string };
    if (!token) {
      logWarn("api.lastfm.session.missing_token", { requestId, path: req.url || "" });
      return res.status(400).json({ error: "Missing token" });
    }

    logInfo("api.lastfm.session.start", {
      requestId,
      method: req.method || "",
      path: req.url || "",
      hasToken: true,
      tokenLength: token.length,
    });

    // Note: Do NOT include `format` in the signature per Last.fm docs.
    const params: Record<string, string> = {
      api_key: LFM_KEY,
      method: "auth.getSession",
      token,
    };
    const api_sig = sign(params);
    const qs = new URLSearchParams({ ...params, api_sig, format: "json" });
    const url = `https://ws.audioscrobbler.com/2.0/?${qs.toString()}`;

    const upstreamT0 = Date.now();
    const r = await fetch(url);
    const j = await r.json();

    logInfo("api.lastfm.session.upstream", {
      requestId,
      upstreamHost: "ws.audioscrobbler.com",
      upstreamStatus: r.status,
      upstreamOk: r.ok,
      upstreamMs: Date.now() - upstreamT0,
    });

    if (j?.session?.key && j?.session?.name) {
      // 10s CDN cache (safe)
      res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
      logInfo("api.lastfm.session.end", { requestId, status: 200, durationMs: Date.now() - t0 });
      return res.status(200).json({ key: j.session.key as string, name: j.session.name as string });
    }
    logWarn("api.lastfm.session.failed", {
      requestId,
      status: 400,
      durationMs: Date.now() - t0,
      upstreamMessage: typeof j?.message === "string" ? j.message : "",
    });
    return res.status(400).json({ error: j?.message ?? "Failed to get session" });
  } catch (e: unknown) {
    logError("api.lastfm.session.error", {
      requestId,
      durationMs: Date.now() - t0,
      error: serializeError(e),
    });
    const err = serializeError(e);
    return res.status(500).json({ error: err.message ?? "Internal error" });
  }
}
