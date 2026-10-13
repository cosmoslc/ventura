CREATE TABLE "additional_incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"method_id" uuid NOT NULL,
	"payer" text,
	"created_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "additional_incomes_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "additional_incomes_amount" CHECK ("additional_incomes"."amount" > 0),
	CONSTRAINT "additional_incomes_title_len" CHECK (length("additional_incomes"."title") between 1 and 120),
	CONSTRAINT "additional_incomes_payer_len" CHECK ("additional_incomes"."payer" is null or length("additional_incomes"."payer") <= 120),
	CONSTRAINT "additional_incomes_void" CHECK (("additional_incomes"."voided_at" is null) = ("additional_incomes"."voided_by" is null))
);
--> statement-breakpoint
ALTER TABLE "additional_incomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expense_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount" bigint NOT NULL,
	"method_id" uuid,
	"user_id" uuid,
	"teacher_id" uuid,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_plans_amount" CHECK ("expense_plans"."amount" > 0),
	CONSTRAINT "expense_plans_month" CHECK ("expense_plans"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "expense_plans_one_person" CHECK ("expense_plans"."user_id" is null or "expense_plans"."teacher_id" is null),
	CONSTRAINT "expense_plans_note_len" CHECK ("expense_plans"."note" is null or length("expense_plans"."note") <= 300)
);
--> statement-breakpoint
ALTER TABLE "expense_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"category_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"method_id" uuid NOT NULL,
	"user_id" uuid,
	"teacher_id" uuid,
	"created_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "expenses_amount" CHECK ("expenses"."amount" > 0),
	CONSTRAINT "expenses_reason_len" CHECK (length("expenses"."reason") between 1 and 300),
	CONSTRAINT "expenses_one_person" CHECK ("expenses"."user_id" is null or "expenses"."teacher_id" is null),
	CONSTRAINT "expenses_void" CHECK (("expenses"."voided_at" is null) = ("expenses"."voided_by" is null))
);
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_categories_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "finance_categories_name_uq" UNIQUE("tenant_id","kind","name"),
	CONSTRAINT "finance_categories_name_len" CHECK (length("finance_categories"."name") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "finance_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_category_branches" (
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"category_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "finance_category_branches_category_id_branch_id_pk" PRIMARY KEY("category_id","branch_id")
);
--> statement-breakpoint
ALTER TABLE "finance_category_branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "additional_incomes" ADD CONSTRAINT "additional_incomes_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "additional_incomes" ADD CONSTRAINT "additional_incomes_category_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."finance_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "additional_incomes" ADD CONSTRAINT "additional_incomes_method_fk" FOREIGN KEY ("tenant_id","method_id") REFERENCES "public"."payment_methods"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "additional_incomes" ADD CONSTRAINT "additional_incomes_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "additional_incomes" ADD CONSTRAINT "additional_incomes_voided_by_fk" FOREIGN KEY ("tenant_id","voided_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_plans" ADD CONSTRAINT "expense_plans_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_plans" ADD CONSTRAINT "expense_plans_category_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."finance_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_plans" ADD CONSTRAINT "expense_plans_method_fk" FOREIGN KEY ("tenant_id","method_id") REFERENCES "public"."payment_methods"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_plans" ADD CONSTRAINT "expense_plans_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_plans" ADD CONSTRAINT "expense_plans_teacher_fk" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "public"."teachers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_plans" ADD CONSTRAINT "expense_plans_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."finance_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_method_fk" FOREIGN KEY ("tenant_id","method_id") REFERENCES "public"."payment_methods"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_teacher_fk" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "public"."teachers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_fk" FOREIGN KEY ("tenant_id","voided_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_category_branches" ADD CONSTRAINT "finance_category_branches_category_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."finance_categories"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_category_branches" ADD CONSTRAINT "finance_category_branches_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "additional_incomes_date_idx" ON "additional_incomes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "additional_incomes_branch_idx" ON "additional_incomes" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "expense_plans_month_idx" ON "expense_plans" USING btree ("month");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "expenses_branch_idx" ON "expenses" USING btree ("branch_id");--> statement-breakpoint
CREATE POLICY "additional_incomes_tenant_isolation" ON "additional_incomes" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "expense_plans_tenant_isolation" ON "expense_plans" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "expenses_tenant_isolation" ON "expenses" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "finance_categories_tenant_isolation" ON "finance_categories" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "finance_category_branches_tenant_isolation" ON "finance_category_branches" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "finance_categories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_category_branches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "additional_incomes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expense_plans" FORCE ROW LEVEL SECURITY;
