CREATE TABLE "student_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"text" text NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_notes_text_len" CHECK (length("student_notes"."text") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "student_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"parent_name" text,
	"parent_phone" text,
	"birth_date" date,
	"gender" text,
	"school" text,
	"grade" text,
	"address" text,
	"source" text,
	"interested_course_id" uuid,
	"note" text,
	"status" text DEFAULT 'trial' NOT NULL,
	"status_note" text,
	"status_changed_at" timestamp with time zone,
	"joined_at" date DEFAULT current_date NOT NULL,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"archived_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Kompozit FK uchun noyob kalit FK dan oldin bo'lishi kerak
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_author_fk" FOREIGN KEY ("tenant_id","author_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_course_fk" FOREIGN KEY ("tenant_id","interested_course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_archived_by_fk" FOREIGN KEY ("tenant_id","archived_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_notes_student_idx" ON "student_notes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "students_branch_idx" ON "students" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "students_phone_idx" ON "students" USING btree ("phone");--> statement-breakpoint
CREATE POLICY "student_notes_tenant_isolation" ON "student_notes" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "students_tenant_isolation" ON "students" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "student_notes" FORCE ROW LEVEL SECURITY;
