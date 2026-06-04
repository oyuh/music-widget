import { test, expect, describe } from "bun:test";
import { buildWidgetVisit } from "../apps/server/src/analytics";

const meta = { ip: "1.2.3.4", userAgent: "UA", referer: "https://apple.jamlog.lol/w" };

describe("buildWidgetVisit", () => {
  test("maps a full body to just the visitor identity (no track / event)", () => {
    const v = buildWidgetVisit({ lfmUser: "  rj  ", fp: "abc123" }, meta);
    expect(v).toEqual({
      lfmUser: "rj",
      fingerprint: "abc123",
      ip: "1.2.3.4",
      userAgent: "UA",
      referer: "https://apple.jamlog.lol/w",
    });
  });

  test("ignores any track / event fields the client might still send", () => {
    const v = buildWidgetVisit(
      { lfmUser: "x", fp: "fp", event: "copy", track: { name: "Song", artist: "A" }, isPlaying: true },
      meta,
    );
    expect(v).toEqual({ lfmUser: "x", fingerprint: "fp", ip: "1.2.3.4", userAgent: "UA", referer: meta.referer });
    expect(v).not.toHaveProperty("trackName");
    expect(v).not.toHaveProperty("event");
  });

  test("blank / non-string fields become empty user / null meta", () => {
    const v = buildWidgetVisit({ lfmUser: "   ", fp: 42 }, { ip: null, userAgent: null, referer: null });
    expect(v.lfmUser).toBe(""); // anonymous — the route drops these before storing
    expect(v.fingerprint).toBeNull();
    expect(v.ip).toBeNull();
  });

  test("caps overly long strings", () => {
    const v = buildWidgetVisit({ lfmUser: "u".repeat(500), fp: "f".repeat(500) }, meta);
    expect(v.lfmUser!.length).toBe(64);
    expect(v.fingerprint!.length).toBe(128);
  });

  test("tolerates a null / non-object body", () => {
    const v = buildWidgetVisit(null, meta);
    expect(v.lfmUser).toBe("");
    expect(v.ip).toBe("1.2.3.4");
  });
});
