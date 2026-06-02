import { redisGet, redisSetEx } from "./redis";
import { jsonText } from "./util";
import { log } from "./log";

export type UpstreamJson = {
  body: string;
  status: number;
  cacheable: boolean;
};

type CachedJson = {
  body: string;
  expires: number;
};

const l1JsonCache = new Map<string, CachedJson>();
const inFlightJson = new Map<string, Promise<UpstreamJson>>();

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

async function getCachedJson(cacheKey: string, ttlSeconds: number, reqId: string) {
  const l1 = getL1(cacheKey);
  if (l1) return { body: l1, cache: "L1" as const };

  try {
    const body = await redisGet(cacheKey);
    if (!body) return null;
    setL1(cacheKey, ttlSeconds, body);
    return { body, cache: "REDIS" as const };
  } catch (error) {
    log("warn", "cache.redis_get_failed", {
      requestId: reqId,
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function cacheJson(cacheKey: string, ttlSeconds: number, body: string, reqId: string) {
  setL1(cacheKey, ttlSeconds, body);

  // Fire-and-forget the Redis write so it never adds latency to the response,
  // mirroring the Worker's ctx.waitUntil behavior.
  void redisSetEx(cacheKey, ttlSeconds, body).catch((error) => {
    log("warn", "cache.redis_set_failed", {
      requestId: reqId,
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function withJsonCache(args: {
  requestId: string;
  cacheKey: string;
  ttlSeconds: number;
  cacheControl: string;
  fetcher: () => Promise<UpstreamJson>;
}): Promise<Response> {
  const cached = await getCachedJson(args.cacheKey, args.ttlSeconds, args.requestId);
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
    cacheJson(args.cacheKey, args.ttlSeconds, result.body, args.requestId);
  }

  return jsonText(result.body, result.status, {
    "Cache-Control": args.cacheControl,
    "X-Cache": coalesced ? "COALESCED" : "MISS",
  });
}
