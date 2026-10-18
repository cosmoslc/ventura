CREATE TABLE "sms_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"total" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_dispatches_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "sms_dispatches_title_len" CHECK (length("sms_dispatches"."title") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "sms_dispatches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"kind" text NOT NULL,
	"template_id" uuid,
	"dispatch_id" uuid,
	"student_id" uuid,
	"staff_id" uuid,
	"group_id" uuid,
	"branch_id" uuid,
	"recipient" text NOT NULL,
	"phone" text NOT NULL,
	"text" text NOT NULL,
	"parts" smallint DEFAULT 1 NOT NULL,
	"cost" integer,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"error" text,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text,
	CONSTRAINT "sms_messages_dedupe_uq" UNIQUE("tenant_id","dedupe_key"),
	CONSTRAINT "sms_messages_phone" CHECK ("sms_messages"."phone" ~ '^998[0-9]{9}$'),
	CONSTRAINT "sms_messages_text_len" CHECK (length("sms_messages"."text") between 1 and 1000),
	CONSTRAINT "sms_messages_attempts" CHECK ("sms_messages"."attempts" between 0 and 10)
);
--> statement-breakpoint
ALTER TABLE "sms_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ADD CONSTRAINT "sms_dispatches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_template_id_sms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sms_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_staff_fk" FOREIGN KEY ("tenant_id","staff_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_dispatch_fk" FOREIGN KEY ("tenant_id","dispatch_id") REFERENCES "public"."sms_dispatches"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_messages_queue_idx" ON "sms_messages" USING btree ("send_after") WHERE "sms_messages"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "sms_messages_provider_idx" ON "sms_messages" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "sms_messages_created_idx" ON "sms_messages" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sms_messages_student_idx" ON "sms_messages" USING btree ("student_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sms_messages_group_idx" ON "sms_messages" USING btree ("group_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sms_messages_dispatch_idx" ON "sms_messages" USING btree ("dispatch_id");--> statement-breakpoint
CREATE POLICY "sms_dispatches_tenant_isolation" ON "sms_dispatches" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "sms_messages_tenant_isolation" ON "sms_messages" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "sms_dispatches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sms_messages" FORCE ROW LEVEL SECURITY;