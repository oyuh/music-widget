import type { Context } from "hono";
import type { AppEnv } from "./types";
import { clientIp, rateLimit } from "./security";
import { dbEnabled, logWidgetEvent, upsertContact, type WidgetEvent } from "./db";
import { json } from "./util";

// Caps on incoming string lengths — these endpoints are unauthenticated, so
// treat the body as untrusted and never store unbounded values.
const MAX_USER = 64;
const MAX_FP = 128;
const MAX_TEXT = 256;
const MAX_EMAIL = 254; // RFC 5321 maximum

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

// Pragmatic email check (not a full RFC parser): one @, a dot in the domain, no
// whitespace. Good enough to reject junk before storing.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Meta = { ip: string | null; userAgent: string | null; referer: string | null };

/**
 * Turn an untrusted request body + server-derived metadata into a sanitized
 * WidgetEvent. Pure (no I/O) so it's unit-testable. Defaults the event to
 * "open" and only ever records "open" or "copy".
 */
export function buildWidgetEvent(body: unknown, meta: Meta): WidgetEvent {
  const b = (body ?? {}) as Record<string, unknown>;
  const track = (b.track ?? {}) as Record<string, unknown>;
  const isPlaying =
    typeof b.isPlaying === "boolean" ? b.isPlaying : typeof track.isPlaying === "boolean" ? track.isPlaying : null;

  return {
    event: b.event === "copy" ? "copy" : "open",
    lfmUser: clip(b.lfmUser, MAX_USER) ?? "",
    fingerprint: clip(b.fp, MAX_FP),
    trackName: clip(track.name, MAX_TEXT),
    trackArtist: clip(track.artist, MAX_TEXT),
    trackAlbum: clip(track.album, MAX_TEXT),
    isPlaying,
    ip: clip(meta.ip, MAX_USER),
    userAgent: clip(meta.userAgent, MAX_TEXT),
    referer: clip(meta.referer, MAX_TEXT),
  };
}

/**
 * POST /api/log/widget — records a widget open/copy. Always answers 204 and
 * SILENTLY: malformed bodies, rate-limited callers, and DB errors all return 204
 * so opening/copying the widget is never blocked. Deduped + sanitized downstream.
 */
export const handleWidgetLog = async (c: Context<AppEnv>) => {
  const noContent = new Response(null, { status: 204 });
  if (!dbEnabled()) return noContent;

  // Dedicated, tighter limit for this endpoint (on top of the global /api one).
  // Silently drop when exceeded — the client never sees an error.
  if (!(await rateLimit("log", clientIp(c), 30, 60))) return noContent;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return noContent;
  }

  const event = buildWidgetEvent(body, {
    ip: clientIp(c),
    userAgent: c.req.header("user-agent") ?? null,
    referer: c.req.header("referer") ?? null,
  });

  // Only usernames are interesting — skip anonymous pings.
  if (event.lfmUser) void logWidgetEvent(event);

  return noContent;
};

/**
 * POST /api/contact — saves a contact email (upserted, linked to a Last.fm
 * username). Unlike the log endpoint this has a form UI, so it returns real
 * status codes: 200 ok, 400 invalid email, 429 too many, 503 when logging is off.
 */
export const handleContact = async (c: Context<AppEnv>) => {
  if (!dbEnabled()) return json({ ok: false, error: "Contact storage is not configured." }, { status: 503 });

  if (!(await rateLimit("contact", clientIp(c), 5, 600))) {
    return json({ ok: false, error: "Too many submissions — try again later." }, { status: 429 });
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

  if (!ok) return json({ ok: false, error: "Couldn't save right now — try again later." }, { status: 503 });
  return json({ ok: true });
};
