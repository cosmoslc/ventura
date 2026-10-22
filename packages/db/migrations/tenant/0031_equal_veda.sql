CREATE TABLE "group_homeworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"group_id" uuid NOT NULL,
	"lesson_date" date NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_homeworks_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "group_homeworks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_homeworks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "group_homeworks" ADD CONSTRAINT "group_homeworks_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_homeworks" ADD CONSTRAINT "group_homeworks_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_homeworks_group_idx" ON "group_homeworks" USING btree ("group_id","lesson_date");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_tenant_user_uq" UNIQUE("tenant_id","user_id");--> statement-breakpoint
CREATE POLICY "group_homeworks_tenant_isolation" ON "group_homeworks" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));