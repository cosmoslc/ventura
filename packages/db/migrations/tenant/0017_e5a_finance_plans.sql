CREATE TABLE "finance_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"month" text NOT NULL,
	"line" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_plans_cell_uq" UNIQUE("tenant_id","branch_id","month","line"),
	CONSTRAINT "finance_plans_amount" CHECK ("finance_plans"."amount" > 0),
	CONSTRAINT "finance_plans_month" CHECK ("finance_plans"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "finance_plans_line" CHECK ("finance_plans"."line" in ('payments', 'income', 'salary'))
);
--> statement-breakpoint
ALTER TABLE "finance_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_plans_month_idx" ON "finance_plans" USING btree ("month");--> statement-breakpoint
CREATE POLICY "finance_plans_tenant_isolation" ON "finance_plans" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "finance_plans" FORCE ROW LEVEL SECURITY;
