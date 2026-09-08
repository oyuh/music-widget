import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { compileModule } from "../apps/web/node_modules/svelte/compiler/index.js";

const recent = mock(async (): Promise<any> => ({}));
const info = mock(async (): Promise<any> => ({ track: { duration: "180000" } }));
mock.module("../apps/web/src/lib/lastfm-client", () => ({ fetchRecent: recent, fetchTrackInfo: info }));
const transpiler = new Bun.Transpiler({ loader: "ts" });
Bun.plugin({ name: "tracker-runes", setup(build) {
  build.onLoad({ filter: /nowplaying\.svelte\.ts$/ }, async ({ path }) => ({
    contents: compileModule(transpiler.transformSync(await Bun.file(path).text()), { filename: path, generate: "client" }).js.code,
    loader: "js",
  }));
} });
const { NowPlaying } = await import("../apps/web/src/lib/nowplaying.svelte");
const song = (name = "A", live = true) => ({ name, artist: { "#text": "Artist" }, album: { "#text": "Album" }, image: [], ...(live ? { "@attr": { nowplaying: "true" } } : { date: { uts: "1" } }) });
const response = (name = "A", live = true) => ({ recenttracks: { track: [song(name, live)] } });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let now: number;
let tracker: InstanceType<typeof NowPlaying>;
let timers: Map<number, () => void>;
let frames: Map<number, FrameRequestCallback>;
let next: number;
let scheduledDelay: number;
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originals = { setTimeout, clearTimeout, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
async function advance(ms: number) {
  now += ms; setSystemTime(now);
  const pending = [...frames.values()]; frames.clear(); pending.forEach(f => f(now));
  const polls = [...timers.values()]; timers.clear(); polls.forEach(f => f());
  await settle();
}
beforeEach(() => {
  now = 1_800_000_000_000; setSystemTime(now); next = 0; timers = new Map(); frames = new Map();
  globalThis.setTimeout = ((f: () => void, delay: number) => { scheduledDelay = delay; timers.set(++next, f); return next; }) as any;
  globalThis.clearTimeout = ((id: number) => timers.delete(id)) as any;
  globalThis.requestAnimationFrame = f => { frames.set(++next, f); return next; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  recent.mockReset(); recent.mockImplementation(async () => response());
  info.mockReset(); info.mockImplementation(async () => ({ track: { duration: "180000" } }));
  tracker = new NowPlaying();
});
afterEach(() => { tracker.destroy(); Object.assign(globalThis, originals); if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document"); setSystemTime(); });
async function start() { tracker.setSource("listener"); await settle(); }

describe("Last.fm playback estimates", () => {
  test("starts at zero and counts observed playback", async () => {
    await start(); await advance(10_000);
    expect(tracker.progressMs).toBe(10_000); expect(tracker.isPositionEstimated).toBe(true);
  });
  test("freezes during pause and continues the same song", async () => {
    await start(); await advance(10_000); recent.mockImplementation(async () => response("old", false));
    await advance(1000); const held = tracker.progressMs;
    await advance(60_000); expect(tracker.progressMs).toBe(held); expect(tracker.track?.name).toBe("A");
    recent.mockImplementation(async () => response()); await advance(1000); await advance(5000);
    expect(tracker.progressMs).toBe(held + 5000); expect(tracker.isPaused).toBe(false);
  });
  test("long interruptions hold position instead of inventing a restart", async () => {
    await start(); recent.mockImplementation(async () => response("A", false)); await advance(1000);
    const held = tracker.progressMs; await advance(121_000);
    recent.mockImplementation(async () => response()); await advance(1000); await advance(5000);
    expect(tracker.progressMs).toBe(held); expect(tracker.isPositionUnknown).toBe(true);
  });
  test("different songs reset the estimate", async () => {
    await start(); await advance(10_000); recent.mockImplementation(async () => response("B")); await advance(1000);
    expect(tracker.track?.name).toBe("B"); expect(tracker.progressMs).toBe(0);
  });
  test("overruns cap progress without showing a false pause", async () => {
    info.mockImplementation(async () => ({ track: { duration: "5000" } })); await start(); await advance(6000);
    expect(tracker.progressMs).toBe(5000); expect(tracker.percent).toBe(100); expect(tracker.isPaused).toBe(false);
    expect(tracker.isPositionUnknown).toBe(true);
  });
  test("historical scrobbles and repeats cannot backdate the current play", async () => {
    await start(); recent.mockImplementation(async () => ({ recenttracks: { track: [song(), { ...song("A", false), date: { uts: String(now / 1000) } }] } }));
    await advance(1000); expect(tracker.progressMs).toBe(1000);
  });
  test.each([{}, { error: 29 }, { recenttracks: { track: [] } }, { recenttracks: { track: [{ name: "broken" }] } }])("unusable response keeps the display: %j", async payload => {
    await start(); recent.mockImplementation(async () => payload); await advance(1000);
    expect(tracker.track?.name).toBe("A"); expect(tracker.isLive).toBe(true); expect(tracker.durationMs).toBe(180000);
  });
  test("network outage stops counting and recovery does not add missing time", async () => {
    await start(); recent.mockImplementation(async () => { throw new Error("offline"); });
    await advance(5000); expect(tracker.progressMs).toBe(5000);
    await advance(60_000); expect(tracker.progressMs).toBe(15000); expect(tracker.isLive).toBe(true);
    recent.mockImplementation(async () => response()); await advance(1000); await advance(5000);
    expect(tracker.progressMs).toBe(15000); expect(tracker.isPositionUnknown).toBe(true);
  });
  test("single-object responses work", async () => {
    recent.mockImplementation(async () => ({ recenttracks: { track: song() } })); await start(); expect(tracker.track?.name).toBe("A");
  });
  test.each(["0", "NaN", "Infinity", "-10"])("invalid duration %s never reaches display", async duration => {
    info.mockImplementation(async () => ({ track: { duration } })); await start(); expect(tracker.durationMs).toBeNull(); expect(tracker.percent).toBe(0);
  });
  test("duration failures keep playback usable", async () => {
    info.mockImplementation(async () => { throw new Error("offline"); }); await start(); await advance(1000);
    expect(tracker.track?.name).toBe("A"); expect(tracker.progressMs).toBe(1000);
  });
  test("late duration from an earlier song is ignored", async () => {
    let resolve!: (value: any) => void;
    info.mockImplementationOnce(() => new Promise(r => { resolve = r; })); await start();
    recent.mockImplementation(async () => response("B")); await advance(1000);
    resolve({ track: { duration: "999999" } }); await settle(); expect(tracker.durationMs).toBe(180000);
  });
  test("late response from previous user cannot overwrite new source", async () => {
    let resolve!: (value: any) => void;
    recent.mockImplementationOnce(() => new Promise(r => { resolve = r; })); tracker.setSource("old");
    recent.mockImplementation(async () => response("B")); tracker.setSource("new"); await settle();
    resolve(response("A")); await settle(); expect(tracker.track?.name).toBe("B"); expect(timers.size).toBe(1);
  });
  test("destroy ignores in-flight responses and leaves no polling", async () => {
    let resolve!: (value: any) => void;
    recent.mockImplementationOnce(() => new Promise(r => { resolve = r; })); tracker.setSource("listener"); tracker.destroy();
    resolve(response()); await settle(); expect(tracker.track).toBeNull(); expect(timers.size).toBe(0); expect(frames.size).toBe(0);
  });
  test("duration lookup retries after a temporary failure", async () => {
    info.mockImplementationOnce(async () => { throw new Error("offline"); }); await start();
    expect(tracker.durationMs).toBeNull(); await advance(10_000); expect(info).toHaveBeenCalledTimes(1);
    await advance(10_000); await advance(10_000); expect(tracker.durationMs).toBe(180000);
  });
  test("short transport failures recover without resetting progress", async () => {
    await start(); recent.mockImplementationOnce(async () => { throw new Error("offline"); });
    await advance(1000); await advance(1000); expect(tracker.progressMs).toBe(2000);
    expect(tracker.isPositionUnknown).toBe(false);
  });
  test("repeated pauses exclude each interruption", async () => {
    await start();
    for (let i = 0; i < 3; i++) {
      await advance(5000); recent.mockImplementation(async () => response("A", false)); await advance(1000);
      await advance(5000); recent.mockImplementation(async () => response()); await advance(1000);
    }
    expect(tracker.progressMs).toBe(18_000);
  });
  test("same-song restart is explicitly only an estimate", async () => {
    await start(); await advance(5000); recent.mockImplementation(async () => response("A", false)); await advance(1000);
    recent.mockImplementation(async () => response()); await advance(1000);
    expect(tracker.progressMs).toBe(6000); expect(tracker.isPositionEstimated).toBe(true);
  });
  test("cold-start outage keeps the neutral display and recovers", async () => {
    recent.mockImplementationOnce(async () => { throw new Error("offline"); }); await start();
    expect(tracker.track).toBeNull(); expect(tracker.progressMs).toBe(0);
    await advance(1500); expect(tracker.track?.name).toBe("A");
  });
  test("switching to an empty username clears the previous listener", async () => {
    await start(); tracker.setSource(""); expect(tracker.track).toBeNull();
    expect(tracker.progressMs).toBe(0); expect(timers.size).toBe(0); expect(frames.size).toBe(0);
  });
  test("setting the same source does not duplicate polling", async () => {
    await start(); tracker.setSource("listener"); await settle(); expect(recent).toHaveBeenCalledTimes(1); expect(timers.size).toBe(1);
  });

  test("visible playback and pause both poll every 1000 ms", async () => {
    Object.defineProperty(globalThis, "document", { value: { hidden: false }, configurable: true });
    await start(); expect(scheduledDelay).toBe(1000);
    recent.mockImplementation(async () => response("A", false)); await advance(1000);
    expect(scheduledDelay).toBe(1000);
    recent.mockImplementation(async () => response()); await advance(1000);
    expect(scheduledDelay).toBe(1000);
  });
  test("hidden tabs use 5000 ms and return to 1000 ms when visible", async () => {
    const doc = { hidden: true };
    Object.defineProperty(globalThis, "document", { value: doc, configurable: true });
    await start(); expect(scheduledDelay).toBe(5000);
    doc.hidden = false; await advance(5000); expect(scheduledDelay).toBe(1000);
  });
  test("errors back off to at most 10000 ms and recovery restores 1000 ms", async () => {
    await start(); recent.mockImplementation(async () => { throw new Error("offline"); });
    await advance(1000); expect(scheduledDelay).toBe(1500);
    for (let i = 0; i < 8; i++) await advance(10000);
    expect(scheduledDelay).toBe(10000);
    recent.mockImplementation(async () => response()); await advance(10000);
    expect(scheduledDelay).toBe(1000);
  });

});
