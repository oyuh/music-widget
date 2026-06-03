export type ServiceState = "checking" | "operational" | "degraded" | "offline";
export type LastfmState = "unknown" | "ok" | "rate-limited" | "down" | "key-suspended";

const LFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";
const SHARED_KEY: string = import.meta.env.VITE_LFM_KEY || "";

/**
 * Live health of the backend + the Last.fm API, shared across the app. Polls
 * /api/health, pings Last.fm, and tracks whether the client is being
 * rate-limited (a 429 was seen).
 */
class ServiceStatus {
  state = $state<ServiceState>("checking");
  redis = $state("");
  lastfm = $state<LastfmState>("unknown");
  rateLimited = $state(false);

  #timer: ReturnType<typeof setInterval> | null = null;
  #lfmTimer: ReturnType<typeof setInterval> | null = null;
  #rlTimer: ReturnType<typeof setTimeout> | null = null;
  #started = false;

  /** Update Last.fm health from a response (HTTP ok + Last.fm error code). */
  noteLastfm(httpOk: boolean, data: Record<string, unknown> | null) {
    const err = data && typeof data.error === "number" ? (data.error as number) : 0;
    if (err === 26 || err === 10) this.lastfm = "key-suspended";
    else if (err === 29) this.lastfm = "rate-limited";
    else if (err === 11 || err === 16) this.lastfm = "down";
    else if (httpOk) this.lastfm = "ok";
    else this.lastfm = "down";
  }

  start() {
    if (this.#started || typeof window === "undefined") return;
    this.#started = true;

    const check = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as { ok?: boolean; redis?: string };
        this.redis = d?.redis ?? "";
        this.state = r.ok && d?.ok ? "operational" : "degraded";
      } catch {
        this.state = "offline";
        this.redis = "";
      }
    };

    // Cheap public call that validates the shared key + Last.fm reachability.
    const pingLfm = async () => {
      try {
        const qs = `method=chart.getTopArtists&limit=1&api_key=${SHARED_KEY}&format=json`;
        const r = await fetch(`${LFM_ENDPOINT}?${qs}`, { cache: "no-store" });
        const d = (await r.json().catch(() => null)) as Record<string, unknown> | null;
        this.noteLastfm(r.ok, d);
      } catch {
        this.noteLastfm(false, null);
      }
    };

    void check();
    void pingLfm();
    this.#timer = setInterval(check, 30_000);
    this.#lfmTimer = setInterval(pingLfm, 90_000);
  }

  /** Flagged when an API call returns 429; auto-clears after a cool-off. */
  markRateLimited() {
    this.rateLimited = true;
    if (this.#rlTimer) clearTimeout(this.#rlTimer);
    this.#rlTimer = setTimeout(() => (this.rateLimited = false), 30_000);
  }
}

export const serviceStatus = new ServiceStatus();
