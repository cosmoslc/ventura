import { defineConfig } from "drizzle-kit";

/**
 * Sawmill shabloni mijoz bazalari migratsiyalari.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/sawmill/index.ts",
  out: "./migrations/sawmill",
  dbCredentials: { url: process.env.SAWMILL_MIGRATE_URL ?? process.env.TENANT_MIGRATE_URL ?? "" },
  strict: true,
  verbose: true,
});
