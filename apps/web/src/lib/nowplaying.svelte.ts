import { fetchRecent, fetchTrackInfo } from "./lastfm-client";

export type LfmTrack = {
  name: string;
  mbid?: string;
  url?: string;
  artist: { "#text": string };
  album: { "#text": string };
  image: { size: string; "#text": string }[];
  "@attr"?: { nowplaying?: "true" };
  date?: { uts: string };
};

// Poll visible widgets every second, whether playing or paused.
// Hidden editor tabs back off; failed requests retry up to every ten seconds.
const INTERVALS = { VISIBLE: 1000, HIDDEN: 5000 } as const;

const RESUME_WINDOW_MS = 120_000;
const FRESH_MS = 15_000;
const idOf = (t: LfmTrack) => JSON.stringify([t.name, t.artist["#text"], t.album?.["#text"] ?? ""]);
function validTrack(t: any): t is LfmTrack {
  return !!t && typeof t.name === "string" && !!t.name && typeof t.artist?.["#text"] === "string";
}

/** Last.fm progress is always an estimate. Failures retain the last usable display. */
export class NowPlaying {
  track = $state<LfmTrack | null>(null);
  isLive = $state(false);
  isPaused = $state(false);
  durationMs = $state<number | null>(null);
  isPositionEstimated = true;
  #elapsed = $state(0);
  #anchor = $state<number | null>(null);
  #now = $state(Date.now());
  #lastSuccess = $state(0);
  #unknown = $state(false);
  #interrupted: number | null = null;
  #id = "";
  #username = "";
  #sessionKey: string | null = null;
  #apiKey = "";
  #generation = 0;
  #trackGeneration = 0;
  #errors = 0;
  #durationRetryAt = 0;
  #started = false;
  #timeout: ReturnType<typeof setTimeout> | null = null;
  #raf: number | null = null;

  progressMs = $derived(Math.max(0, Math.min(this.durationMs ?? Infinity,
    this.#elapsed + (this.#anchor === null ? 0 : Math.max(0, Math.min(this.#now, this.#lastSuccess + FRESH_MS) - this.#anchor)))));
  percent = $derived(this.durationMs ? Math.min(100, this.progressMs / this.durationMs * 100) : 0);
  isPositionUnknown = $derived(this.#unknown || this.#now > this.#lastSuccess + FRESH_MS ||
    (this.durationMs !== null && this.progressMs >= this.durationMs));

  setSource(username: string, sessionKey: string | null = null, apiKey = "") {
    if (this.#started && username === this.#username && sessionKey === this.#sessionKey && apiKey === this.#apiKey) return;
    this.destroy();
    this.#started = true;
    this.#username = username;
    this.#sessionKey = sessionKey;
    this.#apiKey = apiKey;
    this.track = null;
    this.isLive = this.isPaused = false;
    this.durationMs = null;
    this.#elapsed = 0;
    this.#anchor = this.#interrupted = null;
    this.#id = "";
    this.#unknown = true;
    this.#errors = 0;
    this.#lastSuccess = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(this.#storageKey()) ?? "null");
      if (validTrack(saved)) this.track = saved;
    } catch { /* Storage is optional in OBS. */ }
    if (username) void this.#poll(this.#generation);
  }

  destroy() {
    this.#generation++;
    this.#trackGeneration++;
    this.#started = false;
    if (this.#timeout !== null) clearTimeout(this.#timeout);
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#timeout = this.#raf = null;
  }

  #storageKey() { return `mw:lastplayed:${this.#username.toLowerCase()}`; }

  #freeze(now: number) {
    this.#now = now;
    this.#elapsed = this.progressMs;
    this.#anchor = null;
  }

  #tick() {
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#raf = null;
    if (this.#anchor === null) return;
    const loop = () => {
      this.#now = Date.now();
      if (this.#now > this.#lastSuccess + FRESH_MS || (this.durationMs !== null && this.progressMs >= this.durationMs)) {
        this.#freeze(this.#now);
        this.#raf = null;
      } else this.#raf = requestAnimationFrame(loop);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  async #poll(generation: number) {
    try {
      const data = await fetchRecent({ user: this.#username, limit: 3, apiKey: this.#apiKey, sessionKey: this.#sessionKey });
      if (generation !== this.#generation) return;
      const raw = (data.recenttracks as { track?: unknown } | undefined)?.track;
      const tracks = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (data.error || !validTrack(tracks[0])) throw new Error("No usable playback data");
      const tr = tracks[0];
      const now = Date.now();
      // Freeze before updating freshness so a recovered connection cannot count the outage.
      this.#freeze(now);
      const stale = this.#lastSuccess > 0 && now - this.#lastSuccess > FRESH_MS;
      this.#lastSuccess = now;
      this.#errors = 0;
      if (tr["@attr"]?.nowplaying === "true") {
        const changed = idOf(tr) !== this.#id;
        if (changed) {
          this.#id = idOf(tr);
          this.#trackGeneration++;
          this.#elapsed = 0;
          this.durationMs = null;
          this.#unknown = false;
          this.#durationRetryAt = 0;
        } else if (this.#interrupted !== null && now - this.#interrupted > RESUME_WINDOW_MS) {
          // ponytail: same-song restarts and long resumes are indistinguishable without player telemetry.
          this.#unknown = true;
        }
        if (this.durationMs === null && now >= this.#durationRetryAt) {
          this.#durationRetryAt = now + 30_000;
          void this.#fetchDuration(tr, generation, this.#trackGeneration);
        }
        if (stale && !changed) this.#unknown = true;
        this.track = tr;
        this.isLive = true;
        this.isPaused = false;
        this.#interrupted = null;
        this.#anchor = this.#unknown ? null : now;
        // Historical scrobbles do not identify the current play. Never backdate from them.
        try { localStorage.setItem(this.#storageKey(), JSON.stringify(tr)); } catch { /* Optional cache. */ }
      } else {
        if (this.#interrupted === null && this.#id) this.#interrupted = now;
        this.isLive = false;
        this.isPaused = !!this.#id;
        if (!this.track) this.track = tr;
      }
      this.#tick();
    } catch {
      if (generation !== this.#generation) return;
      this.#errors++;
      // Keep artwork, text, and playback styling. The ticker stops after the freshness budget.
    }
    if (generation !== this.#generation) return;
    const interval = typeof document !== "undefined" && document.hidden ? INTERVALS.HIDDEN : INTERVALS.VISIBLE;
    const delay = this.#errors ? Math.min(10_000, 1000 * 1.5 ** this.#errors) : interval;
    this.#timeout = setTimeout(() => void this.#poll(generation), delay);
  }

  async #fetchDuration(tr: LfmTrack, generation: number, trackGeneration: number) {
    try {
      const info = await fetchTrackInfo({ artist: tr.artist["#text"], track: tr.name, apiKey: this.#apiKey, sessionKey: this.#sessionKey });
      if (generation !== this.#generation || trackGeneration !== this.#trackGeneration) return;
      const duration = Number((info.track as { duration?: unknown } | undefined)?.duration);
      if (Number.isFinite(duration) && duration > 0) this.durationMs = duration;
    } catch { /* Duration failure must not replace usable playback data. */ }
  }
}
