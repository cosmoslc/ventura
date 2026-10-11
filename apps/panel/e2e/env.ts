import { resolve } from "node:path";

/*
 * E2E muhit: alohida test bazasi, soxta Telegram serveri, vaqtinchalik shifrlash kaliti.
 * Haqiqiy .env dagi bazaga hech qachon ulanmaydi — E2E_DATABASE_URL berilmasa testlar boshlanmaydi.
 */

export const APP_PORT = 3100;
export const TELEGRAM_PORT = 3199;
export const APP_URL = `http://localhost:${APP_PORT}`;
export const TELEGRAM_URL = `http://localhost:${TELEGRAM_PORT}`;

export const TMP_DIR = resolve(import.meta.dirname, ".tmp");
export const MASTER_KEY_FILE = resolve(TMP_DIR, "master.key");

/** Faqat test bazasida yashaydigan foydalanuvchi (tooling/scripts/src/e2e-seed.ts yaratadi). */
export const TEST_USER = {
  phone: "900000001",
  name: "E2E Admin",
  password: "e2e-parol-2026",
  chatId: "424242",
} as const;

export function databaseUrls() {
  const app = process.env.E2E_DATABASE_URL;
  if (!app) {
    throw new Error(
      "E2E_DATABASE_URL berilmagan. Testlar faqat alohida test bazasida ishlaydi (apps/panel/e2e/README.md).",
    );
  }
  return { app, migrate: process.env.E2E_MIGRATE_URL || app };
}

/** Panel va CLI skriptlari uchun muhit: .env dagi qiymatlar ustidan yoziladi. */
export function appEnv(): Record<string, string> {
  const { app, migrate } = databaseUrls();
  return {
    PANEL_DATABASE_URL: app,
    PANEL_MIGRATE_URL: migrate,
    BETTER_AUTH_SECRET: "e2e-faqat-test-uchun-maxfiy-satr-0123456789",
    BETTER_AUTH_URL: APP_URL,
    VENTURA_MASTER_KEY_FILE: MASTER_KEY_FILE,
    TELEGRAM_BOT_TOKEN: "e2e-token",
    TELEGRAM_API_URL: TELEGRAM_URL,
    E2E_USER_PHONE: TEST_USER.phone,
    E2E_USER_NAME: TEST_USER.name,
    E2E_USER_PASSWORD: TEST_USER.password,
    E2E_USER_CHAT_ID: TEST_USER.chatId,
  };
}
