CREATE TABLE "sms_provider" (
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"mode" text DEFAULT 'own' NOT NULL,
	"provider" text DEFAULT 'eskiz' NOT NULL,
	"email" text,
	"secret_enc" text,
	"token_enc" text,
	"token_expires_at" timestamp with time zone,
	"sender" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"quiet_from" smallint DEFAULT 21 NOT NULL,
	"quiet_to" smallint DEFAULT 8 NOT NULL,
	"checked_at" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_provider_tenant_id_pk" PRIMARY KEY("tenant_id"),
	CONSTRAINT "sms_provider_quiet_hours" CHECK ("sms_provider"."quiet_from" between 0 and 23 and "sms_provider"."quiet_to" between 0 and 23),
	CONSTRAINT "sms_provider_email_len" CHECK ("sms_provider"."email" is null or length("sms_provider"."email") between 3 and 200),
	CONSTRAINT "sms_provider_sender_len" CHECK ("sms_provider"."sender" is null or length("sms_provider"."sender") between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "sms_provider" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sms_provider" ADD CONSTRAINT "sms_provider_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sms_provider_tenant_isolation" ON "sms_provider" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "sms_provider" FORCE ROW LEVEL SECURITY;