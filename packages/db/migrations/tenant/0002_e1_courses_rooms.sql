CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"duration_months" integer DEFAULT 0 NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_price_nonneg" CHECK ("courses"."price" >= 0),
	CONSTRAINT "courses_duration_nonneg" CHECK ("courses"."duration_months" >= 0),
	CONSTRAINT "courses_color_hex" CHECK ("courses"."color" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_capacity_range" CHECK ("rooms"."capacity" between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "color" text DEFAULT '#6366f1' NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_branch_idx" ON "courses" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "rooms_branch_idx" ON "rooms" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_color_hex" CHECK ("branches"."color" ~ '^#[0-9a-f]{6}$');--> statement-breakpoint
CREATE POLICY "courses_tenant_isolation" ON "courses" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "rooms_tenant_isolation" ON "rooms" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "courses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rooms" FORCE ROW LEVEL SECURITY;
