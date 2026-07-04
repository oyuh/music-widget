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

// Signed recent-tracks URLs for private (session-key) profiles. The server
// signs the request once (Last.fm signatures carry no timestamp, so the URL
// stays valid for the life of the session key) and we reuse it for every poll,
// hitting Last.fm directly from the user's own IP just like public lookups.
// Keyed by user/limit/sk; stores the in-flight promise so concurrent callers
// share one sign request.
const signedRecentUrls = new Map<string, Promise<string>>();

function getSignedRecentUrl(user: string, limit: number, sessionKey: string): Promise<string> {
  const key = `${user}\0${limit}\0${sessionKey}`;
  let promise = signedRecentUrls.get(key);
  if (!promise) {
    const qs = `user=${encodeURIComponent(user)}&limit=${limit}&sk=${encodeURIComponent(sessionKey)}`;
    promise = fetch(`/api/lastfm/sign-recent?${qs}`).then(async (r) => {
      const data = (await r.json().catch(() => null)) as { url?: string } | null;
      if (!r.ok || !data?.url) throw new Error(`sign-recent http ${r.status}`);
      return data.url;
    });
    // Don't cache failures; the next poll retries the sign request.
    promise.catch(() => signedRecentUrls.delete(key));
    signedRecentUrls.set(key, promise);
  }
  return promise;
}

/**
 * Recent tracks. Public lookups go straight to Last.fm from the user's own IP
 * (so 200+ users each get their own per-IP budget); a network/CORS failure
 * falls back to our server proxy. Private (session-key) lookups need a signed
 * request, so the server signs the URL once and the client then polls Last.fm
 * directly with it, falling back to the proxy if signing or the direct call
 * fails.
 */
export async function fetchRecent(opts: {
  user: string;
  limit: number;
  apiKey: string;
  sessionKey?: string | null;
}): Promise<Record<string, unknown>> {
  const u = encodeURIComponent(opts.user);
  if (opts.sessionKey) {
    try {
      const url = await getSignedRecentUrl(opts.user, opts.limit, opts.sessionKey);
      return await fetchJson(url, true);
    } catch {
      return fetchJson(`/api/lastfm/recent?user=${u}&limit=${opts.limit}&sk=${encodeURIComponent(opts.sessionKey)}`, false);
    }
  }
  // Without any API key a direct call can only fail; use the proxy.
  if (!opts.apiKey) {
    return fetchJson(`/api/lastfm/recent?user=${u}&limit=${opts.limit}`, false);
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
  const skQs = opts.sessionKey ? `&sk=${encodeURIComponent(opts.sessionKey)}` : "";
  const proxyUrl = `/api/lastfm/trackInfo?artist=${a}&track=${t}${skQs}`;
  // track.getInfo is a public method even when the user's listening is
  // private, so go direct whenever we have an API key; the session key is
  // only needed on the proxy path, which signs with it.
  if (!opts.apiKey) {
    return fetchJson(proxyUrl, false);
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
    return fetchJson(proxyUrl, false);
  }
}
