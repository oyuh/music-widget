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

// All lookups (public and private, via pre-signed URLs) hit Last.fm from each
// user's own IP, and Last.fm allows ~5 req/s per IP, so polling every second
// is comfortably within budget. Live and stopped both poll fast so track
// changes, pauses, and playback starting are all caught within about a second;
// only a hidden tab (nothing visible; OBS sources always report visible) backs
// off to save requests.
const INTERVALS = {
  LIVE: 1000,
  STOPPED: 1000,
  HIDDEN: 5000,
} as const;

// How far past a track's own duration its estimated progress may run while still
// flagged "now playing" before we treat it as paused/stopped. Last.fm reports no
// playback position, so when a scrobbler holds "now playing" through a pause this
// overrun is the earliest reliable signal. Small enough to feel responsive, large
// enough to ride out the brief gap between songs without flashing "paused".
const OVERRUN_GRACE_MS = 8000;

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
  // The last track Last.fm reported as actually playing (nowplaying="true").
  // Shown on pause/stop instead of recenttracks[0], which Last.fm sometimes gets
  // wrong, and persisted to localStorage so a cold OBS start while paused is right.
  #lastLiveTrack: LfmTrack | null = null;
  #trackStartTime: number | null = null;
  // uts (seconds) of the most recent scrobble of the CURRENT track we've already
  // accounted for. A newer self-scrobble means the track looped/was replayed, so
  // we re-anchor instead of staying stuck "paused". Reset on every track change.
  #trackScrobbleUts = 0;

  #timeout: ReturnType<typeof setTimeout> | null = null;
  #raf: number | null = null;

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
    this.#started = false;
  }

  // ---- internals ----
  #restart() {
    this.#stopTimers();
    this.#started = true;
    this.#lastId = "";
    this.#hydrateLastLive();
    if (this.#username) this.#fetchNow();
  }

  #storageKey() {
    return `mw:lastplayed:${this.#username.toLowerCase()}`;
  }

  /** Load the remembered last-played track for the current user from localStorage. */
  #hydrateLastLive() {
    this.#lastLiveTrack = null;
    if (typeof localStorage === "undefined" || !this.#username) return;
    try {
      const raw = localStorage.getItem(this.#storageKey());
      if (!raw) return;
      const t = JSON.parse(raw) as LfmTrack;
      this.#lastLiveTrack = t;
      // Show it immediately (as paused) so a cold start while nothing is playing
      // lands on the correct song instead of a dash or Last.fm's stale "recent".
      this.track = t;
      this.isLive = false;
      this.isPaused = false;
    } catch {
      /* ignore */
    }
  }

  /** Remember + persist the track Last.fm says is actually playing. */
  #rememberLive(tr: LfmTrack) {
    this.#lastLiveTrack = tr;
    if (typeof localStorage === "undefined" || !this.#username) return;
    try {
      localStorage.setItem(this.#storageKey(), JSON.stringify(tr));
    } catch {
      /* ignore */
    }
  }

  #stopTimers() {
    if (this.#timeout) clearTimeout(this.#timeout);
    this.#timeout = null;
    if (this.#raf != null) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }

  #getOptimalInterval(): number {
    // Hidden tab (e.g. an inactive editor): nothing to show, back off. OBS
    // browser sources report as visible, so overlays keep the 1s cadence.
    if (typeof document !== "undefined" && document.hidden) return INTERVALS.HIDDEN;
    return this.isLive ? INTERVALS.LIVE : INTERVALS.STOPPED;
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
      if (now - this.#lastUpdate < 400) {
        this.#scheduleNext();
        return;
      }

      // Fetch a few entries (not just [0]) so we can also see the most recent
      // scrobble, used to detect a looped/replayed track that's stuck "paused".
      const data = (await fetchRecent({
        user: this.#username,
        limit: 3,
        apiKey: this.#apiKey,
        sessionKey: this.#sessionKey,
      })) as Record<string, any>;
      if (data.error) {
        this.#consecutiveErrors++;
        throw new Error(data.message || `Last.fm error ${data.error}`);
      }

      // Last.fm returns `track` as an array, but as a bare object when there's only
      // one entry; normalize so iteration and [0] both work.
      const rawTracks = data?.recenttracks?.track;
      const recent: LfmTrack[] = Array.isArray(rawTracks) ? rawTracks : rawTracks ? [rawTracks] : [];
      const tr: LfmTrack | undefined = recent[0];
      this.#lastUpdate = now;
      this.#consecutiveErrors = 0;

      if (!tr) {
        this.#scheduleNext();
        return;
      }

      const id = `${tr.name}—${tr.artist?.["#text"] ?? ""}`;
      const live = tr?.["@attr"]?.nowplaying === "true";
      const trackChanged = id !== this.#lastId;

      // Most recent COMPLETED scrobble of whatever is now playing (the now-playing
      // entry itself carries no date). A fresh one means the track just played
      // through again, i.e. it looped or was resumed.
      let selfScrobbleUts = 0;
      if (live) {
        for (const t of recent) {
          const uts = t.date?.uts ? parseInt(t.date.uts) : 0;
          if (uts && t.name === tr.name && t.artist?.["#text"] === tr.artist?.["#text"]) {
            if (uts > selfScrobbleUts) selfScrobbleUts = uts;
          }
        }
      }

      if (trackChanged) {
        this.#lastId = id;
        this.#trackStartTime = live ? now : null;
        this.#startedAt = live ? now : null;
        this.#totalPausedTime = 0;
        this.isPaused = false;
        this.#pausedAt = null;
        this.#estimatedStartOffset = 0;
        this.durationMs = null;
        this.#trackScrobbleUts = 0;

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
      } else if (
        live &&
        this.#trackStartTime &&
        this.durationMs &&
        selfScrobbleUts > this.#trackScrobbleUts &&
        selfScrobbleUts * 1000 > this.#trackStartTime + this.durationMs
      ) {
        // Same track still "now playing", but it scrobbled MORE than a full
        // duration after we started timing it, meaning it looped or was resumed (a single
        // play scrobbles within one duration, so this can't be the first play).
        // Re-anchor to the new play so we don't get stuck showing "paused".
        this.#trackScrobbleUts = selfScrobbleUts;
        // The replay scrobbled ~halfway through, so back-date the start accordingly.
        this.#trackStartTime = selfScrobbleUts * 1000 - Math.min(this.durationMs / 2, 240000);
        this.#startedAt = this.#trackStartTime;
        this.#totalPausedTime = 0;
        this.#estimatedStartOffset = 0;
        this.#pausedAt = null;
        this.isPaused = false;
      }

      this.track = tr;
      this.isLive = live;
      this.#detectPause(tr, live);

      // Keep a copy of whatever is genuinely playing so we can show it on pause.
      if (live) {
        this.#lastLiveTrack = tr;
        if (trackChanged) this.#rememberLive(tr);
      }

      if (!live) {
        this.#startedAt = null;
        this.durationMs = null;
        this.#trackStartTime = null;
        this.#totalPausedTime = 0;
        this.isPaused = false;
        this.#pausedAt = null;
        this.#estimatedStartOffset = 0;
        if (this.#lastId) this.#lastId = "";
        // Nothing is playing; prefer the last track we actually heard over
        // recenttracks[0], which Last.fm sometimes reports as the wrong song.
        if (this.#lastLiveTrack) this.track = this.#lastLiveTrack;
      }

      this.#syncTicker();
      this.#scheduleNext();
    } catch {
      this.#consecutiveErrors++;
      const delay = Math.min(10000, 1000 * Math.pow(1.5, this.#consecutiveErrors));
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

  /**
   * Decide whether a still-"now playing" track is actually paused/stopped.
   *
   * Last.fm exposes no playback position, so the only signal we have is that the
   * scrobbler keeps a track flagged "now playing" until it would have finished.
   * When our estimated progress runs past the track's own duration (plus a short
   * grace for the gap between songs) and Last.fm still hasn't moved on to a new
   * track, it's paused or stopped. Once flagged we hold that state until the track
   * changes or the "now playing" flag drops (handled by the callers), so it never
   * oscillates. Scrobblers that instead clear "now playing" on pause are caught
   * even sooner, via isLive flipping false on the next (now brisk) poll.
   */
  #detectPause(track: LfmTrack, isNowPlaying: boolean) {
    if (!isNowPlaying) {
      this.isPaused = false;
      this.#pausedAt = null;
      this.#totalPausedTime = 0;
      return;
    }
    if (this.isPaused) return; // sticky until a track change / not-live reset
    if (!this.#trackStartTime || !this.durationMs || this.durationMs <= 0) return;

    const now = Date.now();
    const expected = now - this.#trackStartTime - this.#totalPausedTime + this.#estimatedStartOffset;
    if (expected > this.durationMs + OVERRUN_GRACE_MS) {
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
