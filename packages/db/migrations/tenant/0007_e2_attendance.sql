CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"group_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"marked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_group_student_day_uq" UNIQUE("tenant_id","group_id","student_id","date"),
	CONSTRAINT "attendance_reason_len" CHECK ("attendance"."reason" is null or length("attendance"."reason") <= 500)
);
--> statement-breakpoint
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"user_id" uuid,
	"teacher_id" uuid,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"check_in" text,
	"note" text,
	"marked_by" uuid,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_attendance_user_day_uq" UNIQUE("tenant_id","user_id","date"),
	CONSTRAINT "employee_attendance_teacher_day_uq" UNIQUE("tenant_id","teacher_id","date"),
	CONSTRAINT "employee_attendance_one_person" CHECK (("employee_attendance"."user_id" is null) <> ("employee_attendance"."teacher_id" is null)),
	CONSTRAINT "employee_attendance_check_in" CHECK ("employee_attendance"."check_in" is null or "employee_attendance"."check_in" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "employee_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "holiday_branches" (
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"holiday_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "holiday_branches_holiday_id_branch_id_pk" PRIMARY KEY("holiday_id","branch_id")
);
--> statement-breakpoint
ALTER TABLE "holiday_branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"type" text DEFAULT 'official' NOT NULL,
	"affects_lessons" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "holidays_range" CHECK ("holidays"."end_date" >= "holidays"."start_date" and "holidays"."end_date" - "holidays"."start_date" < 60)
);
--> statement-breakpoint
ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_fk" FOREIGN KEY ("tenant_id","marked_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_attendance" ADD CONSTRAINT "employee_attendance_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_attendance" ADD CONSTRAINT "employee_attendance_teacher_fk" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "public"."teachers"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_attendance" ADD CONSTRAINT "employee_attendance_marked_by_fk" FOREIGN KEY ("tenant_id","marked_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holiday_branches" ADD CONSTRAINT "holiday_branches_holiday_fk" FOREIGN KEY ("tenant_id","holiday_id") REFERENCES "public"."holidays"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holiday_branches" ADD CONSTRAINT "holiday_branches_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_group_date_idx" ON "attendance" USING btree ("group_id","date");--> statement-breakpoint
CREATE INDEX "attendance_student_idx" ON "attendance" USING btree ("student_id","date");--> statement-breakpoint
CREATE INDEX "employee_attendance_date_idx" ON "employee_attendance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "holidays_dates_idx" ON "holidays" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE POLICY "attendance_tenant_isolation" ON "attendance" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "employee_attendance_tenant_isolation" ON "employee_attendance" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "holiday_branches_tenant_isolation" ON "holiday_branches" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "holidays_tenant_isolation" ON "holidays" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "holidays" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "holiday_branches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "employee_attendance" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance" FORCE ROW LEVEL SECURITY;
