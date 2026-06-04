DROP INDEX "widget_events_identity_idx";--> statement-breakpoint
-- Collapse pre-existing duplicate (lfm_user, fingerprint) rows e.g. the old
-- separate "open" and "copy" rows for the same person into one visitor before
-- the new uniqueness is enforced. The most-recently-seen row survives and
-- inherits the group's combined seen_count so visit totals aren't lost.
UPDATE "widget_events" AS keep
SET "seen_count" = grp.total
FROM (
	SELECT "lfm_user", "fingerprint", sum("seen_count") AS total
	FROM "widget_events"
	GROUP BY "lfm_user", "fingerprint"
	HAVING count(*) > 1
) AS grp
WHERE keep."lfm_user" = grp."lfm_user"
	AND keep."fingerprint" = grp."fingerprint"
	AND keep."id" = (
		SELECT x."id" FROM "widget_events" AS x
		WHERE x."lfm_user" = keep."lfm_user" AND x."fingerprint" = keep."fingerprint"
		ORDER BY x."last_seen_at" DESC, x."id" DESC
		LIMIT 1
	);--> statement-breakpoint
DELETE FROM "widget_events" AS a
USING "widget_events" AS b
WHERE a."lfm_user" = b."lfm_user"
	AND a."fingerprint" = b."fingerprint"
	AND (a."last_seen_at" < b."last_seen_at" OR (a."last_seen_at" = b."last_seen_at" AND a."id" < b."id"));--> statement-breakpoint
CREATE UNIQUE INDEX "widget_events_identity_idx" ON "widget_events" USING btree ("lfm_user","fingerprint");--> statement-breakpoint
ALTER TABLE "widget_events" DROP COLUMN "event";--> statement-breakpoint
ALTER TABLE "widget_events" DROP COLUMN "track_name";--> statement-breakpoint
ALTER TABLE "widget_events" DROP COLUMN "track_artist";--> statement-breakpoint
ALTER TABLE "widget_events" DROP COLUMN "track_album";--> statement-breakpoint
ALTER TABLE "widget_events" DROP COLUMN "is_playing";
