import { defineConfig } from "drizzle-kit";

/**
 * Panel bazasi migratsiyalari (SPEC 9-bo'lim). Tenant (shablon) bazalari migratsiyasi
 * alohida — panel fon vazifasi orqali har mijoz bazasida ishga tushiriladi (SPEC 4-bo'lim).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/panel/index.ts",
  out: "./migrations/panel",
  dbCredentials: { url: process.env.PANEL_DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
