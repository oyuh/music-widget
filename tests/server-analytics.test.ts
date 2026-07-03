import { test, expect, describe } from "bun:test";
import { buildFeedback, buildWidgetVisit } from "../apps/server/src/analytics";

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
    expect(v.lfmUser).toBe(""); // anonymous; the route drops these before storing
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

describe("buildFeedback", () => {
  test("maps a full body, trimming + lower-casing the email", () => {
    const f = buildFeedback(
      {
        name: "  RJ  ",
        email: "  RJ@Example.COM ",
        handle: "rjlive",
        platform: "twitch",
        good: "love the snapping",
        bad: "wish for more fonts",
        subscribe: true,
        lfmUser: "rj",
        fp: "abc123",
      },
      meta,
    );
    expect(f).toEqual({
      name: "RJ",
      email: "rj@example.com",
      handle: "rjlive",
      platform: "twitch",
      good: "love the snapping",
      bad: "wish for more fonts",
      subscribed: true,
      lfmUser: "rj",
      fingerprint: "abc123",
      ip: "1.2.3.4",
      userAgent: "UA",
    });
  });

  test("drops an invalid email and defaults subscribe to false", () => {
    const f = buildFeedback({ email: "not-an-email", good: "hi" }, meta);
    expect(f.email).toBeNull();
    expect(f.subscribed).toBe(false);
    expect(f.good).toBe("hi");
  });

  test("only `subscribe: true` (boolean) opts in; truthy strings don't count", () => {
    expect(buildFeedback({ subscribe: "yes" }, meta).subscribed).toBe(false);
    expect(buildFeedback({ subscribe: 1 }, meta).subscribed).toBe(false);
    expect(buildFeedback({ subscribe: true }, meta).subscribed).toBe(true);
  });

  test("caps overly long fields", () => {
    const f = buildFeedback({ name: "n".repeat(500), good: "g".repeat(5000), fp: "f".repeat(500) }, meta);
    expect(f.name!.length).toBe(80);
    expect(f.good!.length).toBe(2000);
    expect(f.fingerprint!.length).toBe(128);
  });

  test("blank fields become null, never empty strings", () => {
    const f = buildFeedback({ name: "   ", good: "", handle: 42 }, meta);
    expect(f.name).toBeNull();
    expect(f.good).toBeNull();
    expect(f.handle).toBeNull();
  });

  test("tolerates a null / non-object body", () => {
    const f = buildFeedback(null, { ip: null, userAgent: null, referer: null });
    expect(f.subscribed).toBe(false);
    expect(f.name).toBeNull();
    expect(f.email).toBeNull();
  });

  test("strips control characters (incl. NUL) but keeps tabs/newlines in text", () => {
    const NUL = String.fromCharCode(0);
    const ESC = String.fromCharCode(27);
    const BS = String.fromCharCode(8);
    const TAB = String.fromCharCode(9);
    const LF = String.fromCharCode(10);
    const f = buildFeedback(
      {
        name: "R" + NUL + "J",
        good: "line1" + LF + "line2" + TAB + "tab",
        bad: "ansi" + ESC + "[31mred" + ESC + "[0m",
        handle: "rj" + BS + "live",
      },
      meta,
    );
    expect(f.name).toBe("RJ");
    expect(f.good).toBe("line1" + LF + "line2" + TAB + "tab");
    expect(f.bad).toBe("ansi[31mred[0m");
    expect(f.handle).toBe("rjlive");
  });

  test("a NUL-only field collapses to null (Postgres-safe)", () => {
    const NUL = String.fromCharCode(0);
    expect(buildFeedback({ name: NUL + " " + NUL }, meta).name).toBeNull();
  });

  test("pins platform to the allowlist (unknown values become null)", () => {
    expect(buildFeedback({ platform: "twitch" }, meta).platform).toBe("twitch");
    expect(buildFeedback({ platform: "YouTube" }, meta).platform).toBe("youtube"); // case-insensitive
    expect(buildFeedback({ platform: "myspace" }, meta).platform).toBeNull();
    expect(buildFeedback({ platform: "<script>" }, meta).platform).toBeNull();
  });

  test("rejects an email carrying a header-injection newline", () => {
    expect(buildFeedback({ email: "a@b.com\nbcc: evil@x.com" }, meta).email).toBeNull();
  });
});
