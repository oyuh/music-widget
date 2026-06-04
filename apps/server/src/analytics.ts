import type { Context } from "hono";
import { timingSafeEqual } from "node:crypto";
import type { AppEnv } from "./types";
import { clientIp, rateLimit } from "./security";
import {
  cleanupWidgetVisitors,
  dbEnabled,
  insertFeedback,
  recordWidgetVisit,
  upsertContact,
  type FeedbackInput,
  type WidgetVisit,
} from "./db";
import { json } from "./util";
import { log } from "./log";

// Caps on incoming string lengths , these endpoints are unauthenticated, so
// treat the body as untrusted and never store unbounded values.
const MAX_USER = 64;
const MAX_FP = 128;
const MAX_TEXT = 256;
const MAX_EMAIL = 254; // RFC 5321 maximum
const MAX_NAME = 80;
const MAX_HANDLE = 80;
const MAX_PLATFORM = 32;
const MAX_FEEDBACK = 2000; // the free-text answers

// Control characters to scrub from every stored string. Keeps tab (\t), line
// feed (\n) and carriage return (\r) so multi-line feedback survives, but strips
// NUL (which Postgres text rejects outright) and the rest of the C0/C1 ranges so
// nobody can smuggle log-injection / ANSI sequences or invisible junk into the DB.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

// Pragmatic email check (not a full RFC parser): one @, a dot in the domain, no
// whitespace. Good enough to reject junk before storing. Rejecting whitespace
// also blocks header injection (no CR/LF can reach a mail "To:" field).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The feedback form only offers these platforms. This endpoint is public, so we
// pin the stored value to the allowlist instead of trusting whatever is sent.
const PLATFORMS = new Set(["twitch", "youtube", "kick", "other"]);

type Meta = { ip: string | null; userAgent: string | null; referer: string | null };

/**
 * Turn an untrusted request body + server-derived metadata into a sanitized
 * WidgetVisit. Pure (no I/O) so it's unit-testable. Deliberately captures only
 * WHO the visitor is , no track / event-type info, that's more than we need.
 */
export function buildWidgetVisit(body: unknown, meta: Meta): WidgetVisit {
  const b = (body ?? {}) as Record<string, unknown>;

  return {
    lfmUser: clip(b.lfmUser, MAX_USER) ?? "",
    fingerprint: clip(b.fp, MAX_FP),
    ip: clip(meta.ip, MAX_USER),
    userAgent: clip(meta.userAgent, MAX_TEXT),
    referer: clip(meta.referer, MAX_TEXT),
  };
}

/**
 * POST /api/log/widget , records a site visitor. Always answers 204 and
 * SILENTLY: malformed bodies, rate-limited callers, and DB errors all return 204
 * so opening/copying the widget is never blocked. Deduped + sanitized downstream
 * (one row per visitor; repeat visits just refresh it).
 */
export const handleWidgetLog = async (c: Context<AppEnv>) => {
  const noContent = new Response(null, { status: 204 });
  if (!dbEnabled()) return noContent;

  // Dedicated, tighter limit for this endpoint (on top of the global /api one).
  // Silently drop when exceeded , the client never sees an error.
  if (!(await rateLimit("log", clientIp(c), 30, 60))) return noContent;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return noContent;
  }

  const visit = buildWidgetVisit(body, {
    ip: clientIp(c),
    userAgent: c.req.header("user-agent") ?? null,
    referer: c.req.header("referer") ?? null,
  });

  // Only usernames are interesting , skip anonymous pings.
  if (visit.lfmUser) void recordWidgetVisit(visit);

  return noContent;
};

/** Constant-time secret comparison , avoids leaking the secret via timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/cron/cleanup , scheduled housekeeping for the visitor log: collapses
 * any duplicate visitors and prunes stale ones (see cleanupWidgetVisitors).
 * Protected by the CRON_SECRET env var, sent as `Authorization: Bearer <secret>`
 * (or an `x-cron-secret` header). Returns 503 when storage / the secret isn't
 * configured, 401 when the token is missing or wrong.
 */
export const handleCronCleanup = async (c: Context<AppEnv>) => {
  if (!dbEnabled()) return json({ ok: false, error: "Storage is not configured." }, { status: 503 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ ok: false, error: "Cron is not configured." }, { status: 503 });

  const auth = c.req.header("authorization") ?? "";
  const provided = (auth.startsWith("Bearer ") ? auth.slice(7) : "") || c.req.header("x-cron-secret") || "";
  if (!secretMatches(provided, secret)) return json({ ok: false, error: "Unauthorized." }, { status: 401 });

  try {
    const result = await cleanupWidgetVisitors();
    log("info", "cron.cleanup", result);
    return json({ ok: true, ...result });
  } catch (err) {
    log("warn", "cron.cleanup_failed", { error: err instanceof Error ? err.message : String(err) });
    return json({ ok: false, error: "Cleanup failed." }, { status: 500 });
  }
};

/**
 * POST /api/contact , saves a contact email (upserted, linked to a Last.fm
 * username). Unlike the log endpoint this has a form UI, so it returns real
 * status codes: 200 ok, 400 invalid email, 429 too many, 503 when logging is off.
 */
export const handleContact = async (c: Context<AppEnv>) => {
  if (!dbEnabled()) return json({ ok: false, error: "Contact storage is not configured." }, { status: 503 });

  if (!(await rateLimit("contact", clientIp(c), 5, 600))) {
    return json({ ok: false, error: "Too many submissions , try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = clip(body.email, MAX_EMAIL)?.toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "Enter a valid email address." }, { status: 400 });

  const ok = await upsertContact({
    email,
    lfmUser: clip(body.lfmUser, MAX_USER),
    fingerprint: clip(body.fp, MAX_FP),
    ip: clip(clientIp(c), MAX_USER),
    userAgent: clip(c.req.header("user-agent"), MAX_TEXT),
  });

  if (!ok) return json({ ok: false, error: "Couldn't save right now , try again later." }, { status: 503 });
  return json({ ok: true });
};

/**
 * Turn an untrusted feedback body + server metadata into a sanitized
 * FeedbackInput. Pure (no I/O) so it's unit-testable: clips every string to its
 * cap, lower-cases + validates the email (kept only if it parses), and coerces
 * the subscribe flag to a real boolean.
 */
export function buildFeedback(body: unknown, meta: Meta): FeedbackInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = clip(b.email, MAX_EMAIL)?.toLowerCase() ?? null;
  const platform = clip(b.platform, MAX_PLATFORM)?.toLowerCase() ?? null;

  return {
    name: clip(b.name, MAX_NAME),
    email: email && EMAIL_RE.test(email) ? email : null,
    handle: clip(b.handle, MAX_HANDLE),
    platform: platform && PLATFORMS.has(platform) ? platform : null,
    good: clip(b.good, MAX_FEEDBACK),
    bad: clip(b.bad, MAX_FEEDBACK),
    subscribed: b.subscribe === true,
    lfmUser: clip(b.lfmUser, MAX_USER),
    fingerprint: clip(b.fp, MAX_FP),
    ip: clip(meta.ip, MAX_USER),
    userAgent: clip(meta.userAgent, MAX_TEXT),
  };
}

/**
 * POST /api/feedback , saves a free-form feedback submission and, when the user
 * ticked "email me", also registers them for outage/event alerts via the same
 * contact flow (which links the email to their Last.fm username). Returns real
 * status codes: 200 ok, 400 empty/needs-email, 429 too many, 503 when storage off.
 */
export const handleFeedback = async (c: Context<AppEnv>) => {
  if (!dbEnabled()) return json({ ok: false, error: "Feedback storage is not configured." }, { status: 503 });

  if (!(await rateLimit("feedback", clientIp(c), 5, 600))) {
    return json({ ok: false, error: "Too many submissions , try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const fb = buildFeedback(body, {
    ip: clientIp(c),
    userAgent: c.req.header("user-agent") ?? null,
    referer: null,
  });

  // Don't store empty submissions , require at least one meaningful field.
  if (!fb.good && !fb.bad && !fb.name && !fb.email && !fb.handle) {
    return json({ ok: false, error: "Add a little feedback first." }, { status: 400 });
  }

  // Opting into alerts needs a deliverable address.
  if (fb.subscribed && !fb.email) {
    return json({ ok: false, error: "Enter a valid email to get alerts." }, { status: 400 });
  }

  const saved = await insertFeedback(fb);
  if (!saved) return json({ ok: false, error: "Couldn't save right now , try again later." }, { status: 503 });

  // Mirror the opt-in into the contacts list so outage/event mail reaches them.
  // Fire-and-forget , feedback already succeeded, so a contact hiccup mustn't fail it.
  if (fb.subscribed && fb.email) {
    void upsertContact({
      email: fb.email,
      lfmUser: fb.lfmUser,
      fingerprint: fb.fingerprint,
      ip: fb.ip,
      userAgent: fb.userAgent,
    });
  }

  return json({ ok: true });
};
