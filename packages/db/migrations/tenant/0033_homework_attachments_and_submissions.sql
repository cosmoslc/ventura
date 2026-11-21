-- Migratsiya 0033: Uy vazifasi birikmalari va o'quvchi javoblari (submissions)
-- Muallif / Agent: Google Gemini

ALTER TABLE "group_homeworks" ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "homework_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"text" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"grade" integer,
	"feedback" text,
	"checked_at" timestamp with time zone,
	"checked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homework_submissions_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "homework_submissions_hw_student_uq" UNIQUE("tenant_id","homework_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "homework_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "homework_submissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'homework_submissions' AND policyname = 'homework_submissions_tenant_isolation') THEN
    CREATE POLICY "homework_submissions_tenant_isolation" ON "homework_submissions" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homework_submissions_homework_fk') THEN
    ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homework_fk" FOREIGN KEY ("tenant_id","homework_id") REFERENCES "public"."group_homeworks"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homework_submissions_student_fk') THEN
    ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homework_submissions_checked_by_fk') THEN
    ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_checked_by_fk" FOREIGN KEY ("tenant_id","checked_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homework_submissions_hw_idx" ON "homework_submissions" USING btree ("homework_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homework_submissions_student_idx" ON "homework_submissions" USING btree ("student_id");
