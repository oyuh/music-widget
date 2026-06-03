import { test, expect, describe } from "bun:test";
import { withJsonCache, type UpstreamJson } from "../apps/server/src/cache";

// No REDIS_URL in the test env, so these exercise the L1 + coalescing paths
// (Redis is skipped / fails open).
function freshKey() {
  return "test:" + Math.random().toString(36).slice(2);
}
function call(cacheKey: string, fetcher: () => Promise<UpstreamJson>) {
  return withJsonCache({ requestId: "t", cacheKey, ttlSeconds: 60, cacheControl: "no-store", fetcher });
}

describe("withJsonCache", () => {
  test("MISS then L1 hit, fetcher runs once", async () => {
    const key = freshKey();
    let calls = 0;
    const fetcher = async (): Promise<UpstreamJson> => {
      calls++;
      return { body: '{"v":1}', status: 200, cacheable: true };
    };

    const r1 = await call(key, fetcher);
    expect(r1.headers.get("X-Cache")).toBe("MISS");
    expect(await r1.text()).toBe('{"v":1}');

    const r2 = await call(key, fetcher);
    expect(r2.headers.get("X-Cache")).toBe("L1");
    expect(calls).toBe(1);
  });

  test("non-cacheable responses are not stored", async () => {
    const key = freshKey();
    let calls = 0;
    const fetcher = async (): Promise<UpstreamJson> => {
      calls++;
      return { body: "{}", status: 400, cacheable: false };
    };

    await call(key, fetcher);
    const r2 = await call(key, fetcher);
    expect(r2.headers.get("X-Cache")).toBe("MISS");
    expect(calls).toBe(2);
  });

  test("coalesces concurrent requests for the same key", async () => {
    const key = freshKey();
    let calls = 0;
    const fetcher = async (): Promise<UpstreamJson> => {
      calls++;
      await new Promise((r) => setTimeout(r, 40));
      return { body: "{}", status: 200, cacheable: true };
    };

    const [a, b] = await Promise.all([call(key, fetcher), call(key, fetcher)]);
    const tags = [a.headers.get("X-Cache"), b.headers.get("X-Cache")].sort();
    expect(tags).toEqual(["COALESCED", "MISS"]);
    expect(calls).toBe(1);
  });
});
