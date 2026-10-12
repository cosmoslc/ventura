CREATE TABLE "server_metrics" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"server_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"cpu_percent" real NOT NULL,
	"mem_used_mb" integer NOT NULL,
	"mem_total_mb" integer NOT NULL,
	"disk_used_gb" real NOT NULL,
	"disk_total_gb" real NOT NULL,
	"load1" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "metrics" jsonb;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "metrics_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "probe_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "probe_error" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "alerts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "last_action" jsonb;--> statement-breakpoint
ALTER TABLE "server_metrics" ADD CONSTRAINT "server_metrics_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "server_metrics_server_at_idx" ON "server_metrics" USING btree ("server_id","at");