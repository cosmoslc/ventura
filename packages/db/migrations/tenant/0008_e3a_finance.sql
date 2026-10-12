CREATE TABLE "group_prices" (
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"group_id" uuid NOT NULL,
	"from_month" text NOT NULL,
	"price" bigint NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_prices_tenant_id_group_id_from_month_pk" PRIMARY KEY("tenant_id","group_id","from_month"),
	CONSTRAINT "group_prices_month" CHECK ("group_prices"."from_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "group_prices_nonneg" CHECK ("group_prices"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "group_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "membership_pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"membership_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_pauses_range" CHECK ("membership_pauses"."end_date" is null or "membership_pauses"."end_date" >= "membership_pauses"."start_date")
);
--> statement-breakpoint
ALTER TABLE "membership_pauses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_methods_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "payment_methods_name_uq" UNIQUE("tenant_id","name"),
	CONSTRAINT "payment_methods_name_len" CHECK (length("payment_methods"."name") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"student_id" uuid NOT NULL,
	"group_id" uuid,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"month" text,
	"date" date NOT NULL,
	"method_id" uuid,
	"receipt_no" integer,
	"note" text,
	"created_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "payments_receipt_uq" UNIQUE("tenant_id","receipt_no"),
	CONSTRAINT "payments_amount" CHECK (("payments"."kind" = 'correction' and "payments"."amount" <> 0) or ("payments"."kind" <> 'correction' and "payments"."amount" > 0)),
	CONSTRAINT "payments_method" CHECK (("payments"."kind" in ('payment', 'refund')) = ("payments"."method_id" is not null)),
	CONSTRAINT "payments_receipt" CHECK (("payments"."kind" = 'payment') = ("payments"."receipt_no" is not null)),
	CONSTRAINT "payments_month" CHECK ("payments"."month" is null or "payments"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "payments_void" CHECK (("payments"."voided_at" is null) = ("payments"."voided_by" is null)),
	CONSTRAINT "payments_note_len" CHECK ("payments"."note" is null or length("payments"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"student_id" uuid NOT NULL,
	"group_id" uuid,
	"kind" text NOT NULL,
	"value" bigint NOT NULL,
	"from_month" text NOT NULL,
	"to_month" text,
	"affects_teacher" boolean DEFAULT true NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_discounts_value" CHECK (("student_discounts"."kind" = 'percent' and "student_discounts"."value" between 1 and 100) or ("student_discounts"."kind" = 'fixed' and "student_discounts"."value" > 0)),
	CONSTRAINT "student_discounts_months" CHECK ("student_discounts"."from_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and ("student_discounts"."to_month" is null or ("student_discounts"."to_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and "student_discounts"."to_month" >= "student_discounts"."from_month"))),
	CONSTRAINT "student_discounts_reason" CHECK (length("student_discounts"."reason") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "student_discounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "group_prices" ADD CONSTRAINT "group_prices_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_prices" ADD CONSTRAINT "group_prices_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_pauses" ADD CONSTRAINT "membership_pauses_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."group_memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_method_fk" FOREIGN KEY ("tenant_id","method_id") REFERENCES "public"."payment_methods"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_fk" FOREIGN KEY ("tenant_id","voided_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_pauses_membership_idx" ON "membership_pauses" USING btree ("membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_pauses_open_uq" ON "membership_pauses" USING btree ("tenant_id","membership_id") WHERE "membership_pauses"."end_date" is null;--> statement-breakpoint
CREATE INDEX "payments_student_idx" ON "payments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "payments_group_month_idx" ON "payments" USING btree ("group_id","month");--> statement-breakpoint
CREATE INDEX "student_discounts_student_idx" ON "student_discounts" USING btree ("student_id");--> statement-breakpoint
CREATE POLICY "group_prices_tenant_isolation" ON "group_prices" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "membership_pauses_tenant_isolation" ON "membership_pauses" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "payment_methods_tenant_isolation" ON "payment_methods" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "payments_tenant_isolation" ON "payments" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "student_discounts_tenant_isolation" ON "student_discounts" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "group_prices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "membership_pauses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_methods" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "student_discounts" FORCE ROW LEVEL SECURITY;
