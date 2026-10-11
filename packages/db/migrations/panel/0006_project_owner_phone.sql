ALTER TABLE "projects" ALTER COLUMN "owner_login" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_phone" text;