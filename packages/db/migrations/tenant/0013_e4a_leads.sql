CREATE TABLE "lead_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"lead_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lead_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"lead_id" uuid NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"text" text NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_notes_text_len" CHECK (length("lead_notes"."text") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "lead_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lead_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_stages_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "lead_stages_name_len" CHECK (length("lead_stages"."name") between 1 and 60),
	CONSTRAINT "lead_stages_color_hex" CHECK ("lead_stages"."color" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "lead_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"phone2" text,
	"source" text,
	"course_id" uuid,
	"stage_id" uuid NOT NULL,
	"assigned_to" uuid,
	"target_date" date,
	"note" text,
	"custom_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid,
	"lost_reason" text,
	"lost_note" text,
	"lost_from_stage_id" uuid,
	"created_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"archive_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "leads_name_len" CHECK (length("leads"."name") between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_fk" FOREIGN KEY ("tenant_id","lead_id") REFERENCES "public"."leads"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_from_fk" FOREIGN KEY ("tenant_id","from_stage_id") REFERENCES "public"."lead_stages"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_to_fk" FOREIGN KEY ("tenant_id","to_stage_id") REFERENCES "public"."lead_stages"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_actor_fk" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_fk" FOREIGN KEY ("tenant_id","lead_id") REFERENCES "public"."leads"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_author_fk" FOREIGN KEY ("tenant_id","author_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_fk" FOREIGN KEY ("tenant_id","stage_id") REFERENCES "public"."lead_stages"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_lost_from_fk" FOREIGN KEY ("tenant_id","lost_from_stage_id") REFERENCES "public"."lead_stages"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_fk" FOREIGN KEY ("tenant_id","assigned_to") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_archived_by_fk" FOREIGN KEY ("tenant_id","archived_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_events_lead_idx" ON "lead_events" USING btree ("lead_id","at");--> statement-breakpoint
CREATE INDEX "lead_notes_lead_idx" ON "lead_notes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_branch_idx" ON "leads" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "leads_phone_idx" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "leads_assigned_idx" ON "leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE POLICY "lead_events_tenant_isolation" ON "lead_events" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "lead_notes_tenant_isolation" ON "lead_notes" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "lead_stages_tenant_isolation" ON "lead_stages" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "leads_tenant_isolation" ON "leads" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "lead_stages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_notes" FORCE ROW LEVEL SECURITY;
