CREATE TABLE "lead_first_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"lead_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"lesson_date" date NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_by" uuid,
	"marked_by" uuid,
	"marked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_first_lessons_marked" CHECK ("lead_first_lessons"."status" = 'scheduled' or "lead_first_lessons"."marked_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "lead_first_lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_first_lessons" ADD CONSTRAINT "lead_first_lessons_lead_fk" FOREIGN KEY ("tenant_id","lead_id") REFERENCES "public"."leads"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_first_lessons" ADD CONSTRAINT "lead_first_lessons_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_first_lessons" ADD CONSTRAINT "lead_first_lessons_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_first_lessons" ADD CONSTRAINT "lead_first_lessons_marked_by_fk" FOREIGN KEY ("tenant_id","marked_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_first_lessons_lead_uq" ON "lead_first_lessons" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_first_lessons_group_date_idx" ON "lead_first_lessons" USING btree ("group_id","lesson_date");--> statement-breakpoint
CREATE POLICY "lead_first_lessons_tenant_isolation" ON "lead_first_lessons" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "lead_first_lessons" FORCE ROW LEVEL SECURITY;
