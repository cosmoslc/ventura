import { defineConfig } from "drizzle-kit";

/**
 * Shablon (mijoz) bazalari migratsiyalari. Bitta sxema uchala baza strategiyasida (SPEC 4-bo'lim);
 * panel fon vazifasi ularni har mijoz bazasida ketma-ket ishga tushiradi. Qo'lda: TENANT_MIGRATE_URL.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/tenant/index.ts",
  out: "./migrations/tenant",
  dbCredentials: { url: process.env.TENANT_MIGRATE_URL ?? "" },
  strict: true,
  verbose: true,
});
