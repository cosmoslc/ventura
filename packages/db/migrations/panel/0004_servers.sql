CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'online' NOT NULL,
	"host" text NOT NULL,
	"ssh_port" integer DEFAULT 22 NOT NULL,
	"ssh_user" text DEFAULT 'deploy' NOT NULL,
	"public_key" text NOT NULL,
	"host_key" text,
	"deploy_root" text DEFAULT '/home/deploy/apps' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "servers_name_uq" ON "servers" USING btree ("name");