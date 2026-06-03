import { test, expect, describe } from "bun:test";
import { md5, sha256, signLastfm, xmlEscape, json, jsonText } from "../apps/server/src/util";

describe("hashing", () => {
  test("md5 known vector", () => {
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
  test("sha256 known vector", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("signLastfm", () => {
  test("is a stable 32-char hex digest", () => {
    const sig = signLastfm({ api_key: "k", method: "user.getRecentTracks" }, "secret");
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    expect(signLastfm({ api_key: "k", method: "user.getRecentTracks" }, "secret")).toBe(sig);
  });
  test("is independent of key order", () => {
    const a = signLastfm({ api_key: "k", method: "m", token: "t" }, "s");
    const b = signLastfm({ token: "t", method: "m", api_key: "k" }, "s");
    expect(a).toBe(b);
  });
  test("depends on the shared secret", () => {
    expect(signLastfm({ method: "m" }, "secret-a")).not.toBe(signLastfm({ method: "m" }, "secret-b"));
  });
});

describe("xmlEscape", () => {
  test("escapes the five XML entities", () => {
    expect(xmlEscape(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
  });
});

describe("json helpers", () => {
  test("json() sets content-type + nosniff and serializes", async () => {
    const r = json({ ok: true, n: 1 }, { status: 201 });
    expect(r.status).toBe(201);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await r.json()).toEqual({ ok: true, n: 1 });
  });
  test("jsonText() respects status + extra headers", () => {
    const r = jsonText("{}", 404, { "X-Cache": "MISS" });
    expect(r.status).toBe(404);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-cache")).toBe("MISS");
  });
});
