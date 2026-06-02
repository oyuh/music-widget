import { createHash } from "node:crypto";
import { connect } from "cloudflare:sockets";

type RedisSocket = ReturnType<typeof connect>;

export interface Env {
  ASSETS: Fetcher;
  LFM_API_KEY?: string;
  LFM_SHARED_SECRET?: string;
  REDIS_URL?: string;
  LOG_LEVEL?: string;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type CachedJson = {
  body: string;
  expires: number;
};

type UpstreamJson = {
  body: string;
  status: number;
  cacheable: boolean;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const l1JsonCache = new Map<string, CachedJson>();
const inFlightJson = new Map<string, Promise<UpstreamJson>>();

const RECENT_TTL_SECONDS = 3;
const TRACK_INFO_TTL_SECONDS = 60 * 60 * 24;
const REDIS_TIMEOUT_MS = 1500;

function md5(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function signLastfm(params: Record<string, string>, secret: string) {
  const sigBase = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("") + secret;
  return md5(sigBase);
}

function requestId(request: Request) {
  return request.headers.get("x-request-id")
    || request.headers.get("cf-ray")
    || request.headers.get("x-amzn-trace-id")
    || crypto.randomUUID();
}

function log(level: "debug" | "info" | "warn" | "error", event: string, meta: Record<string, JsonValue> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function jsonText(body: string, status: number, headers: HeadersInit = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function getOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeCommand(args: string[]) {
  const chunks: Uint8Array[] = [textEncoder.encode(`*${args.length}\r\n`)];
  for (const arg of args) {
    const encoded = textEncoder.encode(arg);
    chunks.push(textEncoder.encode(`$${encoded.byteLength}\r\n`), encoded, textEncoder.encode("\r\n"));
  }
  return concatBytes(chunks);
}

function concatBytes(chunks: Uint8Array[]) {
  const len = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function appendBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

function findCrlf(buffer: Uint8Array, start: number) {
  for (let i = start; i < buffer.byteLength - 1; i++) {
    if (buffer[i] === 13 && buffer[i + 1] === 10) return i;
  }
  return -1;
}

function decodeAscii(buffer: Uint8Array, start: number, end: number) {
  return textDecoder.decode(buffer.slice(start, end));
}

function parseResp(buffer: Uint8Array, offset = 0): { value: unknown; offset: number } | null {
  if (offset >= buffer.byteLength) return null;

  const prefix = buffer[offset];
  const lineEnd = findCrlf(buffer, offset + 1);
  if (lineEnd < 0) return null;

  if (prefix === 43) {
    return { value: decodeAscii(buffer, offset + 1, lineEnd), offset: lineEnd + 2 };
  }

  if (prefix === 45) {
    throw new Error(`Redis error: ${decodeAscii(buffer, offset + 1, lineEnd)}`);
  }

  if (prefix === 58) {
    return { value: Number(decodeAscii(buffer, offset + 1, lineEnd)), offset: lineEnd + 2 };
  }

  if (prefix === 36) {
    const length = Number(decodeAscii(buffer, offset + 1, lineEnd));
    if (length === -1) return { value: null, offset: lineEnd + 2 };
    const dataStart = lineEnd + 2;
    const dataEnd = dataStart + length;
    if (buffer.byteLength < dataEnd + 2) return null;
    return {
      value: textDecoder.decode(buffer.slice(dataStart, dataEnd)),
      offset: dataEnd + 2,
    };
  }

  if (prefix === 42) {
    const count = Number(decodeAscii(buffer, offset + 1, lineEnd));
    if (count === -1) return { value: null, offset: lineEnd + 2 };
    const values: unknown[] = [];
    let nextOffset = lineEnd + 2;
    for (let i = 0; i < count; i++) {
      const parsed = parseResp(buffer, nextOffset);
      if (!parsed) return null;
      values.push(parsed.value);
      nextOffset = parsed.offset;
    }
    return { value: values, offset: nextOffset };
  }

  throw new Error(`Unsupported Redis RESP prefix: ${String.fromCharCode(prefix)}`);
}

function timeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

class RedisClient {
  private readonly hostname: string;
  private readonly port: number;
  private readonly secureTransport: "off" | "on";
  private readonly username: string;
  private readonly password: string;
  private readonly db: string;

  constructor(redisUrl: string) {
    const parsed = new URL(redisUrl);
    this.hostname = parsed.hostname;
    this.port = Number(parsed.port || 6379);
    this.secureTransport = parsed.protocol === "rediss:" ? "on" : "off";
    this.username = decodeURIComponent(parsed.username || "");
    this.password = decodeURIComponent(parsed.password || "");
    this.db = parsed.pathname.replace(/^\//, "");
  }

  async get(key: string) {
    const result = await this.command(["GET", key]);
    return typeof result === "string" ? result : null;
  }

  async setEx(key: string, seconds: number, value: string) {
    await this.command(["SET", key, value, "EX", String(seconds)]);
  }

  async ping() {
    const result = await this.command(["PING"]);
    return result === "PONG";
  }

  private async command(command: string[]) {
    const commands: string[][] = [];
    if (this.password) {
      commands.push(this.username ? ["AUTH", this.username, this.password] : ["AUTH", this.password]);
    }
    if (this.db && this.db !== "0") commands.push(["SELECT", this.db]);
    commands.push(command);

    let socket: RedisSocket | undefined;
    try {
      socket = connect(
        { hostname: this.hostname, port: this.port },
        { secureTransport: this.secureTransport, allowHalfOpen: false },
      );
      await timeout(socket.opened, REDIS_TIMEOUT_MS, "Redis connect");

      const writer = socket.writable.getWriter();
      await timeout(writer.write(concatBytes(commands.map(encodeCommand))), REDIS_TIMEOUT_MS, "Redis write");
      writer.releaseLock();

      const replies = await readRespReplies(socket, commands.length);
      return replies[replies.length - 1];
    } finally {
      if (socket) {
        await socket.close().catch(() => undefined);
      }
    }
  }
}

async function readRespReplies(socket: RedisSocket, count: number) {
  const reader = socket.readable.getReader();
  let buffer = new Uint8Array();
  let offset = 0;
  const replies: unknown[] = [];

  try {
    while (replies.length < count) {
      while (replies.length < count) {
        const parsed = parseResp(buffer, offset);
        if (!parsed) break;
        replies.push(parsed.value);
        offset = parsed.offset;
      }

      if (replies.length >= count) break;

      const result = await timeout<ReadableStreamReadResult<Uint8Array>>(reader.read(), REDIS_TIMEOUT_MS, "Redis read");
      if (result.done) break;
      buffer = appendBytes(buffer.slice(offset), result.value);
      offset = 0;
    }
  } finally {
    reader.releaseLock();
  }

  if (replies.length < count) {
    throw new Error("Redis connection closed before a complete response was read");
  }

  return replies;
}

function redisFor(env: Env) {
  if (!env.REDIS_URL) return null;
  return new RedisClient(env.REDIS_URL);
}

function getL1(key: string) {
  const cached = l1JsonCache.get(key);
  const now = Date.now();
  if (!cached) return null;
  if (cached.expires <= now) {
    l1JsonCache.delete(key);
    return null;
  }
  return cached.body;
}

function setL1(key: string, ttlSeconds: number, body: string) {
  l1JsonCache.set(key, {
    body,
    expires: Date.now() + ttlSeconds * 1000,
  });

  if (l1JsonCache.size > 500) {
    const now = Date.now();
    for (const [cacheKey, value] of l1JsonCache.entries()) {
      if (value.expires <= now) l1JsonCache.delete(cacheKey);
    }
  }
}

async function getCachedJson(env: Env, cacheKey: string, ttlSeconds: number, reqId: string) {
  const l1 = getL1(cacheKey);
  if (l1) return { body: l1, cache: "L1" };

  const redis = redisFor(env);
  if (!redis) return null;

  try {
    const body = await redis.get(cacheKey);
    if (!body) return null;
    setL1(cacheKey, ttlSeconds, body);
    return { body, cache: "REDIS" };
  } catch (error) {
    log("warn", "cache.redis_get_failed", {
      requestId: reqId,
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function cacheJson(env: Env, ctx: ExecutionContext, cacheKey: string, ttlSeconds: number, body: string, reqId: string) {
  setL1(cacheKey, ttlSeconds, body);

  const redis = redisFor(env);
  if (!redis) return;

  ctx.waitUntil(
    redis.setEx(cacheKey, ttlSeconds, body).catch((error) => {
      log("warn", "cache.redis_set_failed", {
        requestId: reqId,
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }),
  );
}

async function withJsonCache(args: {
  env: Env;
  ctx: ExecutionContext;
  requestId: string;
  cacheKey: string;
  ttlSeconds: number;
  cacheControl: string;
  fetcher: () => Promise<UpstreamJson>;
}) {
  const cached = await getCachedJson(args.env, args.cacheKey, args.ttlSeconds, args.requestId);
  if (cached) {
    return jsonText(cached.body, 200, {
      "Cache-Control": args.cacheControl,
      "X-Cache": cached.cache,
    });
  }

  const existing = inFlightJson.get(args.cacheKey);
  const promise = existing || args.fetcher();
  const coalesced = Boolean(existing);
  if (!existing) {
    inFlightJson.set(args.cacheKey, promise.finally(() => inFlightJson.delete(args.cacheKey)));
  }

  const result = await promise;

  if (result.cacheable) {
    await cacheJson(args.env, args.ctx, args.cacheKey, args.ttlSeconds, result.body, args.requestId);
  }

  return jsonText(result.body, result.status, {
    "Cache-Control": args.cacheControl,
    "X-Cache": coalesced ? "COALESCED" : "MISS",
  });
}

function requireLastfmEnv(env: Env) {
  if (!env.LFM_API_KEY || !env.LFM_SHARED_SECRET) {
    return json(
      { error: "Server missing Last.fm credentials. Set LFM_API_KEY and LFM_SHARED_SECRET." },
      { status: 500 },
    );
  }
  return null;
}

async function handleRecent(request: Request, env: Env, ctx: ExecutionContext, reqId: string) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") || "";
  const limit = url.searchParams.get("limit") || "1";
  const sk = url.searchParams.get("sk") || "";

  if (!user) {
    log("warn", "api.lastfm.recent.missing_user", { requestId: reqId, path: url.pathname });
    return json({ error: "Missing user" }, { status: 400 });
  }

  const envError = requireLastfmEnv(env);
  if (envError) return envError;

  const authKey = sk ? sha256(sk).slice(0, 32) : "public";
  const cacheKey = `recent:${encodeURIComponent(user)}:${encodeURIComponent(limit)}:${authKey}`;

  return withJsonCache({
    env,
    ctx,
    requestId: reqId,
    cacheKey,
    ttlSeconds: RECENT_TTL_SECONDS,
    cacheControl: "public, max-age=3, s-maxage=3, stale-while-revalidate=30",
    fetcher: async () => {
      const base: Record<string, string> = {
        method: "user.getRecentTracks",
        user,
        limit,
        api_key: env.LFM_API_KEY!,
      };

      const params = sk ? { ...base, sk } : base;
      const api_sig = sk ? signLastfm(params, env.LFM_SHARED_SECRET!) : "";
      const qs = new URLSearchParams(sk ? { ...params, api_sig, format: "json" } : { ...params, format: "json" });

      const upstreamT0 = Date.now();
      const upstream = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs.toString()}`);
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
}

async function handleTrackInfo(request: Request, env: Env, ctx: ExecutionContext, reqId: string) {
  const url = new URL(request.url);
  const artist = url.searchParams.get("artist") || "";
  const track = url.searchParams.get("track") || "";
  const sk = url.searchParams.get("sk") || "";

  if (!artist || !track) {
    return json({ error: "Missing artist/track" }, { status: 400 });
  }

  const envError = requireLastfmEnv(env);
  if (envError) return envError;

  const cacheKey = `info:${sha256(`${artist}\0${track}`).slice(0, 40)}`;

  return withJsonCache({
    env,
    ctx,
    requestId: reqId,
    cacheKey,
    ttlSeconds: TRACK_INFO_TTL_SECONDS,
    cacheControl: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    fetcher: async () => {
      const base: Record<string, string> = {
        method: "track.getInfo",
        artist,
        track,
        api_key: env.LFM_API_KEY!,
      };

      const params = sk ? { ...base, sk } : base;
      const api_sig = sk ? signLastfm(params, env.LFM_SHARED_SECRET!) : "";
      const qs = new URLSearchParams(sk ? { ...params, api_sig, format: "json" } : { ...params, format: "json" });

      const upstreamT0 = Date.now();
      const upstream = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs.toString()}`);
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
}

async function handleSession(request: Request, env: Env, reqId: string) {
  const envError = requireLastfmEnv(env);
  if (envError) return envError;

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let token = "";
  try {
    const body = (await request.json()) as { token?: string };
    token = body.token || "";
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!token) return json({ error: "Missing token" }, { status: 400 });

  const params: Record<string, string> = {
    api_key: env.LFM_API_KEY!,
    method: "auth.getSession",
    token,
  };
  const api_sig = signLastfm(params, env.LFM_SHARED_SECRET!);
  const qs = new URLSearchParams({ ...params, api_sig, format: "json" });

  const upstreamT0 = Date.now();
  const upstream = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs.toString()}`);
  const data = await upstream.json<{ session?: { key?: string; name?: string }; message?: string }>();

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
}

async function handleProxyImage(request: Request, reqId: string) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("url") || "";

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
}

async function handleHealth(env: Env) {
  const redis = redisFor(env);
  if (!redis) return json({ ok: true, redis: "disabled" });

  try {
    const ok = await redis.ping();
    return json({ ok: true, redis: ok ? "connected" : "unhealthy" }, { status: ok ? 200 : 503 });
  } catch (error) {
    return json(
      {
        ok: false,
        redis: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}

function handleRobots(request: Request) {
  const origin = getOrigin(request);
  const body = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${origin}/sitemap.xml`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function handleSitemap(request: Request) {
  const origin = getOrigin(request);
  const urls = [
    { loc: `${origin}/`, priority: 1.0 },
    { loc: `${origin}/w`, priority: 0.8 },
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (url) =>
        `  <url>\n    <loc>${xmlEscape(url.loc)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${url.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join("\n")}\n</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function routeApi(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const reqId = requestId(request);
  const t0 = Date.now();

  try {
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });

    if (url.pathname === "/api/health") return await handleHealth(env);
    if (url.pathname === "/api/lastfm/recent") return await handleRecent(request, env, ctx, reqId);
    if (url.pathname === "/api/lastfm/trackInfo") return await handleTrackInfo(request, env, ctx, reqId);
    if (url.pathname === "/api/lastfm/session") return await handleSession(request, env, reqId);
    if (url.pathname === "/api/proxy-image") return await handleProxyImage(request, reqId);

    return json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    log("error", "api.error", {
      requestId: reqId,
      path: url.pathname,
      durationMs: Date.now() - t0,
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return routeApi(request, env, ctx);
    }

    if (url.pathname === "/robots.txt") return handleRobots(request);
    if (url.pathname === "/sitemap.xml") return handleSitemap(request);

    return env.ASSETS.fetch(request);
  },
};
