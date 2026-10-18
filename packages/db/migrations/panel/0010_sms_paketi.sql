CREATE TABLE "sms_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parts" integer NOT NULL,
	"price" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_packages_parts" CHECK ("sms_packages"."parts" between 1 and 10000000),
	CONSTRAINT "sms_packages_price" CHECK ("sms_packages"."price" >= 0),
	CONSTRAINT "sms_packages_name_len" CHECK (length("sms_packages"."name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "sms_purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"package_id" uuid,
	"package_name" text NOT NULL,
	"parts" integer NOT NULL,
	"price" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" uuid
);
--> statement-breakpoint
CREATE TABLE "sms_relay_messages" (
	"provider_id" text PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"parts" integer NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sms_wallet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"delta" integer NOT NULL,
	"ref" text,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_wallet_entries_delta_nonzero" CHECK ("sms_wallet_entries"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "sms_wallets" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_wallets_balance_nonneg" CHECK ("sms_wallets"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sms_purchase_requests" ADD CONSTRAINT "sms_purchase_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_purchase_requests" ADD CONSTRAINT "sms_purchase_requests_package_id_sms_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."sms_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_purchase_requests" ADD CONSTRAINT "sms_purchase_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_relay_messages" ADD CONSTRAINT "sms_relay_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_wallet_entries" ADD CONSTRAINT "sms_wallet_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_wallet_entries" ADD CONSTRAINT "sms_wallet_entries_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_wallets" ADD CONSTRAINT "sms_wallets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_purchase_requests_status_idx" ON "sms_purchase_requests" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sms_purchase_requests_project_idx" ON "sms_purchase_requests" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sms_relay_messages_project_idx" ON "sms_relay_messages" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sms_wallet_entries_project_idx" ON "sms_wallet_entries" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sms_wallet_entries_ref_idx" ON "sms_wallet_entries" USING btree ("ref");--> statement-breakpoint
-- SMS hisobi harakatlari o'chirilmaydi va o'zgartirilmaydi (ilova roli uchun) — qoldiq faqat yangi yozuv bilan o'zgaradi
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ventura_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON sms_wallet_entries FROM ventura_app;
  END IF;
END $$;