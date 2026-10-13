/**
 * Shablon (mijoz) bazalari sxemasi. Har jadvalda tenant_id va RLS bo'ladi (SPEC 9-bo'lim) — baza strategiyasi
 * (shared_db / db_per_tenant / dedicated_server) qaysi bo'lishidan qat'i nazar sxema bir xil.
 * O'zgarish faqat drizzle-kit migratsiyasi orqali: `pnpm db:generate:tenant`.
 */
export * from "./auth";
export * from "./columns";
export * from "./core";
export * from "./academic";
export * from "./staff";
export * from "./students";
export * from "./groups";
export * from "./attendance";
export * from "./finance";
export * from "./expenses";
export * from "./payroll";
