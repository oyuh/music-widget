import { test, expect, describe, afterEach } from "bun:test";
import { handleProxyImage } from "../apps/server/src/lastfm";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Route upstream fetches by URL; records every URL requested. */
function mockUpstream(routes: Record<string, () => Response>) {
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push(url);
    const route = routes[url];
    return route ? route() : new Response("nope", { status: 404 });
  }) as typeof fetch;
  return seen;
}

// The handler only reads the request id and the url query, so a stub context does.
const proxy = (url: string) =>
  handleProxyImage({ get: () => "t", req: { query: () => url } } as unknown as Parameters<typeof handleProxyImage>[0]);

describe("handleProxyImage", () => {
  test("streams a raster image with locked-down headers", async () => {
    mockUpstream({ "https://i.scdn.co/a.jpg": () => new Response("JPEG", { headers: { "content-type": "image/jpeg" } }) });
    const r = await proxy("https://i.scdn.co/a.jpg");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await r.text()).toBe("JPEG");
  });

  test("refuses HTML and SVG from an allowed host (stored XSS)", async () => {
    mockUpstream({
      "https://x.googleusercontent.com/page": () => new Response("<script>", { headers: { "content-type": "text/html" } }),
      "https://x.googleusercontent.com/i.svg": () => new Response("<svg>", { headers: { "content-type": "image/svg+xml" } }),
    });
    expect((await proxy("https://x.googleusercontent.com/page")).status).toBe(415);
    expect((await proxy("https://x.googleusercontent.com/i.svg")).status).toBe(415);
  });

  test("follows redirects only within the allowlist", async () => {
    const seen = mockUpstream({
      "https://i.scdn.co/ok": () => new Response(null, { status: 302, headers: { location: "https://i.scdn.co/final.png" } }),
      "https://i.scdn.co/final.png": () => new Response("PNG", { headers: { "content-type": "image/png" } }),
      "https://i.scdn.co/evil": () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
    });
    expect((await proxy("https://i.scdn.co/ok")).status).toBe(200);
    expect((await proxy("https://i.scdn.co/evil")).status).toBe(400);
    expect(seen.some((u) => u.includes("169.254"))).toBe(false);
  });

  test("rejects junk and non-http urls", async () => {
    mockUpstream({});
    expect((await proxy("not a url")).status).toBe(400);
    expect((await proxy("file:///etc/passwd")).status).toBe(400);
  });
});
