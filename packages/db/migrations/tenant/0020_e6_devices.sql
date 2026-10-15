ALTER TABLE "known_devices" ADD COLUMN "device_name" text;--> statement-breakpoint
ALTER TABLE "known_devices" ADD COLUMN "login_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "known_devices" ADD COLUMN "blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "known_devices" ADD COLUMN "blocked_by" uuid;--> statement-breakpoint
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_login_count_nonneg" CHECK ("known_devices"."login_count" >= 0);