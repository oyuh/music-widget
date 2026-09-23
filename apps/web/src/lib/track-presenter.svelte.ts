import { artLoader, FAILURE_TTL_MS, type ArtAsset, type ArtLoader } from "./art-loader";

// Song switches land as ONE frame. When a new track arrives, the widget keeps
// showing the previous song (text, art, accent, progress) until the new cover is
// loaded, decoded, and color-read, then swaps everything together. The old way
// flipped the text immediately while the art went blank and the accent caught
// up a beat later. Covers already in the cache commit synchronously, so the
// wait only exists when there's actually something to wait for.

export type TrackInput = {
  title: string;
  artist: string;
  album: string;
  /** The song's own cover URL ("" when the track has none). */
  art: string;
  /** Shown when the cover is missing or won't load ("" when not configured). */
  fallbackArt: string;
};

export type PresentedArt = {
  /** What the <img> renders. The raw URL on failure, so legacy layouts keep their slot. */
  src: string;
  /** Render with crossorigin="anonymous" (must match the load to reuse the cache). */
  cors: boolean;
  /** "loading" only when the hold ran out with no earlier cover to keep up. */
  state: "ok" | "loading" | "failed";
  /** Raw dominant color (before brightness normalization); null while unknown. */
  color: string | null;
  /** No color can come from this art, so "accent" elements use their fallbacks. */
  colorFailed: boolean;
};

export type PresentedTrack = {
  title: string;
  artist: string;
  album: string;
  art: PresentedArt;
};

export type Playback = {
  isLive: boolean;
  isPaused: boolean;
  percent: number;
  progressMs: number;
  durationMs: number | null;
};

/** Longest a switch waits for its cover before showing the new song anyway. */
export const HOLD_MS = 1500;
/** Backoff for re-trying a cover that failed, while that song is still up. */
const RETRY_MS = [FAILURE_TTL_MS, FAILURE_TTL_MS * 3, FAILURE_TTL_MS * 9];

const sameInput = (a: TrackInput | null, b: TrackInput) =>
  !!a &&
  a.title === b.title &&
  a.artist === b.artist &&
  a.album === b.album &&
  a.art === b.art &&
  a.fallbackArt === b.fallbackArt;

function present(input: TrackInput, asset: ArtAsset | null): PresentedTrack {
  const art: PresentedArt = asset?.ok
    ? { src: asset.src, cors: asset.cors, state: "ok", color: asset.color, colorFailed: !asset.color }
    : { src: input.art, cors: false, state: "failed", color: null, colorFailed: true };
  return { title: input.title, artist: input.artist, album: input.album, art };
}

export class TrackPresenter {
  /** What the widget renders. Null until the very first track is ready. */
  shown = $state.raw<PresentedTrack | null>(null);
  /** True while a switch waits on its cover. */
  holding = $state(false);
  /** Playback as it was when the switch began; the widget shows this while holding. */
  frozen = $state.raw<Playback | null>(null);

  #loader: ArtLoader;
  #holdMs: number;
  #input: TrackInput | null = null;
  #shownInput: TrackInput | null = null;
  #lastPlayback: Playback | null = null;
  #gen = 0;
  #holdTimer: ReturnType<typeof setTimeout> | null = null;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: { loader?: ArtLoader; holdMs?: number } = {}) {
    this.#loader = opts.loader ?? artLoader;
    this.#holdMs = opts.holdMs ?? HOLD_MS;
  }

  /**
   * Hand over the latest track and playback. Cheap to call every frame: nothing
   * happens unless the track itself changed.
   */
  feed(input: TrackInput, playback: Playback) {
    if (!sameInput(this.#input, input)) this.#switch(input);
    // Only remember playback that belongs to the song on screen, so a hold
    // freezes the old song's bar, never the new song's reset-to-zero.
    if (this.#shownInput === this.#input) this.#lastPlayback = playback;
  }

  destroy() {
    this.#gen++;
    this.#clearHold();
    this.#clearRetry();
  }

  #switch(input: TrackInput) {
    this.#input = input;
    const gen = ++this.#gen;
    this.#clearRetry();

    const ready = this.#settleSync(input);
    if (ready) {
      this.#commit(ready, input);
      return;
    }
    // Keep the original deadline when songs are skipped mid-hold, so rapid
    // skipping can't hold the old song forever.
    if (!this.holding) {
      this.holding = true;
      this.frozen = this.shown ? this.#lastPlayback : null;
      this.#holdTimer = setTimeout(() => this.#expire(), this.#holdMs);
    }
    void this.#settle(input).then((track) => {
      if (gen === this.#gen) this.#commit(track, input);
    });
  }

  /** The result right now, if every image it needs is already settled. */
  #settleSync(input: TrackInput): PresentedTrack | null {
    const cover = input.art ? this.#loader.peek(input.art) : null;
    if (input.art && !cover) return null;
    if (cover?.ok || !input.fallbackArt) return present(input, cover);
    const fallback = this.#loader.peek(input.fallbackArt);
    if (!fallback) return null;
    return present(input, fallback.ok ? fallback : cover);
  }

  async #settle(input: TrackInput): Promise<PresentedTrack> {
    const cover = input.art ? await this.#loader.resolve(input.art) : null;
    if (cover?.ok || !input.fallbackArt) return present(input, cover);
    const fallback = await this.#loader.resolve(input.fallbackArt);
    return present(input, fallback.ok ? fallback : cover);
  }

  /**
   * The hold ran out: show the new song's text now. The previous cover and
   * accent stay up until the new cover is ready, then swap in one frame, so a
   * slow CDN never leaves an empty slot or the fallback color on screen.
   */
  #expire() {
    this.#holdTimer = null;
    if (!this.holding) return;
    // Always the LATEST input: a skip mid-hold shares the original deadline.
    const input = this.#input!;
    const prev = this.shown?.art;
    const url = input.art || input.fallbackArt;
    const art: PresentedArt =
      prev?.state === "ok"
        ? prev
        : {
            // Nothing to keep (first track, or the last one had no art): let
            // the cover load in place. The first attempt is a CORS load of this
            // same URL, so the <img> joins that request instead of a second one.
            src: url,
            cors: !!url && !/^(data|blob):/i.test(url),
            state: url ? "loading" : "failed",
            color: url ? this.#loader.knownColor(url) : null,
            colorFailed: !url,
          };
    this.#commit({ title: input.title, artist: input.artist, album: input.album, art }, input);
  }

  #commit(track: PresentedTrack, input: TrackInput) {
    this.#clearHold();
    this.shown = track;
    this.#shownInput = input;
    this.holding = false;
    this.frozen = null;
    // Retry a cover that settled as failed, even when the fallback image covers for it.
    if (this.#coverFailed(input)) this.#scheduleRetry(input, 0);
  }

  #coverFailed(input: TrackInput): boolean {
    return !!input.art && this.#loader.peek(input.art)?.ok === false;
  }

  /** A failed cover gets a few more chances while its song stays up. */
  #scheduleRetry(input: TrackInput, attempt: number) {
    this.#clearRetry();
    if (attempt >= RETRY_MS.length) return;
    const gen = this.#gen;
    this.#retryTimer = setTimeout(async () => {
      this.#retryTimer = null;
      if (gen !== this.#gen) return;
      this.#loader.forget(input.art);
      if (input.fallbackArt) this.#loader.forget(input.fallbackArt);
      const track = await this.#settle(input);
      if (gen !== this.#gen) return;
      // Only ever upgrade: a retry that fails again leaves the screen alone.
      const was = this.shown?.art;
      if (track.art.state === "ok" && (was?.state !== "ok" || was.src !== track.art.src)) this.shown = track;
      if (this.#coverFailed(input)) this.#scheduleRetry(input, attempt + 1);
    }, RETRY_MS[attempt]);
  }

  #clearHold() {
    if (this.#holdTimer !== null) clearTimeout(this.#holdTimer);
    this.#holdTimer = null;
  }

  #clearRetry() {
    if (this.#retryTimer !== null) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
  }
}
