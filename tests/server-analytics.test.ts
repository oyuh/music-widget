import { test, expect, describe } from "bun:test";
import { buildWidgetEvent } from "../apps/server/src/analytics";

const meta = { ip: "1.2.3.4", userAgent: "UA", referer: "https://apple.jamlog.lol/w" };

describe("buildWidgetEvent", () => {
  test("maps a full body", () => {
    const e = buildWidgetEvent(
      {
        event: "open",
        lfmUser: "  rj  ",
        fp: "abc123",
        isPlaying: true,
        track: { name: "Song", artist: "Artist", album: "Album" },
      },
      meta,
    );
    expect(e).toEqual({
      event: "open",
      lfmUser: "rj",
      fingerprint: "abc123",
      trackName: "Song",
      trackArtist: "Artist",
      trackAlbum: "Album",
      isPlaying: true,
      ip: "1.2.3.4",
      userAgent: "UA",
      referer: "https://apple.jamlog.lol/w",
    });
  });

  test("defaults unknown events to open and only allows open/copy", () => {
    expect(buildWidgetEvent({ event: "copy", lfmUser: "x" }, meta).event).toBe("copy");
    expect(buildWidgetEvent({ event: "nonsense", lfmUser: "x" }, meta).event).toBe("open");
    expect(buildWidgetEvent({ lfmUser: "x" }, meta).event).toBe("open");
  });

  test("blank / non-string fields become empty user / null meta", () => {
    const e = buildWidgetEvent({ lfmUser: "   ", fp: 42, track: { name: "" } }, { ip: null, userAgent: null, referer: null });
    expect(e.lfmUser).toBe(""); // anonymous — the route drops these before storing
    expect(e.fingerprint).toBeNull();
    expect(e.trackName).toBeNull();
    expect(e.ip).toBeNull();
  });

  test("caps overly long strings", () => {
    const e = buildWidgetEvent({ lfmUser: "u".repeat(500), track: { name: "n".repeat(1000) } }, meta);
    expect(e.lfmUser!.length).toBe(64);
    expect(e.trackName!.length).toBe(256);
  });

  test("isPlaying falls back to the track flag and tolerates missing values", () => {
    expect(buildWidgetEvent({ lfmUser: "x", track: { isPlaying: true } }, meta).isPlaying).toBe(true);
    expect(buildWidgetEvent({ lfmUser: "x" }, meta).isPlaying).toBeNull();
  });

  test("tolerates a null / non-object body", () => {
    const e = buildWidgetEvent(null, meta);
    expect(e.event).toBe("open");
    expect(e.lfmUser).toBe("");
  });
});
