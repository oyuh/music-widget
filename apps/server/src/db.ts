import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { contacts, widgetEvents } from "./schema";
import { log } from "./log";

// Postgres via Drizzle ORM (on Bun's native SQL client). Backs the optional
// widget usage log + contact emails. Modeled on redis.ts: FAILS OPEN — a missing
// or unreachable database is logged and ignored, never blocking a request.

const DB_TIMEOUT_MS = 4000;
const MIGRATE_TIMEOUT_MS = 15000;
const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));

let db: BunSQLDatabase | null = null;
// Memoized "migrations applied" promise so we run them at most once per process.
// Reset to null on failure so the next write retries.
let migrated: Promise<void> | null = null;

export function dbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getDb(): BunSQLDatabase | null {
  if (!dbEnabled()) return null;
  if (!db) db = drizzle(process.env.DATABASE_URL!);
  return db;
}

function withTimeout<T>(run: () => Promise<T>, label: string, ms = DB_TIMEOUT_MS): Promise<T> {
  // Drizzle query builders are LAZY thenables — they re-run the SQL on every
  // `.then()`. Adopt the query as a real native promise (executed exactly once)
  // before we attach `.catch` and race it, so it can't fire twice.
  const promise = (async () => await run())();
  promise.catch(() => {}); // a late rejection must never go unhandled

  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function ensureMigrated(d: BunSQLDatabase): Promise<void> {
  if (!migrated) {
    migrated = withTimeout(() => migrate(d, { migrationsFolder: MIGRATIONS_DIR }), "migrate", MIGRATE_TIMEOUT_MS).catch(
      (err) => {
        migrated = null; // allow a retry on the next write
        throw err;
      },
    );
  }
  await migrated;
}

export type WidgetEvent = {
  event: string; // "open" | "copy"
  lfmUser: string; // always present — anonymous events are dropped before here
  fingerprint: string | null;
  trackName: string | null;
  trackArtist: string | null;
  trackAlbum: string | null;
  isPlaying: boolean | null;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
};

/**
 * Record a usage event. Deduplicated: one row per (lfm_user, fingerprint, event)
 * — a repeat open/copy from the same device bumps seen_count + last_seen_at and
 * refreshes the latest song instead of inserting a duplicate. Best-effort
 * (returns false, never throws).
 */
export async function logWidgetEvent(e: WidgetEvent): Promise<boolean> {
  const d = getDb();
  if (!d) return false;

  try {
    await ensureMigrated(d);

    await withTimeout(
      () =>
        d
          .insert(widgetEvents)
          .values({
            event: e.event,
            lfmUser: e.lfmUser,
            fingerprint: e.fingerprint ?? "",
            trackName: e.trackName,
            trackArtist: e.trackArtist,
            trackAlbum: e.trackAlbum,
            isPlaying: e.isPlaying,
            ip: e.ip,
            userAgent: e.userAgent,
            referer: e.referer,
          })
          .onConflictDoUpdate({
            target: [widgetEvents.lfmUser, widgetEvents.fingerprint, widgetEvents.event],
            set: {
              seenCount: sql`${widgetEvents.seenCount} + 1`,
              lastSeenAt: sql`now()`,
              trackName: e.trackName,
              trackArtist: e.trackArtist,
              trackAlbum: e.trackAlbum,
              isPlaying: e.isPlaying,
              ip: e.ip,
              userAgent: e.userAgent,
              referer: e.referer,
            },
          }),
      "widget upsert",
    );
    return true;
  } catch (err) {
    // Re-run migrations on the next write — self-heals if the schema went missing
    // (e.g. the database was wiped/recreated under a long-lived server).
    migrated = null;
    log("warn", "db.widget_event_failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

export type ContactInput = {
  email: string;
  lfmUser: string | null;
  fingerprint: string | null;
  ip: string | null;
  userAgent: string | null;
};

/**
 * Save a contact email (upserted by email — no duplicates). Links it to a
 * Last.fm username: uses the one submitted with the form, or, when absent,
 * recovers it from the usage log by matching the same device fingerprint. On
 * conflict, only fills in fields we now know — never clobbers a known username
 * with null.
 */
export async function upsertContact(c: ContactInput): Promise<boolean> {
  const d = getDb();
  if (!d) return false;

  try {
    await ensureMigrated(d);

    let lfmUser = c.lfmUser;
    if (!lfmUser && c.fingerprint) {
      const found = await withTimeout(
        () =>
          d
            .select({ u: widgetEvents.lfmUser })
            .from(widgetEvents)
            .where(and(eq(widgetEvents.fingerprint, c.fingerprint!), isNotNull(widgetEvents.lfmUser)))
            .orderBy(desc(widgetEvents.lastSeenAt))
            .limit(1),
        "contact link",
      );
      lfmUser = found[0]?.u ?? null;
    }

    await withTimeout(
      () =>
        d
          .insert(contacts)
          .values({
            email: c.email,
            lfmUser,
            fingerprint: c.fingerprint,
            ip: c.ip,
            userAgent: c.userAgent,
          })
          .onConflictDoUpdate({
            target: contacts.email,
            set: {
              // coalesce(new, existing) keeps a known value rather than nulling it.
              lfmUser: sql`coalesce(${lfmUser}, ${contacts.lfmUser})`,
              fingerprint: sql`coalesce(${c.fingerprint}, ${contacts.fingerprint})`,
              ip: sql`coalesce(${c.ip}, ${contacts.ip})`,
              userAgent: sql`coalesce(${c.userAgent}, ${contacts.userAgent})`,
              updatedAt: sql`now()`,
            },
          }),
      "contact upsert",
    );
    return true;
  } catch (err) {
    migrated = null; // self-heal a missing schema on the next write
    log("warn", "db.contact_failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

export async function dbPing(): Promise<boolean> {
  const d = getDb();
  if (!d) return false;
  const rows = (await withTimeout(() => d.execute(sql`select 1 as ok`), "ping")) as Array<{ ok: number }>;
  return rows?.[0]?.ok === 1;
}
