import { resolve } from "node:path";

/*
 * edu-crm E2E muhiti (ADR 0029): alohida markaz bazasi, vaqtinchalik mijoz ro'yxati va maxfiy sozlamalar fayli,
 * soxta Telegram serveri. Haqiqiy .env dagi bazaga va .secrets ga hech qachon ulanmaydi — E2E_EDU_DATABASE_URL
 * berilmasa testlar boshlanmaydi.
 */

export const APP_PORT = 3101;
export const TELEGRAM_PORT = 3198;
export const APP_URL = `http://localhost:${APP_PORT}`;
export const TELEGRAM_URL = `http://localhost:${TELEGRAM_PORT}`;

export const TMP_DIR = resolve(import.meta.dirname, ".tmp");
export const TENANT_SLUG = "e2e";

/** Faqat test bazasida yashaydigan direktor (tooling/scripts/src/edu-e2e-seed.ts yaratadi). */
export const TEST_USER = {
  phone: "900000011",
  name: "E2E Direktor",
  password: "e2e-edu-parol-2026",
  chatId: "434343",
} as const;

/** Seed yaratadigan guruh — lid shu guruhga o'quvchi bo'lib qo'shiladi */
export const TEST_GROUP = "E2E guruh";

export function databaseUrls() {
  const app = process.env.E2E_EDU_DATABASE_URL;
  if (!app) {
    throw new Error(
      "E2E_EDU_DATABASE_URL berilmagan. Testlar faqat alohida test bazasida ishlaydi (apps/edu-crm/e2e/README.md).",
    );
  }
  return { app, migrate: process.env.E2E_EDU_MIGRATE_URL || app };
}

/** Ilova va CLI skriptlari uchun muhit: .env dagi qiymatlar ustidan yoziladi (muhit fayldan ustun). */
export function appEnv(): Record<string, string> {
  const { app } = databaseUrls();
  return {
    E2E_EDU_DATABASE_URL: app,
    VENTURA_TENANTS_FILE: resolve(TMP_DIR, "tenants.json"),
    VENTURA_TENANT_SECRETS_FILE: resolve(TMP_DIR, "tenant-secrets.json"),
    TELEGRAM_API_URL: TELEGRAM_URL,
    E2E_USER_PHONE: TEST_USER.phone,
    E2E_USER_NAME: TEST_USER.name,
    E2E_USER_PASSWORD: TEST_USER.password,
    E2E_USER_CHAT_ID: TEST_USER.chatId,
  };
}
