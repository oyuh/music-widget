import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Widget usage log. One row per unique (lfm_user, fingerprint, event) so repeated
 * opens/copies from the same device DON'T create duplicate rows — the upsert in
 * db.ts bumps `seen_count` / `last_seen_at` and refreshes the latest song instead.
 */
export const widgetEvents = pgTable(
  "widget_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    event: text("event").notNull(), // "open" | "copy"
    lfmUser: text("lfm_user").notNull(),
    // Empty string (not null) when unknown, so the unique index treats it as one bucket.
    fingerprint: text("fingerprint").notNull().default(""),
    trackName: text("track_name"),
    trackArtist: text("track_artist"),
    trackAlbum: text("track_album"),
    isPlaying: boolean("is_playing"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    referer: text("referer"),
    seenCount: integer("seen_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("widget_events_identity_idx").on(t.lfmUser, t.fingerprint, t.event),
    index("widget_events_lfm_user_idx").on(t.lfmUser),
    index("widget_events_last_seen_idx").on(t.lastSeenAt),
  ],
);

/**
 * Contact emails captured from the editor's "Contact" form. Linked back to a
 * Last.fm username (either supplied with the email, or recovered from the usage
 * log by matching the same device fingerprint) so an outage email can name the
 * user's widget. Upserted by email — one row per address.
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

export type WidgetEventRow = typeof widgetEvents.$inferInsert;
export type ContactRow = typeof contacts.$inferInsert;
