import { jsonText } from "./util";

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
    // Track info lives for a day, so the sweep above can leave thousands of
    // live keys. Drop the oldest (Map keeps insertion order) to hold a hard cap.
    for (const cacheKey of l1JsonCache.keys()) {
      if (l1JsonCache.size <= 500) break;
      l1JsonCache.delete(cacheKey);
    }
  }
}

export async function withJsonCache(args: {
  cacheKey: string;
  ttlSeconds: number;
  cacheControl: string;
  fetcher: () => Promise<UpstreamJson>;
}): Promise<Response> {
  const cached = getL1(args.cacheKey);
  if (cached) {
    return jsonText(cached, 200, {
      "Cache-Control": args.cacheControl,
      "X-Cache": "L1",
    });
  }

  const existing = inFlightJson.get(args.cacheKey);
  const promise = existing || args.fetcher();
  const coalesced = Boolean(existing);
  if (!existing) {
    inFlightJson.set(args.cacheKey, promise);
    // `.finally` returns a new promise that rejects alongside the fetcher and
    // nobody awaits it, so swallow it here or an upstream timeout crashes Bun.
    promise.finally(() => inFlightJson.delete(args.cacheKey)).catch(() => {});
  }

  const result = await promise;

  if (result.cacheable) {
    setL1(args.cacheKey, args.ttlSeconds, result.body);
  }

  return jsonText(result.body, result.status, {
    "Cache-Control": args.cacheControl,
    "X-Cache": coalesced ? "COALESCED" : "MISS",
  });
}
