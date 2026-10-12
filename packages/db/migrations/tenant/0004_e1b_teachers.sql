CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"kind" text DEFAULT 'teacher' NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"gender" text,
	"birth_date" date,
	"assigned_teacher_id" uuid,
	"salary_type" text DEFAULT 'percent' NOT NULL,
	"revenue_share_percent" integer DEFAULT 0 NOT NULL,
	"per_student_salary" bigint DEFAULT 0 NOT NULL,
	"fixed_salary" bigint DEFAULT 0 NOT NULL,
	"working_days" text[] DEFAULT '{}'::text[] NOT NULL,
	"start_time" text,
	"end_time" text,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teachers_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "teachers_percent_range" CHECK ("teachers"."revenue_share_percent" between 0 and 100),
	CONSTRAINT "teachers_salary_nonneg" CHECK ("teachers"."per_student_salary" >= 0 and "teachers"."fixed_salary" >= 0),
	CONSTRAINT "teachers_assigned_support" CHECK ("teachers"."assigned_teacher_id" is null or "teachers"."kind" = 'support'),
	CONSTRAINT "teachers_time_format" CHECK (("teachers"."start_time" is null or "teachers"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and ("teachers"."end_time" is null or "teachers"."end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
);
--> statement-breakpoint
ALTER TABLE "teachers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_assigned_fk" FOREIGN KEY ("tenant_id","assigned_teacher_id") REFERENCES "public"."teachers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teachers_branch_idx" ON "teachers" USING btree ("branch_id");--> statement-breakpoint
CREATE POLICY "teachers_tenant_isolation" ON "teachers" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "teachers" FORCE ROW LEVEL SECURITY;
