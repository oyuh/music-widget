import { dominantColor } from "./colors";

// One pipeline for album art: a single request per cover feeds BOTH the pixels
// on screen and the accent color, so they can never disagree or arrive apart.
// The widget renders the exact `src` + CORS mode we loaded with, which makes the
// browser reuse the finished, decoded image instead of fetching and decoding it
// again when the <img> mounts.

export type ArtAsset = {
  /** The URL that was asked for. */
  url: string;
  /** What to put in <img src>. The image proxy when the CDN sends no CORS headers. */
  src: string;
  /** Render with crossorigin="anonymous" so the <img> reuses our cache entry. */
  cors: boolean;
  ok: boolean;
  /** Raw dominant color, or null when the pixels couldn't be read. */
  color: string | null;
};

export type ArtAttempt = { src: string; cors: boolean };
/** A finished load: the color read off it, plus a handle that keeps it decoded. */
export type ArtLoaded = { color: string | null; hold?: unknown } | null;

export type ArtLoaderOptions = {
  load?: (attempt: ArtAttempt, timeoutMs: number) => Promise<ArtLoaded>;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  now?: () => number;
};

type Entry = {
  promise: Promise<ArtAsset>;
  asset: ArtAsset | null;
  hold: unknown;
  settledAt: number;
};

/** Settled covers kept in memory. A long OBS session cycles through far more. */
const MEMORY_MAX = 48;
/** The newest covers keep their Image alive so the browser keeps them decoded. */
const RETAIN_IMAGES = 8;
/** A failed cover is retried after this, so a network blip doesn't stick. */
export const FAILURE_TTL_MS = 20_000;
/** A hung request moves on to the next attempt instead of blocking the chain. */
const ATTEMPT_TIMEOUT_MS = 5_000;
/** Colors survive reloads, so a restarted OBS source paints the right accent first. */
const COLOR_STORE_KEY = "mw:artcolor:v1";
const COLOR_STORE_MAX = 300;
const COLOR_STORE_URL_MAX = 1024;
const SAMPLE = 32;

const isInline = (url: string) => /^(data|blob):/i.test(url);

/**
 * Where to try loading a cover from, in order. Album-art CDNs send CORS headers,
 * so the direct read is the common case and costs the server nothing. The proxy
 * covers CDNs that don't. The plain no-CORS load is last: it can still show the
 * image, it just can't be read for a color.
 */
export function attemptsFor(url: string): ArtAttempt[] {
  if (isInline(url)) return [{ src: url, cors: false }];
  const list: ArtAttempt[] = [{ src: url, cors: true }];
  if (/^https?:/i.test(url)) list.push({ src: `/api/proxy-image?url=${encodeURIComponent(url)}`, cors: true });
  list.push({ src: url, cors: false });
  return list;
}

function readColor(img: HTMLImageElement): string | null {
  try {
    // A fresh canvas per read: a tainted canvas stays tainted, so sharing one
    // would let a single bad draw break every read after it.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    // Sample only the central region to avoid album borders/labels skewing the color
    const nw = img.naturalWidth || img.width || SAMPLE;
    const nh = img.naturalHeight || img.height || SAMPLE;
    const cropW = Math.max(1, Math.round(nw * 0.7));
    const cropH = Math.max(1, Math.round(nh * 0.7));
    const sx = Math.max(0, Math.round((nw - cropW) / 2));
    const sy = Math.max(0, Math.round((nh - cropH) / 2));
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, SAMPLE, SAMPLE);
    return dominantColor(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
  } catch {
    return null;
  }
}

/** Load and fully decode one attempt, then read its color when the pixels are readable. */
export function browserLoad(attempt: ArtAttempt, timeoutMs: number): Promise<ArtLoaded> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (!ok) {
        img.removeAttribute("src"); // abort a hung request
        resolve(null);
        return;
      }
      const readable = attempt.cors || isInline(attempt.src);
      resolve({ color: readable ? readColor(img) : null, hold: img });
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    if (attempt.cors) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      // Decode off the main thread now, so the swap later paints in one frame.
      if (typeof img.decode !== "function") return done(true);
      img.decode().then(
        () => done(true),
        () => done(img.naturalWidth > 0),
      );
    };
    img.onerror = () => done(false);
    img.src = attempt.src;
  });
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // Storage is optional in OBS.
  }
}

export class ArtLoader {
  #entries = new Map<string, Entry>();
  #colors: Map<string, string> | null = null;
  #load: NonNullable<ArtLoaderOptions["load"]>;
  #storage: ArtLoaderOptions["storage"];
  #now: () => number;

  constructor(opts: ArtLoaderOptions = {}) {
    this.#load = opts.load ?? browserLoad;
    this.#storage = opts.storage === undefined ? defaultStorage() : opts.storage;
    this.#now = opts.now ?? Date.now;
  }

  /** The settled result for `url`, synchronously, or null while it's unknown or loading. */
  peek(url: string): ArtAsset | null {
    const entry = this.#fresh(url);
    if (!entry?.asset) return null;
    this.#touch(url, entry);
    return entry.asset;
  }

  /** Load `url` (or join the load already in flight). Never rejects. */
  resolve(url: string): Promise<ArtAsset> {
    const existing = this.#fresh(url);
    if (existing) {
      this.#touch(url, existing);
      return existing.promise;
    }
    const entry = { asset: null, hold: null, settledAt: 0 } as unknown as Entry;
    entry.promise = this.#run(url).then((settled) => {
      entry.asset = settled.asset;
      entry.hold = settled.hold;
      entry.settledAt = this.#now();
      if (settled.asset.color) this.#rememberColor(url, settled.asset.color);
      if (this.#entries.get(url) === entry) this.#trim();
      return settled.asset;
    });
    this.#entries.set(url, entry);
    this.#trim();
    return entry.promise;
  }

  /** Drop a cached result so the next resolve loads it again. */
  forget(url: string) {
    this.#entries.delete(url);
  }

  /**
   * The best color we know for `url` without loading anything: this session's
   * read, else one saved by an earlier session.
   */
  knownColor(url: string): string | null {
    const asset = this.#entries.get(url)?.asset;
    if (asset?.color) return asset.color;
    return this.#colorStore().get(url) ?? null;
  }

  async #run(url: string): Promise<{ asset: ArtAsset; hold: unknown }> {
    for (const attempt of attemptsFor(url)) {
      let loaded: ArtLoaded = null;
      try {
        loaded = await this.#load(attempt, ATTEMPT_TIMEOUT_MS);
      } catch {
        loaded = null;
      }
      if (loaded) {
        return { asset: { url, src: attempt.src, cors: attempt.cors, ok: true, color: loaded.color }, hold: loaded.hold ?? null };
      }
    }
    return { asset: { url, src: url, cors: false, ok: false, color: null }, hold: null };
  }

  #fresh(url: string): Entry | null {
    const entry = this.#entries.get(url);
    if (!entry) return null;
    if (entry.asset && !entry.asset.ok && this.#now() - entry.settledAt >= FAILURE_TTL_MS) {
      this.#entries.delete(url);
      return null;
    }
    return entry;
  }

  #touch(url: string, entry: Entry) {
    this.#entries.delete(url);
    this.#entries.set(url, entry);
    this.#trim();
  }

  #trim() {
    const keys = [...this.#entries.keys()];
    for (let i = 0; i < keys.length - MEMORY_MAX; i++) this.#entries.delete(keys[i]);
    const live = [...this.#entries.values()];
    for (let i = 0; i < live.length - RETAIN_IMAGES; i++) live[i].hold = null;
  }

  #colorStore(): Map<string, string> {
    if (this.#colors) return this.#colors;
    this.#colors = new Map();
    try {
      const saved = JSON.parse(this.#storage?.getItem(COLOR_STORE_KEY) ?? "null");
      if (saved && typeof saved === "object") {
        for (const [k, v] of Object.entries(saved)) {
          if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) this.#colors.set(k, v);
        }
      }
    } catch {
      /* A corrupt store just starts over. */
    }
    return this.#colors;
  }

  #rememberColor(url: string, color: string) {
    // Inline art (the editor's sample, uploads) is huge and never recurs across reloads.
    if (isInline(url) || url.length > COLOR_STORE_URL_MAX) return;
    const store = this.#colorStore();
    if (store.get(url) === color) return;
    store.delete(url);
    store.set(url, color);
    for (const k of store.keys()) {
      if (store.size <= COLOR_STORE_MAX) break;
      store.delete(k);
    }
    try {
      this.#storage?.setItem(COLOR_STORE_KEY, JSON.stringify(Object.fromEntries(store)));
    } catch {
      /* Quota or privacy mode: the in-memory copy still works this session. */
    }
  }
}

/** Shared by every widget on the page, so the editor, thumbnails, and preview load a cover once. */
export const artLoader = new ArtLoader();
