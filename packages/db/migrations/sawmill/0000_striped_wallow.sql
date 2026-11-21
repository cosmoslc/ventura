CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"seq" bigserial NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"ip" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prev_hash" text,
	"hash" text NOT NULL,
	CONSTRAINT "audit_events_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"color" text DEFAULT '#10b981' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_tenant_name_uq" UNIQUE("tenant_id","name"),
	CONSTRAINT "branches_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "branches_color_hex" CHECK ("branches"."color" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_tenant_id_key_pk" PRIMARY KEY("tenant_id","key")
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "known_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"user_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"user_agent" text,
	"last_ip" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_name" text,
	"login_count" integer DEFAULT 1 NOT NULL,
	"blocked_at" timestamp with time zone,
	"blocked_by" uuid,
	CONSTRAINT "known_devices_login_count_nonneg" CHECK ("known_devices"."login_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "known_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "two_factors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"locale" text DEFAULT 'uz' NOT NULL,
	"telegram_chat_id" text,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tenant_email_uq" UNIQUE("tenant_id","email"),
	CONSTRAINT "users_tenant_phone_uq" UNIQUE("tenant_id","phone_number"),
	CONSTRAINT "users_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"terak_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"entered_unit" text DEFAULT 'piece' NOT NULL,
	"entered_qty" numeric(14, 4) NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"date" date NOT NULL,
	"recipient_name" text,
	"address" text,
	"phone" text,
	"truck_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispatches_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "dispatches_quantity_pos" CHECK ("dispatches"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "dispatches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_tenant_name_uq" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
ALTER TABLE "expense_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "general_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "general_expenses_amount_pos" CHECK ("general_expenses"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "general_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "material_sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"material_id" uuid NOT NULL,
	"thickness_cm" numeric(8, 2) NOT NULL,
	"width_cm" numeric(8, 2) NOT NULL,
	"length_cm" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_sizes_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "material_sizes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'dona' NOT NULL,
	"pricing_mode" text DEFAULT 'piece' NOT NULL,
	"thickness_cm" numeric(8, 2),
	"width_cm" numeric(8, 2),
	"length_cm" numeric(8, 2),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_tenant_name_uq" UNIQUE("tenant_id","name"),
	CONSTRAINT "materials_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"terak_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text,
	"address" text,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"ready_notified_at" timestamp with time zone,
	"due_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_quantity_pos" CHECK ("orders"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"worker_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_pos" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"terak_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"size_id" uuid,
	"delta" numeric(14, 4) NOT NULL,
	"source" text NOT NULL,
	"source_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "terak_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"terak_id" uuid NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"title" text,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"trips" integer,
	"price_per_trip" bigint,
	"dispatch_id" uuid,
	"truck_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terak_costs_amount_nonneg" CHECK ("terak_costs"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "terak_costs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "terak_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"terak_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"worker_price" bigint DEFAULT 0 NOT NULL,
	"selling_price" bigint DEFAULT 0 NOT NULL,
	"cube_worker_price" bigint DEFAULT 0 NOT NULL,
	"cube_price" bigint DEFAULT 0 NOT NULL,
	"goal" numeric(14, 4),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terak_materials_uq" UNIQUE("tenant_id","terak_id","material_id")
);
--> statement-breakpoint
ALTER TABLE "terak_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teraks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"purchase_date" date NOT NULL,
	"purchase_price" bigint DEFAULT 0 NOT NULL,
	"note" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teraks_tenant_name_uq" UNIQUE("tenant_id","name"),
	CONSTRAINT "teraks_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "teraks_purchase_price_nonneg" CHECK ("teraks"."purchase_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "teraks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trucks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trucks_tenant_name_uq" UNIQUE("tenant_id","name"),
	CONSTRAINT "trucks_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "trucks_amount_nonneg" CHECK ("trucks"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "trucks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wage_accruals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"worker_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"units" numeric(8, 2) NOT NULL,
	"rate" bigint NOT NULL,
	"amount" bigint NOT NULL,
	"terak_id" uuid,
	"work_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wage_accruals_period_uq" UNIQUE("tenant_id","worker_id","period_start","period_end")
);
--> statement-breakpoint
ALTER TABLE "wage_accruals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "work_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"worker_id" uuid NOT NULL,
	"terak_id" uuid,
	"work_type_id" uuid,
	"kind" text DEFAULT 'regular' NOT NULL,
	"group_id" uuid,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"material_id" uuid,
	"size_id" uuid,
	"quantity" numeric(14, 4),
	"rows" numeric(14, 4),
	"pay_unit" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_entries_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "work_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "work_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"terak_id" uuid,
	"work_type_id" uuid,
	"date" date NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"pay_full_to_each" boolean DEFAULT false NOT NULL,
	"material_id" uuid,
	"quantity" numeric(14, 4),
	"rows" numeric(14, 4),
	"pay_unit" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_groups_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "work_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "work_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'regular' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_types_tenant_name_uq" UNIQUE("tenant_id","name"),
	CONSTRAINT "work_types_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "work_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "worker_material_prices" (
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"worker_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"price" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_material_prices_tenant_id_worker_id_material_id_pk" PRIMARY KEY("tenant_id","worker_id","material_id")
);
--> statement-breakpoint
ALTER TABLE "worker_material_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT current_setting('app.tenant_id') NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"salary_type" text DEFAULT 'piecework' NOT NULL,
	"wage_amount" bigint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workers_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "workers_wage_amount_nonneg" CHECK ("workers"."wage_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "workers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_terak_id_teraks_id_fk" FOREIGN KEY ("terak_id") REFERENCES "teraks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_expenses" ADD CONSTRAINT "general_expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_sizes" ADD CONSTRAINT "material_sizes_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_terak_id_teraks_id_fk" FOREIGN KEY ("terak_id") REFERENCES "teraks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_terak_id_teraks_id_fk" FOREIGN KEY ("terak_id") REFERENCES "teraks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_size_id_material_sizes_id_fk" FOREIGN KEY ("size_id") REFERENCES "material_sizes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terak_costs" ADD CONSTRAINT "terak_costs_terak_id_teraks_id_fk" FOREIGN KEY ("terak_id") REFERENCES "teraks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terak_costs" ADD CONSTRAINT "terak_costs_dispatch_id_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terak_costs" ADD CONSTRAINT "terak_costs_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terak_materials" ADD CONSTRAINT "terak_materials_terak_id_teraks_id_fk" FOREIGN KEY ("terak_id") REFERENCES "teraks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terak_materials" ADD CONSTRAINT "terak_materials_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_accruals" ADD CONSTRAINT "wage_accruals_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_accruals" ADD CONSTRAINT "wage_accruals_terak_id_teraks_id_fk" FOREIGN KEY ("terak_id") REFERENCES "teraks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_accruals" ADD CONSTRAINT "wage_accruals_work_entry_id_work_entries_id_fk" FOREIGN KEY ("work_entry_id") REFERENCES "work_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_terak_id_teraks_id_fk" FOREIGN KEY ("terak_id") REFERENCES "teraks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_group_id_work_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "work_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_size_id_material_sizes_id_fk" FOREIGN KEY ("size_id") REFERENCES "material_sizes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_groups" ADD CONSTRAINT "work_groups_terak_id_teraks_id_fk" FOREIGN KEY ("terak_id") REFERENCES "teraks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_groups" ADD CONSTRAINT "work_groups_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_groups" ADD CONSTRAINT "work_groups_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_material_prices" ADD CONSTRAINT "worker_material_prices_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_material_prices" ADD CONSTRAINT "worker_material_prices_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_tenant_seq_idx" ON "audit_events" USING btree ("tenant_id","seq");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "known_devices_user_idx" ON "known_devices" USING btree ("user_id","device_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factors_user_id_idx" ON "two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "dispatches_terak_idx" ON "dispatches" USING btree ("terak_id");--> statement-breakpoint
CREATE INDEX "dispatches_date_idx" ON "dispatches" USING btree ("date");--> statement-breakpoint
CREATE INDEX "general_expenses_category_idx" ON "general_expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "general_expenses_date_idx" ON "general_expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "material_sizes_material_idx" ON "material_sizes" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "orders_terak_idx" ON "orders" USING btree ("terak_id");--> statement-breakpoint
CREATE INDEX "payments_worker_idx" ON "payments" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "stock_movements_terak_material_idx" ON "stock_movements" USING btree ("terak_id","material_id");--> statement-breakpoint
CREATE INDEX "terak_costs_terak_idx" ON "terak_costs" USING btree ("terak_id");--> statement-breakpoint
CREATE INDEX "terak_materials_terak_idx" ON "terak_materials" USING btree ("terak_id");--> statement-breakpoint
CREATE INDEX "work_entries_worker_idx" ON "work_entries" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "work_entries_terak_idx" ON "work_entries" USING btree ("terak_id");--> statement-breakpoint
CREATE INDEX "work_entries_date_idx" ON "work_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "work_groups_terak_idx" ON "work_groups" USING btree ("terak_id");--> statement-breakpoint
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "branches_tenant_isolation" ON "branches" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "settings_tenant_isolation" ON "settings" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "accounts_tenant_isolation" ON "accounts" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "known_devices_tenant_isolation" ON "known_devices" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "sessions_tenant_isolation" ON "sessions" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "two_factors_tenant_isolation" ON "two_factors" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "users_tenant_isolation" ON "users" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "verifications_tenant_isolation" ON "verifications" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "dispatches_tenant_isolation" ON "dispatches" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "expense_categories_tenant_isolation" ON "expense_categories" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "general_expenses_tenant_isolation" ON "general_expenses" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "material_sizes_tenant_isolation" ON "material_sizes" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "materials_tenant_isolation" ON "materials" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "orders_tenant_isolation" ON "orders" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "payments_tenant_isolation" ON "payments" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "stock_movements_tenant_isolation" ON "stock_movements" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "terak_costs_tenant_isolation" ON "terak_costs" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "terak_materials_tenant_isolation" ON "terak_materials" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "teraks_tenant_isolation" ON "teraks" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "trucks_tenant_isolation" ON "trucks" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "wage_accruals_tenant_isolation" ON "wage_accruals" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "work_entries_tenant_isolation" ON "work_entries" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "work_groups_tenant_isolation" ON "work_groups" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "work_types_tenant_isolation" ON "work_types" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "worker_material_prices_tenant_isolation" ON "worker_material_prices" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "workers_tenant_isolation" ON "workers" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
    WHERE n.nspname = current_schema() AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events jadvalini o''zgartirish yoki o''chirish taqiqlangan';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();--> statement-breakpoint
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_immutable();--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ventura_app') THEN
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO ventura_app', current_schema());
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO ventura_app', current_schema());
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO ventura_app', current_schema());
  END IF;
END $$;
