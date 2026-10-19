ALTER TABLE "users" ADD COLUMN "kind" text DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_uq" UNIQUE("tenant_id","user_id");