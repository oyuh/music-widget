// src/pages/api/lastfm/session.ts
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
    if (!LFM_KEY || !LFM_SECRET) {
      return res.status(500).json({ error: "Server missing Last.fm credentials. Set NEXT_PUBLIC_LFM_KEY and LFM_SHARED_SECRET." });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Note: Do NOT include `format` in the signature per Last.fm docs.
    const params: Record<string, string> = {
      api_key: LFM_KEY,
      method: "auth.getSession",
      token,
    };
    const api_sig = sign(params);
    const qs = new URLSearchParams({ ...params, api_sig, format: "json" });
    const url = `https://ws.audioscrobbler.com/2.0/?${qs.toString()}`;

  const r = await fetch(url);
    const j = await r.json();

    if (j?.session?.key && j?.session?.name) {
      // 10s CDN cache (safe)
      res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
      return res.status(200).json({ key: j.session.key as string, name: j.session.name as string });
    }
    return res.status(400).json({ error: j?.message ?? "Failed to get session" });
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? "Internal error" });
  }
}
