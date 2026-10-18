CREATE TABLE "sms_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"parts" smallint DEFAULT 1 NOT NULL,
	"provider_template_id" integer,
	"moderation" text DEFAULT 'draft' NOT NULL,
	"submitted_body" text,
	"submitted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "sms_templates_name_len" CHECK (length("sms_templates"."name") between 1 and 80),
	CONSTRAINT "sms_templates_body_len" CHECK (length("sms_templates"."body") between 1 and 1000),
	CONSTRAINT "sms_templates_parts" CHECK ("sms_templates"."parts" between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "sms_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_templates_kind_idx" ON "sms_templates" USING btree ("kind") WHERE "sms_templates"."archived_at" is null;--> statement-breakpoint
CREATE POLICY "sms_templates_tenant_isolation" ON "sms_templates" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "sms_templates" FORCE ROW LEVEL SECURITY;