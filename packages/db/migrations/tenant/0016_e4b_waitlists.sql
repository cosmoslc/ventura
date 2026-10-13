CREATE TABLE "lead_waitlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"course_id" uuid,
	"note" text,
	"created_by" uuid,
	"group_id" uuid,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_waitlists_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "lead_waitlists_name_len" CHECK (length("lead_waitlists"."name") between 1 and 120),
	CONSTRAINT "lead_waitlists_closed" CHECK ("lead_waitlists"."group_id" is null or "lead_waitlists"."closed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "lead_waitlists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "waitlist_id" uuid;--> statement-breakpoint
ALTER TABLE "lead_waitlists" ADD CONSTRAINT "lead_waitlists_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_waitlists" ADD CONSTRAINT "lead_waitlists_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_waitlists" ADD CONSTRAINT "lead_waitlists_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_waitlists" ADD CONSTRAINT "lead_waitlists_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_waitlists" ADD CONSTRAINT "lead_waitlists_closed_by_fk" FOREIGN KEY ("tenant_id","closed_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_waitlists_branch_idx" ON "lead_waitlists" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_waitlist_fk" FOREIGN KEY ("tenant_id","waitlist_id") REFERENCES "public"."lead_waitlists"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_waitlist_idx" ON "leads" USING btree ("waitlist_id");--> statement-breakpoint
CREATE POLICY "lead_waitlists_tenant_isolation" ON "lead_waitlists" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "lead_waitlists" FORCE ROW LEVEL SECURITY;
