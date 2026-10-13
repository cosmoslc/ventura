CREATE TABLE "salary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"user_id" uuid,
	"teacher_id" uuid,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"month" text NOT NULL,
	"date" date NOT NULL,
	"method_id" uuid,
	"note" text,
	"created_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salary_entries_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "salary_entries_one_person" CHECK (("salary_entries"."user_id" is null) <> ("salary_entries"."teacher_id" is null)),
	CONSTRAINT "salary_entries_amount" CHECK ("salary_entries"."amount" > 0),
	CONSTRAINT "salary_entries_month" CHECK ("salary_entries"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "salary_entries_method" CHECK (("salary_entries"."kind" in ('salary', 'advance')) = ("salary_entries"."method_id" is not null)),
	CONSTRAINT "salary_entries_note_len" CHECK ("salary_entries"."note" is null or length("salary_entries"."note") <= 500),
	CONSTRAINT "salary_entries_void" CHECK (("salary_entries"."voided_at" is null) = ("salary_entries"."voided_by" is null))
);
--> statement-breakpoint
ALTER TABLE "salary_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "salary_entries" ADD CONSTRAINT "salary_entries_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_entries" ADD CONSTRAINT "salary_entries_teacher_fk" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "public"."teachers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_entries" ADD CONSTRAINT "salary_entries_method_fk" FOREIGN KEY ("tenant_id","method_id") REFERENCES "public"."payment_methods"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_entries" ADD CONSTRAINT "salary_entries_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_entries" ADD CONSTRAINT "salary_entries_voided_by_fk" FOREIGN KEY ("tenant_id","voided_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "salary_entries_month_idx" ON "salary_entries" USING btree ("month");--> statement-breakpoint
CREATE INDEX "salary_entries_user_idx" ON "salary_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "salary_entries_teacher_idx" ON "salary_entries" USING btree ("teacher_id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "students_created_by_idx" ON "students" USING btree ("created_by");--> statement-breakpoint
CREATE POLICY "salary_entries_tenant_isolation" ON "salary_entries" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "salary_entries" FORCE ROW LEVEL SECURITY;
