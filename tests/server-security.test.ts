import { test, expect, describe } from "bun:test";
import { clientIp, isAllowedImageHost } from "../apps/server/src/security";

describe("isAllowedImageHost", () => {
  test("allows known album-art CDNs", () => {
    for (const host of [
      "lastfm.freetls.fastly.net",
      "lastfm-img2.akamaized.net",
      "i.scdn.co",
      "is1-ssl.mzstatic.com",
      "ws.last.fm",
      "last.fm",
    ]) {
      expect(isAllowedImageHost(host)).toBe(true);
    }
  });

  test("rejects everything else (SSRF / open-proxy guard)", () => {
    for (const host of ["example.com", "evil.com", "notlast.fm", "last.fm.evil.com", "169.254.169.254", "localhost"]) {
      expect(isAllowedImageHost(host)).toBe(false);
    }
  });

  test("is case-insensitive", () => {
    expect(isAllowedImageHost("LASTFM.FREETLS.FASTLY.NET")).toBe(true);
  });
});

describe("clientIp", () => {
  const ctx = (headers: Record<string, string>) =>
    ({ req: { header: (name: string) => headers[name] } }) as unknown as Parameters<typeof clientIp>[0];

  test("uses the address that connected to Railway", () => {
    expect(clientIp(ctx({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  test("unwraps Cloudflare's edge to the real visitor", () => {
    expect(clientIp(ctx({ "x-forwarded-for": "172.70.1.2", "cf-connecting-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(ctx({ "x-forwarded-for": "2606:4700::1", "cf-connecting-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  test("ignores a forged CF-Connecting-IP from a non-Cloudflare peer", () => {
    expect(clientIp(ctx({ "x-forwarded-for": "198.51.100.4", "cf-connecting-ip": "1.2.3.4" }))).toBe("198.51.100.4");
  });

  test("falls back when no proxy headers are present", () => {
    expect(clientIp(ctx({}))).toBe("unknown");
    expect(clientIp(ctx({ "x-real-ip": "198.51.100.5" }))).toBe("198.51.100.5");
  });
});
