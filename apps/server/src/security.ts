import type { Context } from "hono";
import { redisEnabled, redisExpire, redisIncr } from "./redis";
import { log } from "./log";

// --- Per-IP rate limiting -------------------------------------------------
// Lenient on purpose: normal widget polling and the editor stay well under it,
// so honest users are never penalized — only abusive bursts trip it, and only
// briefly. Fails OPEN when Redis is unavailable so the cache being down never
// blocks legitimate traffic.
const RL_WINDOW_SECONDS = 10;
const RL_MAX = 60; // ~360 requests/min/IP

export function clientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return c.req.header("cf-connecting-ip") || c.req.header("x-real-ip") || "unknown";
}

export async function rateLimitOk(ip: string, reqId: string): Promise<{ ok: boolean; retryAfter: number }> {
  if (!redisEnabled()) return { ok: true, retryAfter: 0 };
  try {
    const bucket = Math.floor(Date.now() / 1000 / RL_WINDOW_SECONDS);
    const key = `rl:${ip}:${bucket}`;
    const count = await redisIncr(key);
    if (count === 1) await redisExpire(key, RL_WINDOW_SECONDS);
    if (count > RL_MAX) {
      log("warn", "ratelimit.exceeded", { requestId: reqId, ip, count });
      return { ok: false, retryAfter: RL_WINDOW_SECONDS };
    }
    return { ok: true, retryAfter: 0 };
  } catch {
    return { ok: true, retryAfter: 0 }; // fail open
  }
}

/**
 * Generic fixed-window limiter for a single named action (e.g. usage logging or
 * the contact form), separate from the global per-IP limit above. `bucket`
 * scopes the counter (typically a client IP). Fails OPEN when Redis is down.
 */
export async function rateLimit(action: string, bucketId: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!redisEnabled()) return true;
  try {
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `rl:${action}:${bucketId}:${window}`;
    const count = await redisIncr(key);
    if (count === 1) await redisExpire(key, windowSeconds);
    return count <= max;
  } catch {
    return true; // fail open
  }
}

// --- Image proxy host allowlist ------------------------------------------
// The image proxy must only fetch known album-art CDNs, otherwise it becomes an
// open proxy / SSRF vector (fetching internal hosts, arbitrary sites, etc.).
const ALLOWED_IMAGE_HOST_SUFFIXES = [
  "last.fm",
  "fastly.net", // lastfm.freetls.fastly.net
  "akamaized.net", // older Last.fm art
  "scdn.co", // Spotify
  "mzstatic.com", // Apple Music
  "ytimg.com", // YouTube Music
  "googleusercontent.com",
  "cdninstagram.com",
  "fbcdn.net",
];

export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}
