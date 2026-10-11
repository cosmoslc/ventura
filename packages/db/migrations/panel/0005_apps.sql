CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"port" integer NOT NULL,
	"commit_sha" text,
	"release_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "server_id" uuid;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apps_server_name_uq" ON "apps" USING btree ("server_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "apps_server_port_uq" ON "apps" USING btree ("server_id","port");