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

// Client-side calls hit Last.fm from each user's own IP, so these can be
// snappier than the old shared-proxy intervals without risking rate limits.
const INTERVALS = {
  FAST: 2500,
  NORMAL: 5000,
  SLOW: 10000,
  IDLE: 20000,
} as const;

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click", "focus"];

/**
 * Live "now playing" state for a Last.fm user. Port of the original
 * useNowPlaying hook: smart polling, progress ticking, pause detection and
 * resume-position estimation. Reactive via Svelte 5 runes.
 */
export class NowPlaying {
  // ---- reactive state ----
  track = $state<LfmTrack | null>(null);
  isLive = $state(false);
  isPaused = $state(false);
  durationMs = $state<number | null>(null);

  #startedAt = $state<number | null>(null);
  #estimatedStartOffset = $state(0);
  #pausedAt = $state<number | null>(null);
  #totalPausedTime = $state(0);
  #nowTs = $state(Date.now());

  // ---- non-reactive bookkeeping ----
  #username = "";
  #sessionKey: string | null = null;
  #apiKey = "";
  #started = false;

  #lastId = "";
  #lastUpdate = 0;
  #consecutiveErrors = 0;
  #lastUserActivity = Date.now();
  #lastTrackChange = 0;
  #trackStartTime: number | null = null;
  #staleProgressCount = 0;
  #expectedProgress = 0;

  #timeout: ReturnType<typeof setTimeout> | null = null;
  #raf: number | null = null;
  #onActivity = () => {
    this.#lastUserActivity = Date.now();
  };

  // ---- derived ----
  progressMs = $derived.by(() => {
    if (!this.isLive || !this.#startedAt) return 0;
    if (this.isPaused && this.#pausedAt) {
      return this.#pausedAt - this.#startedAt - this.#totalPausedTime + this.#estimatedStartOffset;
    }
    return this.#nowTs - this.#startedAt - this.#totalPausedTime + this.#estimatedStartOffset;
  });

  percent = $derived.by(() => {
    const effective = this.durationMs && this.durationMs > 0 ? this.durationMs : 180_000;
    if (!this.isLive || !this.#startedAt) return 0;
    return Math.max(0, Math.min(100, (this.progressMs / effective) * 100));
  });

  isPositionEstimated = $derived(this.#estimatedStartOffset > 0);

  /** (Re)point at a user; restarts polling when the source changes. */
  setSource(username: string, sessionKey: string | null = null, apiKey = "") {
    if (
      this.#started &&
      username === this.#username &&
      sessionKey === this.#sessionKey &&
      apiKey === this.#apiKey
    )
      return;
    this.#username = username;
    this.#sessionKey = sessionKey;
    this.#apiKey = apiKey;
    this.#restart();
  }

  destroy() {
    this.#stopTimers();
    if (typeof document !== "undefined") {
      for (const e of ACTIVITY_EVENTS) document.removeEventListener(e, this.#onActivity, true);
    }
    this.#started = false;
  }

  // ---- internals ----
  #restart() {
    this.#stopTimers();
    if (typeof document !== "undefined" && !this.#started) {
      for (const e of ACTIVITY_EVENTS) document.addEventListener(e, this.#onActivity, true);
    }
    this.#started = true;
    this.#lastId = "";
    if (this.#username) this.#fetchNow();
  }

  #stopTimers() {
    if (this.#timeout) clearTimeout(this.#timeout);
    this.#timeout = null;
    if (this.#raf != null) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }

  #getOptimalInterval(): number {
    const now = Date.now();
    const sinceActivity = now - this.#lastUserActivity;
    const sinceTrackChange = now - this.#lastTrackChange;
    if (sinceActivity < 30000) {
      if (sinceTrackChange < 10000) return INTERVALS.FAST;
      return this.isLive ? INTERVALS.NORMAL : INTERVALS.SLOW;
    }
    if (sinceActivity < 120000) return INTERVALS.SLOW;
    return INTERVALS.IDLE;
  }

  #scheduleNext() {
    if (this.#timeout) clearTimeout(this.#timeout);
    this.#timeout = setTimeout(() => this.#fetchNow(), this.#getOptimalInterval());
  }

  #syncTicker() {
    const shouldTick = this.isLive && this.#startedAt != null && !this.isPaused;
    if (shouldTick && this.#raf == null) {
      const loop = () => {
        this.#nowTs = Date.now();
        this.#raf = requestAnimationFrame(loop);
      };
      this.#raf = requestAnimationFrame(loop);
    } else if (!shouldTick && this.#raf != null) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
  }

  async #fetchNow() {
    try {
      const now = Date.now();
      if (now - this.#lastUpdate < 800) {
        this.#scheduleNext();
        return;
      }

      const data = (await fetchRecent({
        user: this.#username,
        limit: 1,
        apiKey: this.#apiKey,
        sessionKey: this.#sessionKey,
      })) as Record<string, any>;
      if (data.error) {
        this.#consecutiveErrors++;
        throw new Error(data.message || `Last.fm error ${data.error}`);
      }

      const tr: LfmTrack | undefined = data?.recenttracks?.track?.[0];
      this.#lastUpdate = now;
      this.#consecutiveErrors = 0;

      if (!tr) {
        this.#scheduleNext();
        return;
      }

      const id = `${tr.name}—${tr.artist?.["#text"] ?? ""}`;
      const live = tr?.["@attr"]?.nowplaying === "true";
      const trackChanged = id !== this.#lastId;

      if (trackChanged) {
        this.#lastId = id;
        this.#trackStartTime = live ? now : null;
        this.#startedAt = live ? now : null;
        this.#totalPausedTime = 0;
        this.isPaused = false;
        this.#pausedAt = null;
        this.#estimatedStartOffset = 0;
        this.durationMs = null;
        this.#staleProgressCount = 0;
        this.#expectedProgress = 0;
        this.#lastTrackChange = now;

        if (live) {
          this.#estimatePosition(tr)
            .then((offset) => {
              if (offset > 0) this.#estimatedStartOffset = offset;
            })
            .catch(() => {});
          this.#fetchDuration(tr);
        }
      } else if (live && !this.#trackStartTime) {
        this.#trackStartTime = now;
        this.#startedAt = now;
        this.#estimatePosition(tr)
          .then((offset) => {
            if (offset > 0) this.#estimatedStartOffset = offset;
          })
          .catch(() => {});
      }

      this.track = tr;
      this.isLive = live;
      this.#detectPause(tr, live);

      if (!live) {
        this.#startedAt = null;
        this.durationMs = null;
        this.#trackStartTime = null;
        this.#totalPausedTime = 0;
        this.isPaused = false;
        this.#pausedAt = null;
        this.#estimatedStartOffset = 0;
        this.#staleProgressCount = 0;
        this.#expectedProgress = 0;
        if (this.#lastId) this.#lastId = "";
      }

      this.#syncTicker();
      this.#scheduleNext();
    } catch {
      this.#consecutiveErrors++;
      const delay = Math.min(15000, 2000 * Math.pow(1.5, this.#consecutiveErrors));
      this.#timeout = setTimeout(() => this.#fetchNow(), delay);
    }
  }

  async #fetchDuration(tr: LfmTrack) {
    try {
      const info = (await fetchTrackInfo({
        artist: tr.artist["#text"],
        track: tr.name,
        apiKey: this.#apiKey,
        sessionKey: this.#sessionKey,
      })) as Record<string, any>;
      const dur = Number(info?.track?.duration ?? 0);
      this.durationMs = dur > 0 ? dur : null;
    } catch {
      /* ignore */
    }
  }

  #detectPause(track: LfmTrack, isNowPlaying: boolean) {
    const now = Date.now();
    if (!isNowPlaying) {
      this.isPaused = false;
      this.#pausedAt = null;
      this.#totalPausedTime = 0;
      this.#staleProgressCount = 0;
      this.#expectedProgress = 0;
      return;
    }
    if (!this.#trackStartTime || !this.durationMs || this.durationMs <= 0) return;

    const expected = now - this.#trackStartTime - this.#totalPausedTime + this.#estimatedStartOffset;
    const percent = (expected / this.durationMs) * 100;
    const diff = Math.abs(expected - this.#expectedProgress);

    if (diff < 2000) {
      this.#staleProgressCount++;
      if (this.#staleProgressCount >= 3 && !this.isPaused && percent < 95) {
        this.isPaused = true;
        this.#pausedAt = now;
      }
    } else {
      this.#staleProgressCount = 0;
      this.#expectedProgress = expected;
      if (this.isPaused) {
        this.isPaused = false;
        if (this.#pausedAt) this.#totalPausedTime += now - this.#pausedAt;
        this.#pausedAt = null;
      }
    }

    if (expected > this.durationMs + 20000 && !this.isPaused) {
      this.isPaused = true;
      this.#pausedAt = now;
    }
  }

  async #estimatePosition(track: LfmTrack): Promise<number> {
    try {
      const data = (await fetchRecent({
        user: this.#username,
        limit: 10,
        apiKey: this.#apiKey,
        sessionKey: this.#sessionKey,
      })) as Record<string, any>;
      const recent: LfmTrack[] = data?.recenttracks?.track || [];

      let foundRecentMatch = false;
      for (let i = 1; i < Math.min(recent.length, 8); i++) {
        const past = recent[i];
        if (past.name === track.name && past.artist?.["#text"] === track.artist?.["#text"] && past.date?.uts) {
          const completedAt = parseInt(past.date.uts) * 1000;
          const since = Date.now() - completedAt;
          if (since < 300000) {
            foundRecentMatch = true;
            if (since < 120000 && this.durationMs && this.durationMs > 60000) {
              if (since < 30000) return Math.max(0, Math.min(this.durationMs * 0.7, this.durationMs - 30000));
              return Math.min(this.durationMs * 0.3, 60000);
            }
            break;
          }
        }
      }

      if (!foundRecentMatch && recent.length > 3) {
        const unique = new Set<string>();
        for (let i = 1; i < Math.min(recent.length, 6); i++) {
          const past = recent[i];
          if (past.date?.uts) {
            const since = Date.now() - parseInt(past.date.uts) * 1000;
            if (since < 1800000) unique.add(`${past.name}—${past.artist?.["#text"]}`);
          }
        }
        if (unique.size >= 2) return 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }
}
