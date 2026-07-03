import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Widget visitors: WHO uses the site, not what they're doing on it.
 *
 * One row per unique visitor, keyed by (lfm_user, fingerprint). The same person
 * opening or copying the widget any number of times NEVER adds rows: the upsert
 * in db.ts bumps `seen_count` / `last_seen_at` and refreshes their `ip` (so we
 * follow them if they move networks) instead of inserting a duplicate.
 *
 * Deliberately minimal: we intentionally do NOT store the track they were
 * listening to or per-click event types; that was more than we need.
 */
export const widgetVisitors = pgTable(
  // Table name kept as "widget_events" so this is an in-place migration of the
  // existing table rather than a drop/recreate.
  "widget_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    lfmUser: text("lfm_user").notNull(),
    // Empty string (not null) when unknown, so the unique index treats it as one bucket.
    fingerprint: text("fingerprint").notNull().default(""),
    ip: text("ip"),
    userAgent: text("user_agent"),
    referer: text("referer"),
    seenCount: integer("seen_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("widget_events_identity_idx").on(t.lfmUser, t.fingerprint),
    index("widget_events_lfm_user_idx").on(t.lfmUser),
    index("widget_events_last_seen_idx").on(t.lastSeenAt),
  ],
);

/**
 * Contact emails captured from the editor's "Contact" form. Linked back to a
 * Last.fm username (either supplied with the email, or recovered from the
 * visitor log by matching the same device fingerprint) so an outage email can
 * name the user's widget. Upserted by email, one row per address.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull().unique(),
    lfmUser: text("lfm_user"),
    fingerprint: text("fingerprint"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contacts_lfm_user_idx").on(t.lfmUser), index("contacts_fingerprint_idx").on(t.fingerprint)],
);

/**
 * Free-form feedback from the editor's "Give feedback" modal. Every field is
 * optional; we keep a row even when sparse. `subscribed` records whether they
 * also opted into outage/event email alerts (which separately upserts a
 * `contacts` row). `lfmUser` is the supplied or fingerprint-recovered Last.fm
 * username, kept so we can tie a note back to a known visitor. Append-only:
 * one row per submission, no upsert.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name"),
    email: text("email"),
    // Their streaming handle + platform (e.g. "twitch"), so we know who's asking.
    handle: text("handle"),
    platform: text("platform"),
    good: text("good"),
    bad: text("bad"),
    subscribed: boolean("subscribed").notNull().default(false),
    lfmUser: text("lfm_user"),
    fingerprint: text("fingerprint"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("feedback_created_at_idx").on(t.createdAt), index("feedback_lfm_user_idx").on(t.lfmUser)],
);

export type WidgetVisitorRow = typeof widgetVisitors.$inferInsert;
export type ContactRow = typeof contacts.$inferInsert;
export type FeedbackRow = typeof feedback.$inferInsert;
