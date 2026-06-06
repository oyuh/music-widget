// Fire-and-forget visitor logging. We record which Last.fm usernames actually
// use the site (plus a rough device fingerprint), so we can see real usage , not
// what they're listening to. Strictly best-effort: it never throws and never
// blocks the UI, and a username is required (anonymous visits are skipped).

const ENDPOINT = "/api/log/widget";

let cachedFp: string | null = null;

/**
 * A lightweight, stable-ish browser fingerprint. NOT for security or precise
 * identification , just enough to roughly distinguish devices in the log. It's a
 * hash of a few stable signals, so it stays the same across reloads on a device.
 */
export function browserFingerprint(): string {
  if (cachedFp) return cachedFp;
  if (typeof navigator === "undefined") return "server";

  const n = navigator as Navigator & { deviceMemory?: number };
  const screenSig =
    typeof screen !== "undefined" ? `${screen.width}x${screen.height}x${screen.colorDepth}` : "";
  const parts = [
    n.userAgent,
    n.language,
    (n.languages ?? []).join(","),
    n.platform,
    n.hardwareConcurrency,
    n.deviceMemory,
    n.maxTouchPoints,
    screenSig,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset(),
  ].join("|");

  cachedFp = cyrb53(parts);
  return cachedFp;
}

function send(lfmUser: string) {
  if (typeof window === "undefined") return;
  const user = (lfmUser ?? "").trim();
  if (!user) return; // usernames are the whole point

  const payload = JSON.stringify({ lfmUser: user, fp: browserFingerprint() });

  try {
    // sendBeacon survives page lifecycle changes (OBS tabs, navigations) and is
    // non-blocking; fall back to keepalive fetch where it's unavailable.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
    } else {
      void fetch(ENDPOINT, {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore , logging must never affect the widget */
  }
}

/** Record a visitor when the `/w` widget page loads for a username. */
export function recordWidgetOpen(lfmUser: string) {
  send(lfmUser);
}

/** Record a visitor when a widget URL is copied from the editor. */
export function recordWidgetCopy(lfmUser: string) {
  send(lfmUser);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export type ContactResult = "ok" | "invalid" | "rate" | "error";

/**
 * Submit a contact email so we can reach the user about outages. Sends the
 * current Last.fm username + device fingerprint too, so the server can link the
 * email to their widget. Returns a status the form can show.
 */
export async function submitContact(email: string, lfmUser: string): Promise<ContactResult> {
  if (typeof window === "undefined") return "error";
  const addr = (email ?? "").trim();
  if (!isValidEmail(addr)) return "invalid";

  try {
    const r = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: addr,
        lfmUser: (lfmUser ?? "").trim() || null,
        fp: browserFingerprint(),
      }),
    });
    if (r.status === 429) return "rate";
    if (!r.ok) return "error";
    return "ok";
  } catch {
    return "error";
  }
}

export type FeedbackResult = "ok" | "empty" | "needEmail" | "invalid" | "rate" | "error";

export interface FeedbackPayload {
  name?: string;
  email?: string;
  handle?: string;
  platform?: string;
  good?: string;
  bad?: string;
  /** Opt into outage/event email alerts (also registers them as a contact). */
  subscribe: boolean;
  /** Their Last.fm username from the editor, if known. */
  lfmUser?: string;
}

/**
 * Submit feedback from the editor's modal. Validates locally first , needs at
 * least one filled field, and a valid email when opting into alerts , then posts
 * to /api/feedback (which also wires up the alert opt-in and recovers the
 * username from the device fingerprint when it wasn't supplied). Returns a status
 * the form can show.
 */
export async function submitFeedback(p: FeedbackPayload): Promise<FeedbackResult> {
  if (typeof window === "undefined") return "error";

  const trim = (v?: string) => (v ?? "").trim();
  const email = trim(p.email);
  const fields = {
    name: trim(p.name),
    email,
    handle: trim(p.handle),
    platform: trim(p.platform),
    good: trim(p.good),
    bad: trim(p.bad),
  };

  // Nothing to say , don't bother the server.
  if (!fields.name && !fields.email && !fields.handle && !fields.good && !fields.bad) return "empty";
  // Alerts need a deliverable address.
  if (p.subscribe && !isValidEmail(email)) return "needEmail";

  try {
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fields.name || null,
        email: fields.email || null,
        handle: fields.handle || null,
        platform: fields.platform || null,
        good: fields.good || null,
        bad: fields.bad || null,
        subscribe: p.subscribe,
        lfmUser: trim(p.lfmUser) || null,
        fp: browserFingerprint(),
      }),
    });
    if (r.status === 429) return "rate";
    if (r.status === 400) return "invalid";
    if (!r.ok) return "error";
    return "ok";
  } catch {
    return "error";
  }
}

/**
 * How many distinct Last.fm users have used the site. Fetched once on load: the
 * server computes this in a background task and keeps it in memory, so this route
 * just pulls the pre-computed number , nothing to poll, no DB hit. Returns null
 * on any failure so the caller can just hide the line rather than show a broken
 * number.
 */
export async function fetchSiteUserCount(): Promise<number | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch("/api/site-stats");
    if (!r.ok) return null;
    const d = (await r.json()) as { users?: unknown };
    const n = typeof d.users === "number" ? d.users : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ---- "Recently gave feedback" flag --------------------------------------
// After someone submits feedback we hide the sidebar button for a week so we
// don't nag them. Stored as a single timestamp in localStorage; treated as
// expired (and cleared) once it's older than the window, so the entry never
// lingers beyond 7 days.
const FEEDBACK_SENT_KEY = "mw:feedbackSentAt";
const FEEDBACK_HIDE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Record that feedback was just sent, so the button hides for a week. */
export function markFeedbackSent(): void {
  try {
    localStorage.setItem(FEEDBACK_SENT_KEY, String(Date.now()));
  } catch {
    /* private mode / storage disabled , no big deal */
  }
}

/**
 * True if feedback was sent within the last 7 days (so the button stays hidden).
 * Self-healing: a missing, malformed, or expired entry returns false and is
 * removed, so storage is only ever valid for the 7-day window.
 */
export function feedbackRecentlySent(): boolean {
  try {
    const raw = localStorage.getItem(FEEDBACK_SENT_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > FEEDBACK_HIDE_MS) {
      localStorage.removeItem(FEEDBACK_SENT_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// cyrb53 , a tiny, fast, dependency-free 53-bit string hash. Good enough to turn
// the fingerprint signals into a short opaque id; not cryptographic.
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(36);
}
