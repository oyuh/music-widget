import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { compileModule } from "../apps/web/node_modules/svelte/compiler/index.js";
import { dominantColor } from "../apps/web/src/lib/colors";
import { ArtLoader, attemptsFor, FAILURE_TTL_MS, type ArtAttempt, type ArtLoaded } from "../apps/web/src/lib/art-loader";

const transpiler = new Bun.Transpiler({ loader: "ts" });
Bun.plugin({ name: "presenter-runes", setup(build) {
  build.onLoad({ filter: /track-presenter\.svelte\.ts$/ }, async ({ path }) => ({
    contents: compileModule(transpiler.transformSync(await Bun.file(path).text()), { filename: path, generate: "client" }).js.code,
    loader: "js",
  }));
} });
const { TrackPresenter, HOLD_MS } = await import("../apps/web/src/lib/track-presenter.svelte");

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const pixels = (...runs: [number, [number, number, number, number]][]) =>
  runs.flatMap(([n, px]) => Array.from({ length: n }, () => px).flat());

describe("dominantColor", () => {
  test("picks the most common quantized color", () => {
    expect(dominantColor(pixels([10, [200, 30, 30, 255]], [3, [30, 30, 200, 255]]))).toBe("#d02020");
  });
  test("skips near-white and near-black borders", () => {
    expect(dominantColor(pixels([50, [255, 255, 255, 255]], [50, [0, 0, 0, 255]], [2, [40, 160, 80, 255]]))).toBe("#30a050");
  });
  test("averages when only extremes remain", () => {
    expect(dominantColor(pixels([1, [250, 250, 250, 255]], [1, [2, 2, 2, 255]]))).toBe("#7e7e7e");
  });
  test("a fully transparent image has no color", () => {
    expect(dominantColor(pixels([4, [200, 0, 0, 0]]))).toBeNull();
  });
  test("bright channels clamp instead of overflowing the hex", () => {
    expect(dominantColor(pixels([4, [250, 250, 20, 255]]))).toBe("#ffff10");
  });
});

describe("attemptsFor", () => {
  test("CDN art tries direct CORS, then the proxy, then a plain load", () => {
    expect(attemptsFor("https://cdn.test/a.jpg")).toEqual([
      { src: "https://cdn.test/a.jpg", cors: true },
      { src: "/api/proxy-image?url=https%3A%2F%2Fcdn.test%2Fa.jpg", cors: true },
      { src: "https://cdn.test/a.jpg", cors: false },
    ]);
  });
  test("inline art loads as-is", () => {
    expect(attemptsFor("data:image/png;base64,AA")).toEqual([{ src: "data:image/png;base64,AA", cors: false }]);
  });
});

/** A fake image loader: each attempt stays pending until the test decides. */
function fakeLoads() {
  const pending: { attempt: ArtAttempt; resolve: (v: ArtLoaded) => void }[] = [];
  const load = (attempt: ArtAttempt) => new Promise<ArtLoaded>((resolve) => pending.push({ attempt, resolve }));
  return {
    pending,
    load,
    /** Settle the oldest pending attempt. */
    async next(result: ArtLoaded) {
      const p = pending.shift();
      if (!p) throw new Error("no pending load");
      p.resolve(result);
      await settle();
      return p.attempt;
    },
  };
}

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe("ArtLoader", () => {
  test("one load per URL, shared by concurrent callers", async () => {
    const f = fakeLoads();
    const loader = new ArtLoader({ load: f.load, storage: null });
    const a = loader.resolve("https://cdn.test/a.jpg");
    const b = loader.resolve("https://cdn.test/a.jpg");
    expect(f.pending.length).toBe(1);
    await f.next({ color: "#123456" });
    expect(await a).toEqual(await b);
    expect(loader.peek("https://cdn.test/a.jpg")).toMatchObject({ ok: true, cors: true, color: "#123456" });
  });

  test("falls through to the proxy and renders the source that worked", async () => {
    const f = fakeLoads();
    const loader = new ArtLoader({ load: f.load, storage: null });
    const r = loader.resolve("https://cdn.test/a.jpg");
    await f.next(null);
    expect((await f.next({ color: "#abcdef" })).src).toStartWith("/api/proxy-image");
    expect(await r).toMatchObject({ ok: true, src: "/api/proxy-image?url=https%3A%2F%2Fcdn.test%2Fa.jpg", cors: true });
  });

  test("a plain load still shows the image without a color", async () => {
    const f = fakeLoads();
    const loader = new ArtLoader({ load: f.load, storage: null });
    const r = loader.resolve("https://cdn.test/a.jpg");
    await f.next(null);
    await f.next(null);
    await f.next({ color: null });
    expect(await r).toMatchObject({ ok: true, cors: false, color: null });
  });

  test("failures expire so a network blip doesn't stick", async () => {
    let t = 0;
    const f = fakeLoads();
    const loader = new ArtLoader({ load: f.load, storage: null, now: () => t });
    const r = loader.resolve("https://cdn.test/a.jpg");
    for (let i = 0; i < 3; i++) await f.next(null);
    expect((await r).ok).toBe(false);
    expect(loader.peek("https://cdn.test/a.jpg")?.ok).toBe(false);
    t += FAILURE_TTL_MS;
    expect(loader.peek("https://cdn.test/a.jpg")).toBeNull();
    void loader.resolve("https://cdn.test/a.jpg");
    expect(f.pending.length).toBe(1);
  });

  test("a load that throws counts as a failed attempt", async () => {
    let calls = 0;
    const loader = new ArtLoader({
      storage: null,
      load: async () => {
        if (calls++ === 0) throw new Error("boom");
        return { color: "#101010" };
      },
    });
    expect(await loader.resolve("https://cdn.test/a.jpg")).toMatchObject({ ok: true, color: "#101010" });
  });

  test("colors persist across sessions, inline art doesn't", async () => {
    const storage = memoryStorage();
    const first = new ArtLoader({ load: async () => ({ color: "#224466" }), storage });
    await first.resolve("https://cdn.test/a.jpg");
    await first.resolve("data:image/png;base64,AA");
    const second = new ArtLoader({ load: async () => null, storage });
    expect(second.knownColor("https://cdn.test/a.jpg")).toBe("#224466");
    expect(second.knownColor("data:image/png;base64,AA")).toBeNull();
  });

  test("a corrupt color store is ignored", () => {
    const loader = new ArtLoader({ load: async () => null, storage: memoryStorage({ "mw:artcolor:v1": "{nope" }) });
    expect(loader.knownColor("https://cdn.test/a.jpg")).toBeNull();
  });

  test("memory stays bounded over a long session", async () => {
    let loads = 0;
    const loader = new ArtLoader({ load: async () => (loads++, { color: "#000000" }), storage: null });
    for (let i = 0; i < 100; i++) await loader.resolve(`https://cdn.test/${i}.jpg`);
    expect(loader.peek("https://cdn.test/99.jpg")).not.toBeNull();
    expect(loader.peek("https://cdn.test/0.jpg")).toBeNull();
    expect(loads).toBe(100);
  });
});

describe("TrackPresenter", () => {
  const originals = { setTimeout, clearTimeout };
  let timers: Map<number, { f: () => void; delay: number }>;
  let next: number;
  let f: ReturnType<typeof fakeLoads>;
  let loader: ArtLoader;
  let presenter: InstanceType<typeof TrackPresenter>;

  const input = (title: string, art = `https://cdn.test/${title}.jpg`, fallbackArt = "") =>
    ({ title, artist: "Artist", album: "Album", art, fallbackArt });
  const play = (percent: number) => ({ isLive: true, isPaused: false, percent, progressMs: percent * 1000, durationMs: 100_000 });
  const fire = async (delay: number) => {
    for (const [id, t] of [...timers]) if (t.delay === delay) { timers.delete(id); t.f(); }
    await settle();
  };

  beforeEach(() => {
    timers = new Map();
    next = 0;
    globalThis.setTimeout = ((fn: () => void, delay: number) => { timers.set(++next, { f: fn, delay }); return next; }) as any;
    globalThis.clearTimeout = ((id: number) => timers.delete(id)) as any;
    f = fakeLoads();
    loader = new ArtLoader({ load: f.load, storage: null });
    presenter = new TrackPresenter({ loader });
  });
  afterEach(() => { presenter.destroy(); Object.assign(globalThis, originals); });

  test("stays hidden until the first cover is ready", async () => {
    presenter.feed(input("A"), play(0));
    expect(presenter.shown).toBeNull();
    await f.next({ color: "#aa0000" });
    expect(presenter.shown).toMatchObject({ title: "A", art: { state: "ok", color: "#aa0000", cors: true } });
  });

  test("holds the old song, text and progress included, until the new cover is ready", async () => {
    presenter.feed(input("A"), play(0));
    await f.next({ color: "#aa0000" });
    presenter.feed(input("A"), play(97));
    presenter.feed(input("B"), play(0));
    expect(presenter.shown?.title).toBe("A");
    expect(presenter.holding).toBe(true);
    expect(presenter.frozen?.percent).toBe(97);
    presenter.feed(input("B"), play(1));
    expect(presenter.frozen?.percent).toBe(97);
    await f.next({ color: "#00bb00" });
    expect(presenter.shown).toMatchObject({ title: "B", art: { color: "#00bb00" } });
    expect(presenter.holding).toBe(false);
    expect(presenter.frozen).toBeNull();
  });

  test("a cached cover switches synchronously", async () => {
    presenter.feed(input("A"), play(0));
    await f.next({ color: "#aa0000" });
    presenter.feed(input("B", "https://cdn.test/A.jpg"), play(0));
    expect(presenter.holding).toBe(false);
    expect(presenter.shown).toMatchObject({ title: "B", art: { color: "#aa0000" } });
  });

  test("a hold that times out shows the new text over the old cover, never a blank", async () => {
    presenter.feed(input("A"), play(0));
    await f.next({ color: "#aa0000" });
    presenter.feed(input("B"), play(0));
    await fire(HOLD_MS);
    expect(presenter.shown).toMatchObject({
      title: "B",
      art: { state: "ok", src: "https://cdn.test/A.jpg", color: "#aa0000" },
    });
    expect(presenter.holding).toBe(false);
    await f.next({ color: "#0000cc" });
    expect(presenter.shown?.art).toMatchObject({ state: "ok", src: "https://cdn.test/B.jpg", color: "#0000cc" });
  });

  test("a first track that times out loads in place with its remembered color", async () => {
    const storage = memoryStorage({ "mw:artcolor:v1": JSON.stringify({ "https://cdn.test/A.jpg": "#445566" }) });
    presenter = new TrackPresenter({ loader: new ArtLoader({ load: f.load, storage }) });
    presenter.feed(input("A"), play(0));
    await fire(HOLD_MS);
    expect(presenter.shown?.art).toMatchObject({ state: "loading", src: "https://cdn.test/A.jpg", cors: true, color: "#445566" });
  });

  test("rapid skips land on the newest song and keep the first deadline", async () => {
    presenter.feed(input("A"), play(0));
    await f.next({ color: "#aa0000" });
    presenter.feed(input("B"), play(0));
    presenter.feed(input("C"), play(0));
    expect(timers.size).toBe(1);
    await f.next({ color: "#00bb00" }); // B finishes late: ignored
    expect(presenter.shown?.title).toBe("A");
    await f.next({ color: "#0000cc" });
    expect(presenter.shown).toMatchObject({ title: "C", art: { color: "#0000cc" } });
  });

  test("a dead cover swaps to the fallback image in the same commit", async () => {
    presenter.feed(input("A", "https://cdn.test/dead.jpg", "https://img.test/fb.png"), play(0));
    for (let i = 0; i < 3; i++) await f.next(null);
    expect(presenter.shown).toBeNull();
    await f.next({ color: "#777777" });
    expect(presenter.shown?.art).toMatchObject({ state: "ok", src: "https://img.test/fb.png", color: "#777777" });
  });

  test("no art commits immediately as failed", () => {
    presenter.feed(input("A", ""), play(0));
    expect(presenter.shown?.art).toMatchObject({ state: "failed", colorFailed: true });
  });

  test("a failed cover is retried while its song stays up", async () => {
    presenter.feed(input("A"), play(0));
    for (let i = 0; i < 3; i++) await f.next(null);
    expect(presenter.shown?.art.state).toBe("failed");
    await fire(FAILURE_TTL_MS);
    await f.next({ color: "#123123" });
    expect(presenter.shown?.art).toMatchObject({ state: "ok", color: "#123123" });
  });

  test("a new song cancels the pending retry", async () => {
    presenter.feed(input("A"), play(0));
    for (let i = 0; i < 3; i++) await f.next(null);
    presenter.feed(input("B", ""), play(0));
    await fire(FAILURE_TTL_MS);
    expect(f.pending.length).toBe(0);
    expect(presenter.shown?.title).toBe("B");
  });
});
