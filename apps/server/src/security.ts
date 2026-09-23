import type { Context } from "hono";
import { BlockList, isIP } from "node:net";
import { redisEnabled, redisExpire, redisGet, redisIncr } from "./redis";
import { log } from "./log";

// --- Per-IP rate limiting -------------------------------------------------
// Lenient on purpose: normal widget polling and the editor stay well under it,
// so honest users are never penalized; only abusive bursts trip it, and only
// briefly. Fails OPEN when Redis is unavailable so the cache being down never
// blocks legitimate traffic.
const RL_WINDOW_SECONDS = 10;
const RL_MAX = 60; // ~360 requests/min/IP

// Cloudflare's published edge ranges (cloudflare.com/ips-v4 and ips-v6, pulled
// 2026-09). Rarely changes; refresh from those URLs if Cloudflare adds a range.
const CLOUDFLARE_EDGES = new BlockList();
for (const cidr of [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
  "2a06:98c0::/29", "2c0f:f248::/32",
]) {
  const [net, bits] = cidr.split("/") as [string, string];
  CLOUDFLARE_EDGES.addSubnet(net, Number(bits), net.includes(":") ? "ipv6" : "ipv4");
}

function isCloudflareEdge(ip: string): boolean {
  const version = isIP(ip);
  return version !== 0 && CLOUDFLARE_EDGES.check(ip, version === 6 ? "ipv6" : "ipv4");
}

export function clientIp(c: Context): string {
  // Railway's edge strips client-sent X-Forwarded-For, so the first entry is the
  // address that actually connected to it.
  const peer = c.req.header("x-forwarded-for")?.split(",")[0]!.trim() || c.req.header("x-real-ip") || "";
  if (!peer) return c.req.header("cf-connecting-ip") || "unknown";
  // Through Cloudflare's proxy that peer is a shared Cloudflare edge, so use the
  // visitor address Cloudflare reports. Only then: anyone reaching the Railway
  // domain directly could send CF-Connecting-IP themselves.
  if (isCloudflareEdge(peer)) return c.req.header("cf-connecting-ip") || peer;
  return peer;
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

export type RateLimitUsage = {
  used: number;
  max: number;
  windowSeconds: number;
  enabled: boolean;
};

/**
 * Read an IP's request count in the current rate-limit window WITHOUT
 * incrementing it, so the editor footer can show real usage for the visitor's
 * own IP. `enabled: false` means Redis is off or unreachable and there's no
 * number to show.
 */
export async function rateLimitUsage(ip: string): Promise<RateLimitUsage> {
  const base = { max: RL_MAX, windowSeconds: RL_WINDOW_SECONDS };
  if (!redisEnabled()) return { ...base, used: 0, enabled: false };
  try {
    const bucket = Math.floor(Date.now() / 1000 / RL_WINDOW_SECONDS);
    const raw = await redisGet(`rl:${ip}:${bucket}`);
    return { ...base, used: raw ? parseInt(raw, 10) || 0 : 0, enabled: true };
  } catch {
    return { ...base, used: 0, enabled: false };
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
  "pinimg.com" // pinterest image (primarily for fall back)
];

export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}
