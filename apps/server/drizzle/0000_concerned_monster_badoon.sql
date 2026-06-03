CREATE TABLE "contacts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"lfm_user" text,
	"fingerprint" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "widget_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "widget_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event" text NOT NULL,
	"lfm_user" text NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"track_name" text,
	"track_artist" text,
	"track_album" text,
	"is_playing" boolean,
	"ip" text,
	"user_agent" text,
	"referer" text,
	"seen_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contacts_lfm_user_idx" ON "contacts" USING btree ("lfm_user");--> statement-breakpoint
CREATE INDEX "contacts_fingerprint_idx" ON "contacts" USING btree ("fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "widget_events_identity_idx" ON "widget_events" USING btree ("lfm_user","fingerprint","event");--> statement-breakpoint
CREATE INDEX "widget_events_lfm_user_idx" ON "widget_events" USING btree ("lfm_user");--> statement-breakpoint
CREATE INDEX "widget_events_last_seen_idx" ON "widget_events" USING btree ("last_seen_at");