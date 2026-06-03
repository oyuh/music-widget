import { serviceStatus } from "./status.svelte";

const LFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";
const SHARED_KEY: string = import.meta.env.VITE_LFM_KEY || "";

/** The effective Last.fm API key: a user's BYOK key if set, else the shared key. */
export function resolveApiKey(configKey?: string | null): string {
  return (configKey && configKey.trim()) || SHARED_KEY;
}

async function fetchJson(url: string, fromLastfm: boolean): Promise<Record<string, unknown>> {
  const r = await fetch(url, { cache: "no-store" });
  if (r.status === 429) serviceStatus.markRateLimited();
  const data = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (fromLastfm) serviceStatus.noteLastfm(r.ok, data);
  // A Last.fm error payload (e.g. user-not-found) is a valid response; only a
  // transport failure should fall back to the server proxy.
  if (!r.ok && !(data && "error" in data)) throw new Error(`lastfm http ${r.status}`);
  return data ?? {};
}

/**
 * Recent tracks. Public lookups go straight to Last.fm from the user's own IP
 * (so 200+ users each get their own per-IP budget); a network/CORS failure
 * falls back to our server proxy. Private (session-key) lookups must be signed,
 * so they always go through the server.
 */
export async function fetchRecent(opts: {
  user: string;
  limit: number;
  apiKey: string;
  sessionKey?: string | null;
}): Promise<Record<string, unknown>> {
  const u = encodeURIComponent(opts.user);
  if (opts.sessionKey) {
    return fetchJson(`/api/lastfm/recent?user=${u}&limit=${opts.limit}&sk=${encodeURIComponent(opts.sessionKey)}`, false);
  }
  const qs = new URLSearchParams({
    method: "user.getRecentTracks",
    user: opts.user,
    limit: String(opts.limit),
    api_key: opts.apiKey,
    format: "json",
  });
  try {
    return await fetchJson(`${LFM_ENDPOINT}?${qs.toString()}`, true);
  } catch {
    return fetchJson(`/api/lastfm/recent?user=${u}&limit=${opts.limit}`, false);
  }
}

export async function fetchTrackInfo(opts: {
  artist: string;
  track: string;
  apiKey: string;
  sessionKey?: string | null;
}): Promise<Record<string, unknown>> {
  const a = encodeURIComponent(opts.artist);
  const t = encodeURIComponent(opts.track);
  if (opts.sessionKey) {
    return fetchJson(`/api/lastfm/trackInfo?artist=${a}&track=${t}&sk=${encodeURIComponent(opts.sessionKey)}`, false);
  }
  const qs = new URLSearchParams({
    method: "track.getInfo",
    artist: opts.artist,
    track: opts.track,
    api_key: opts.apiKey,
    format: "json",
  });
  try {
    return await fetchJson(`${LFM_ENDPOINT}?${qs.toString()}`, true);
  } catch {
    return fetchJson(`/api/lastfm/trackInfo?artist=${a}&track=${t}`, false);
  }
}
