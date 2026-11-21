import { defineConfig } from "drizzle-kit";

/**
 * PC-CRM shabloni mijoz bazalari migratsiyalari.
 * Dedicated (Silo) model.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/pc-crm/index.ts",
  out: "./migrations/pc-crm",
  dbCredentials: { url: process.env.PC_CRM_MIGRATE_URL ?? process.env.TENANT_MIGRATE_URL ?? "" },
  strict: true,
  verbose: true,
});
