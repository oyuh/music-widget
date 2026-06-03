import { test, expect, describe } from "bun:test";
import { isAllowedImageHost } from "../apps/server/src/security";

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
