CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_tenant_name_uq" UNIQUE("tenant_id","name"),
	CONSTRAINT "positions_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "positions_color_hex" CHECK ("positions"."color" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_positions" (
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"user_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	CONSTRAINT "user_positions_user_id_position_id_pk" PRIMARY KEY("user_id","position_id")
);
--> statement-breakpoint
ALTER TABLE "user_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "salary_type" text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_salary" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kpi_student_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kpi_contract_bonus" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "custom_data" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "user_positions" ADD CONSTRAINT "user_positions_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_positions" ADD CONSTRAINT "user_positions_position_fk" FOREIGN KEY ("tenant_id","position_id") REFERENCES "public"."positions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_salary_nonneg" CHECK ("users"."monthly_salary" >= 0 and "users"."kpi_student_amount" >= 0 and "users"."kpi_contract_bonus" >= 0);--> statement-breakpoint
CREATE POLICY "positions_tenant_isolation" ON "positions" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "user_positions_tenant_isolation" ON "user_positions" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "positions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_positions" FORCE ROW LEVEL SECURITY;
