import type { Context } from "hono";
import type { AppEnv } from "./types";
import { withJsonCache } from "./cache";
import { json, sha256, signLastfm } from "./util";
import { log } from "./log";

const RECENT_TTL_SECONDS = 3;
const TRACK_INFO_TTL_SECONDS = 60 * 60 * 24;
const LASTFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";

type Handler = (c: Context<AppEnv>) => Promise<Response>;

function lastfmEnv() {
  return {
    apiKey: process.env.LFM_API_KEY,
    sharedSecret: process.env.LFM_SHARED_SECRET,
  };
}

/** Returns a 500 Response when Last.fm credentials are missing, otherwise null. */
function requireLastfmEnv(): Response | null {
  const { apiKey, sharedSecret } = lastfmEnv();
  if (!apiKey || !sharedSecret) {
    return json(
      { error: "Server missing Last.fm credentials. Set LFM_API_KEY and LFM_SHARED_SECRET." },
      { status: 500 },
    );
  }
  return null;
}

export const handleRecent: Handler = async (c) => {
  const reqId = c.get("reqId");
  const user = c.req.query("user") || "";
  const limit = c.req.query("limit") || "1";
  const sk = c.req.query("sk") || "";

  if (!user) {
    log("warn", "api.lastfm.recent.missing_user", { requestId: reqId });
    return json({ error: "Missing user" }, { status: 400 });
  }

  const envError = requireLastfmEnv();
  if (envError) return envError;
  const { apiKey, sharedSecret } = lastfmEnv();

  const authKey = sk ? sha256(sk).slice(0, 32) : "public";
  const cacheKey = `recent:${encodeURIComponent(user)}:${encodeURIComponent(limit)}:${authKey}`;

  return withJsonCache({
    requestId: reqId,
    cacheKey,
    ttlSeconds: RECENT_TTL_SECONDS,
    cacheControl: "public, max-age=3, s-maxage=3, stale-while-revalidate=30",
    fetcher: async () => {
      const base: Record<string, string> = {
        method: "user.getRecentTracks",
        user,
        limit,
        api_key: apiKey!,
      };

      const params = sk ? { ...base, sk } : base;
      const api_sig = sk ? signLastfm(params, sharedSecret!) : "";
      const qs = new URLSearchParams(sk ? { ...params, api_sig, format: "json" } : { ...params, format: "json" });

      const upstreamT0 = Date.now();
      const upstream = await fetch(`${LASTFM_ENDPOINT}?${qs.toString()}`);
      const body = await upstream.text();

      log("info", "api.lastfm.recent.upstream", {
        requestId: reqId,
        upstreamStatus: upstream.status,
        upstreamOk: upstream.ok,
        upstreamMs: Date.now() - upstreamT0,
      });

      return {
        body,
        status: upstream.ok ? 200 : 400,
        cacheable: upstream.ok,
      };
    },
  });
};

export const handleTrackInfo: Handler = async (c) => {
  const reqId = c.get("reqId");
  const artist = c.req.query("artist") || "";
  const track = c.req.query("track") || "";
  const sk = c.req.query("sk") || "";

  if (!artist || !track) {
    return json({ error: "Missing artist/track" }, { status: 400 });
  }

  const envError = requireLastfmEnv();
  if (envError) return envError;
  const { apiKey, sharedSecret } = lastfmEnv();

  const cacheKey = `info:${sha256(`${artist}\0${track}`).slice(0, 40)}`;

  return withJsonCache({
    requestId: reqId,
    cacheKey,
    ttlSeconds: TRACK_INFO_TTL_SECONDS,
    cacheControl: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    fetcher: async () => {
      const base: Record<string, string> = {
        method: "track.getInfo",
        artist,
        track,
        api_key: apiKey!,
      };

      const params = sk ? { ...base, sk } : base;
      const api_sig = sk ? signLastfm(params, sharedSecret!) : "";
      const qs = new URLSearchParams(sk ? { ...params, api_sig, format: "json" } : { ...params, format: "json" });

      const upstreamT0 = Date.now();
      const upstream = await fetch(`${LASTFM_ENDPOINT}?${qs.toString()}`);
      const body = await upstream.text();

      log("info", "api.lastfm.trackInfo.upstream", {
        requestId: reqId,
        upstreamStatus: upstream.status,
        upstreamOk: upstream.ok,
        upstreamMs: Date.now() - upstreamT0,
      });

      return {
        body,
        status: upstream.ok ? 200 : 400,
        cacheable: upstream.ok,
      };
    },
  });
};

export const handleSession: Handler = async (c) => {
  const reqId = c.get("reqId");

  const envError = requireLastfmEnv();
  if (envError) return envError;
  const { apiKey, sharedSecret } = lastfmEnv();

  let token = "";
  try {
    const body = (await c.req.json()) as { token?: string };
    token = body.token || "";
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!token) return json({ error: "Missing token" }, { status: 400 });

  const params: Record<string, string> = {
    api_key: apiKey!,
    method: "auth.getSession",
    token,
  };
  const api_sig = signLastfm(params, sharedSecret!);
  const qs = new URLSearchParams({ ...params, api_sig, format: "json" });

  const upstreamT0 = Date.now();
  const upstream = await fetch(`${LASTFM_ENDPOINT}?${qs.toString()}`);
  const data = (await upstream.json()) as { session?: { key?: string; name?: string }; message?: string };

  log("info", "api.lastfm.session.upstream", {
    requestId: reqId,
    upstreamStatus: upstream.status,
    upstreamOk: upstream.ok,
    upstreamMs: Date.now() - upstreamT0,
  });

  if (data.session?.key && data.session.name) {
    return json(
      { key: data.session.key, name: data.session.name },
      {
        status: 200,
        headers: {
          "Cache-Control": "s-maxage=10, stale-while-revalidate=30",
        },
      },
    );
  }

  return json({ error: data.message || "Failed to get session" }, { status: 400 });
};

export const handleProxyImage: Handler = async (c) => {
  const reqId = c.get("reqId");
  const raw = c.req.query("url") || "";

  if (!/^https?:\/\//i.test(raw)) {
    return json({ error: "Invalid url" }, { status: 400 });
  }

  const safe = new URL(raw);
  const upstreamT0 = Date.now();
  const upstream = await fetch(raw, {
    headers: {
      "User-Agent": "music-widget/1.0 (+https://github.com/oyuh/music-widget)",
    },
  });

  if (!upstream.ok) {
    log("warn", "api.proxy-image.upstream_not_ok", {
      requestId: reqId,
      upstreamHost: safe.host,
      upstreamStatus: upstream.status,
      upstreamMs: Date.now() - upstreamT0,
    });
    return new Response(null, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
