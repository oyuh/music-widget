CREATE TABLE "feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text,
	"email" text,
	"handle" text,
	"platform" text,
	"good" text,
	"bad" text,
	"subscribed" boolean DEFAULT false NOT NULL,
	"lfm_user" text,
	"fingerprint" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_lfm_user_idx" ON "feedback" USING btree ("lfm_user");