CREATE TABLE "coin_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"student_id" uuid NOT NULL,
	"group_id" uuid,
	"rule" text NOT NULL,
	"source_key" text NOT NULL,
	"amount" integer NOT NULL,
	"ref_date" date NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_entries_source_uq" UNIQUE("tenant_id","student_id","rule","source_key"),
	CONSTRAINT "coin_entries_amount" CHECK ("coin_entries"."amount" between 1 and 100000),
	CONSTRAINT "coin_entries_source_len" CHECK (length("coin_entries"."source_key") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "coin_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coin_entries" ADD CONSTRAINT "coin_entries_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_entries" ADD CONSTRAINT "coin_entries_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coin_entries_student_idx" ON "coin_entries" USING btree ("student_id","ref_date");--> statement-breakpoint
CREATE INDEX "coin_entries_ref_date_idx" ON "coin_entries" USING btree ("ref_date");--> statement-breakpoint
CREATE POLICY "coin_entries_tenant_isolation" ON "coin_entries" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "coin_entries" FORCE ROW LEVEL SECURITY;
