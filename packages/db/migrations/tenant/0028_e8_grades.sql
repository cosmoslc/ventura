CREATE TABLE "lesson_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"group_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"date" date NOT NULL,
	"score" smallint,
	"scale" smallint NOT NULL,
	"homework" boolean,
	"marked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_grades_group_student_day_uq" UNIQUE("tenant_id","group_id","student_id","date"),
	CONSTRAINT "lesson_grades_scale" CHECK ("lesson_grades"."scale" in (5, 10, 100)),
	CONSTRAINT "lesson_grades_score" CHECK ("lesson_grades"."score" is null or ("lesson_grades"."score" > 0 and "lesson_grades"."score" <= "lesson_grades"."scale")),
	CONSTRAINT "lesson_grades_not_empty" CHECK ("lesson_grades"."score" is not null or "lesson_grades"."homework" is not null)
);
--> statement-breakpoint
ALTER TABLE "lesson_grades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lesson_grades" ADD CONSTRAINT "lesson_grades_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_grades" ADD CONSTRAINT "lesson_grades_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_grades" ADD CONSTRAINT "lesson_grades_marked_by_fk" FOREIGN KEY ("tenant_id","marked_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_grades_group_date_idx" ON "lesson_grades" USING btree ("group_id","date");--> statement-breakpoint
CREATE INDEX "lesson_grades_student_idx" ON "lesson_grades" USING btree ("student_id","date");--> statement-breakpoint
CREATE POLICY "lesson_grades_tenant_isolation" ON "lesson_grades" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "lesson_grades" FORCE ROW LEVEL SECURITY;
