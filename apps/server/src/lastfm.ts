import type { Context } from "hono";
import type { AppEnv } from "./types";
import { withJsonCache } from "./cache";
import { json, sha256, signLastfm } from "./util";
import { isAllowedImageHost } from "./security";
import { log, levelEnabled, type JsonValue } from "./log";

const RECENT_TTL_SECONDS = 3;
const TRACK_INFO_TTL_SECONDS = 60 * 60 * 24;
const LASTFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";

/** Human hints for the Last.fm error codes we actually see in the wild. */
const LASTFM_ERROR_HINTS: Record<number, string> = {
  4: "authentication failed",
  6: "user not found",
  9: "invalid session key, user needs to re-auth",
  10: "invalid api key",
  11: "last.fm service offline",
  16: "temporary upstream error",
  17: "login required, user's recent listening is likely private",
  26: "api key suspended",
  29: "rate limit exceeded",
};

type LastfmErrorBody = { error?: number; message?: string };

type RecentTrack = {
  name?: string;
  artist?: { "#text"?: string; name?: string };
  "@attr"?: { nowplaying?: string };
};

function lastfmErrorFields(data: LastfmErrorBody): Record<string, JsonValue> {
  const fields: Record<string, JsonValue> = {};
  if (typeof data.error === "number") {
    fields.lfmError = data.error;
    const hint = LASTFM_ERROR_HINTS[data.error];
    if (hint) fields.hint = hint;
  }
  if (data.message) fields.lfmMessage = data.message;
  return fields;
}

/**
 * Log-only enrichment for user.getRecentTracks bodies. Parsing is gated on the
 * log level so it costs nothing when info logs are disabled, and it never throws.
 */
function recentLogFields(body: string, ok: boolean): Record<string, JsonValue> {
  if (!levelEnabled("info")) return {};
  try {
    const data = JSON.parse(body) as LastfmErrorBody & {
      recenttracks?: { track?: RecentTrack[] | RecentTrack };
    };
    if (!ok || typeof data.error === "number") return lastfmErrorFields(data);

    const first = Array.isArray(data.recenttracks?.track)
      ? data.recenttracks.track[0]
      : data.recenttracks?.track;
    if (!first) return { track: "(no recent tracks)" };

    const artist = first.artist?.["#text"] || first.artist?.name || "?";
    return {
      track: `${artist} – ${first.name || "?"}`,
      nowPlaying: first["@attr"]?.nowplaying === "true",
    };
  } catch {
    return {};
  }
}

/** Error-only enrichment for upstream bodies; skips parsing entirely on success. */
function upstreamErrorLogFields(body: string, ok: boolean): Record<string, JsonValue> {
  if (ok || !levelEnabled("info")) return {};
  try {
    return lastfmErrorFields(JSON.parse(body) as LastfmErrorBody);
  } catch {
    return {};
  }
}

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
  const limit = String(Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "1", 10) || 1)));
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
        user,
        auth: sk ? "session" : "public",
        upstreamStatus: upstream.status,
        upstreamOk: upstream.ok,
        upstreamMs: Date.now() - upstreamT0,
        ...recentLogFields(body, upstream.ok),
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
        track: `${artist} – ${track}`,
        upstreamStatus: upstream.status,
        upstreamOk: upstream.ok,
        upstreamMs: Date.now() - upstreamT0,
        ...upstreamErrorLogFields(body, upstream.ok),
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
  const data = (await upstream.json()) as LastfmErrorBody & {
    session?: { key?: string; name?: string };
  };

  log("info", "api.lastfm.session.upstream", {
    requestId: reqId,
    upstreamStatus: upstream.status,
    upstreamOk: upstream.ok,
    upstreamMs: Date.now() - upstreamT0,
    ...(data.session?.name ? { user: data.session.name } : {}),
    ...lastfmErrorFields(data),
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
  if (!isAllowedImageHost(safe.hostname)) {
    log("warn", "api.proxy-image.host_blocked", { requestId: reqId, host: safe.host });
    return json({ error: "Image host not allowed" }, { status: 400 });
  }

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
