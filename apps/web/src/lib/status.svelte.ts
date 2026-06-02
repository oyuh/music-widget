export type ServiceState = "checking" | "operational" | "degraded" | "offline";

/**
 * Live health of the backend, shared across the app. Polls /api/health and
 * tracks whether the client is currently being rate-limited (a 429 was seen).
 */
class ServiceStatus {
  state = $state<ServiceState>("checking");
  redis = $state("");
  rateLimited = $state(false);

  #timer: ReturnType<typeof setInterval> | null = null;
  #rlTimer: ReturnType<typeof setTimeout> | null = null;
  #started = false;

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

    void check();
    this.#timer = setInterval(check, 30_000);
  }

  /** Flagged when an API call returns 429; auto-clears after a cool-off. */
  markRateLimited() {
    this.rateLimited = true;
    if (this.#rlTimer) clearTimeout(this.#rlTimer);
    this.#rlTimer = setTimeout(() => (this.rateLimited = false), 30_000);
  }
}

export const serviceStatus = new ServiceStatus();
