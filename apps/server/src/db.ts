import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { contacts, feedback, widgetVisitors } from "./schema";
import { log } from "./log";

// Postgres via Drizzle ORM (on Bun's native SQL client). Backs the optional
// widget usage log + contact emails. Modeled on redis.ts: FAILS OPEN; a missing
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
  // Drizzle query builders are LAZY thenables; they re-run the SQL on every
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

export type WidgetVisit = {
  lfmUser: string; // always present; anonymous visits are dropped before here
  fingerprint: string | null;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
};

/**
 * Record a site visitor. Deduplicated: one row per (lfm_user, fingerprint), so a
 * repeat visit from the same device bumps seen_count + last_seen_at and refreshes
 * the ip (in case they changed networks) instead of inserting a duplicate. We
 * track WHO uses the site, not what they're listening to. Best-effort (returns
 * false, never throws).
 */
export async function recordWidgetVisit(v: WidgetVisit): Promise<boolean> {
  const d = getDb();
  if (!d) return false;

  try {
    await ensureMigrated(d);

    await withTimeout(
      () =>
        d
          .insert(widgetVisitors)
          .values({
            lfmUser: v.lfmUser,
            fingerprint: v.fingerprint ?? "",
            ip: v.ip,
            userAgent: v.userAgent,
            referer: v.referer,
          })
          .onConflictDoUpdate({
            target: [widgetVisitors.lfmUser, widgetVisitors.fingerprint],
            set: {
              seenCount: sql`${widgetVisitors.seenCount} + 1`,
              lastSeenAt: sql`now()`,
              ip: v.ip,
              userAgent: v.userAgent,
              referer: v.referer,
            },
          }),
      "widget visit upsert",
    );
    return true;
  } catch (err) {
    // Re-run migrations on the next write; self-heals if the schema went missing
    // (e.g. the database was wiped/recreated under a long-lived server).
    migrated = null;
    log("warn", "db.widget_visit_failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

export type CleanupResult = { duplicatesRemoved: number; stalePruned: number };

// Visitors not seen in this long are pruned by the cron job, which keeps the table to
// people who actually still use the site.
const STALE_VISITOR_DAYS = 365;

/**
 * Scheduled housekeeping for the visitor log (see the cron route in
 * analytics.ts). The unique index already prevents new duplicates, but this is a
 * belt-and-braces sweep: it collapses any lingering duplicate
 * (lfm_user, fingerprint) rows down to the most-recently-seen one, then prunes
 * visitors not seen in over a year. Returns how many rows each step removed.
 * Lets errors propagate so the route can surface a failure.
 */
export async function cleanupWidgetVisitors(): Promise<CleanupResult> {
  const d = getDb();
  if (!d) return { duplicatesRemoved: 0, stalePruned: 0 };

  await ensureMigrated(d);

  const rowCount = (r: unknown) => (Array.isArray(r) ? r.length : 0);

  const dupes = await withTimeout(
    () =>
      d.execute(sql`
        DELETE FROM "widget_events" AS a
        USING "widget_events" AS b
        WHERE a."lfm_user" = b."lfm_user"
          AND a."fingerprint" = b."fingerprint"
          AND (a."last_seen_at" < b."last_seen_at"
               OR (a."last_seen_at" = b."last_seen_at" AND a."id" < b."id"))
        RETURNING a."id"
      `),
    "visitor dedupe",
  );

  const stale = await withTimeout(
    () =>
      d.execute(sql`
        DELETE FROM "widget_events"
        WHERE "last_seen_at" < now() - make_interval(days => ${STALE_VISITOR_DAYS})
        RETURNING "id"
      `),
    "visitor prune",
  );

  return { duplicatesRemoved: rowCount(dupes), stalePruned: rowCount(stale) };
}

/**
 * Recover a Last.fm username from the visitor log by matching a device
 * fingerprint; used to link a contact/feedback submission to the widget the
 * person actually uses when they didn't type their username. Returns the most
 * recently seen match, or null. Assumes migrations have already run.
 */
async function recoverLfmUser(d: BunSQLDatabase, fingerprint: string | null): Promise<string | null> {
  if (!fingerprint) return null;
  const found = await withTimeout(
    () =>
      d
        .select({ u: widgetVisitors.lfmUser })
        .from(widgetVisitors)
        .where(and(eq(widgetVisitors.fingerprint, fingerprint), isNotNull(widgetVisitors.lfmUser)))
        .orderBy(desc(widgetVisitors.lastSeenAt))
        .limit(1),
    "lfm user recovery",
  );
  return found[0]?.u ?? null;
}

export type ContactInput = {
  email: string;
  lfmUser: string | null;
  fingerprint: string | null;
  ip: string | null;
  userAgent: string | null;
};

/**
 * Save a contact email (upserted by email, no duplicates). Links it to a
 * Last.fm username: uses the one submitted with the form, or, when absent,
 * recovers it from the usage log by matching the same device fingerprint. On
 * conflict, only fills in fields we now know; never clobbers a known username
 * with null.
 */
export async function upsertContact(c: ContactInput): Promise<boolean> {
  const d = getDb();
  if (!d) return false;

  try {
    await ensureMigrated(d);

    const lfmUser = c.lfmUser ?? (await recoverLfmUser(d, c.fingerprint));

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

export type FeedbackInput = {
  name: string | null;
  email: string | null;
  handle: string | null;
  platform: string | null;
  good: string | null;
  bad: string | null;
  subscribed: boolean;
  lfmUser: string | null;
  fingerprint: string | null;
  ip: string | null;
  userAgent: string | null;
};

/**
 * Save a feedback submission (append-only, one row per submit). When the user
 * didn't type a Last.fm username, recover it from the visitor log by
 * fingerprint, same as contacts. Best-effort (returns false, never throws).
 */
export async function insertFeedback(f: FeedbackInput): Promise<boolean> {
  const d = getDb();
  if (!d) return false;

  try {
    await ensureMigrated(d);

    const lfmUser = f.lfmUser ?? (await recoverLfmUser(d, f.fingerprint));

    await withTimeout(
      () =>
        d.insert(feedback).values({
          name: f.name,
          email: f.email,
          handle: f.handle,
          platform: f.platform,
          good: f.good,
          bad: f.bad,
          subscribed: f.subscribed,
          lfmUser,
          fingerprint: f.fingerprint,
          ip: f.ip,
          userAgent: f.userAgent,
        }),
      "feedback insert",
    );
    return true;
  } catch (err) {
    migrated = null; // self-heal a missing schema on the next write
    log("warn", "db.feedback_failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/**
 * Count how many distinct Last.fm users have ever used the site. Each row in
 * widget_events is already one unique (lfm_user, fingerprint) visitor, so we
 * count distinct lfm_user to collapse the same person across devices into one.
 * Read-only and best-effort: returns null on any failure (caller keeps its last
 * known value) and never throws.
 */
export async function countWidgetUsers(): Promise<number | null> {
  const d = getDb();
  if (!d) return null;

  try {
    await ensureMigrated(d);
    const rows = (await withTimeout(
      () => d.execute(sql`select count(distinct "lfm_user")::int as n from "widget_events"`),
      "user count",
    )) as Array<{ n: number }>;
    return rows?.[0]?.n ?? 0;
  } catch (err) {
    migrated = null; // self-heal a missing schema on the next call
    log("warn", "db.user_count_failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function dbPing(): Promise<boolean> {
  const d = getDb();
  if (!d) return false;
  const rows = (await withTimeout(() => d.execute(sql`select 1 as ok`), "ping")) as Array<{ ok: number }>;
  return rows?.[0]?.ok === 1;
}
