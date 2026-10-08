import type { Context } from "hono";
import { BlockList, isIP } from "node:net";
import { log } from "./log";

// --- Per-IP rate limiting -------------------------------------------------
// Lenient on purpose: normal widget polling and the editor stay well under it,
// so honest users are never penalized; only abusive bursts trip it, and only
// briefly. Counters live in process memory, which is fine for one container.
const RL_WINDOW_SECONDS = 10;
const RL_MAX = 60; // ~360 requests/min/IP

type Counter = { count: number; expires: number };
const counters = new Map<string, Counter>();

// Drop expired windows once a minute so idle IPs don't pile up.
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of counters) if (value.expires <= now) counters.delete(key);
}, 60_000).unref();

/** Increment `key` within a fixed window and return the new count. */
function incr(key: string, windowSeconds: number): number {
  const now = Date.now();
  const existing = counters.get(key);
  if (existing && existing.expires > now) return ++existing.count;
  counters.set(key, { count: 1, expires: now + windowSeconds * 1000 });
  return 1;
}

function peek(key: string): number {
  const existing = counters.get(key);
  return existing && existing.expires > Date.now() ? existing.count : 0;
}

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

export function rateLimitOk(ip: string, reqId: string): { ok: boolean; retryAfter: number } {
  const bucket = Math.floor(Date.now() / 1000 / RL_WINDOW_SECONDS);
  const count = incr(`rl:${ip}:${bucket}`, RL_WINDOW_SECONDS);
  if (count > RL_MAX) {
    log("warn", "ratelimit.exceeded", { requestId: reqId, ip, count });
    return { ok: false, retryAfter: RL_WINDOW_SECONDS };
  }
  return { ok: true, retryAfter: 0 };
}

export type RateLimitUsage = {
  used: number;
  max: number;
  windowSeconds: number;
};

/**
 * Read an IP's request count in the current rate-limit window WITHOUT
 * incrementing it, so the editor footer can show real usage for the visitor's
 * own IP.
 */
export function rateLimitUsage(ip: string): RateLimitUsage {
  const bucket = Math.floor(Date.now() / 1000 / RL_WINDOW_SECONDS);
  return { used: peek(`rl:${ip}:${bucket}`), max: RL_MAX, windowSeconds: RL_WINDOW_SECONDS };
}

/**
 * Generic fixed-window limiter for a single named action (e.g. usage logging or
 * the contact form), separate from the global per-IP limit above. `bucket`
 * scopes the counter (typically a client IP).
 */
export function rateLimit(action: string, bucketId: string, max: number, windowSeconds: number): boolean {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  return incr(`rl:${action}:${bucketId}:${window}`, windowSeconds) <= max;
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
