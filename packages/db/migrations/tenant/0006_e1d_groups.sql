CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"group_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"enrolled_at" date DEFAULT current_date NOT NULL,
	"activated_at" date,
	"paused_at" date,
	"left_at" date,
	"left_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_memberships_left_consistent" CHECK (("group_memberships"."status" = 'left') = ("group_memberships"."left_at" is not null)),
	CONSTRAINT "group_memberships_activated" CHECK ("group_memberships"."status" <> 'active' or "group_memberships"."activated_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "group_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"branch_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"room_id" uuid,
	"name" text NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"duration_months" integer DEFAULT 0 NOT NULL,
	"days" text[] NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"start_date" date NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"teacher_salary_type" text,
	"teacher_salary_percent" integer,
	"teacher_salary_amount" bigint,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "groups_price_nonneg" CHECK ("groups"."price" >= 0 and "groups"."duration_months" >= 0),
	CONSTRAINT "groups_days_nonempty" CHECK (cardinality("groups"."days") between 1 and 7),
	CONSTRAINT "groups_time_format" CHECK ("groups"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and "groups"."end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "groups_color_hex" CHECK ("groups"."color" ~ '^#[0-9a-f]{6}$'),
	CONSTRAINT "groups_salary_override" CHECK (("groups"."teacher_salary_percent" is null or "groups"."teacher_salary_percent" between 0 and 100) and ("groups"."teacher_salary_amount" is null or "groups"."teacher_salary_amount" >= 0))
);
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Kompozit FK uchun noyob kalit FK dan oldin bo'lishi kerak
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."students"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_fk" FOREIGN KEY ("tenant_id","teacher_id") REFERENCES "public"."teachers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_room_fk" FOREIGN KEY ("tenant_id","room_id") REFERENCES "public"."rooms"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_memberships_group_idx" ON "group_memberships" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_memberships_student_idx" ON "group_memberships" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_open_uq" ON "group_memberships" USING btree ("tenant_id","group_id","student_id") WHERE "group_memberships"."left_at" is null;--> statement-breakpoint
CREATE INDEX "groups_branch_idx" ON "groups" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "groups_teacher_idx" ON "groups" USING btree ("teacher_id");--> statement-breakpoint
CREATE POLICY "group_memberships_tenant_isolation" ON "group_memberships" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "groups_tenant_isolation" ON "groups" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- RLS egaga ham (FORCE): ajratish testi har tenant_id li jadvalda tekshiradi (0001 izohi)
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_memberships" FORCE ROW LEVEL SECURITY;
