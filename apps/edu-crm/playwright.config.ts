import { defineConfig, devices } from "@playwright/test";
import { APP_PORT, APP_URL, TELEGRAM_PORT, TELEGRAM_URL, appEnv } from "./e2e/env";

/*
 * edu-crm asosiy oqimi (ADR 0029): lid yaratilishidan o'quvchiga aylanishigacha.
 * Ilova production build'da ishga tushadi (avval `pnpm --filter @ventura/edu-crm build`), Telegram o'rnida soxta
 * server (panel testlari bilan umumiy). Sinov markazi va uning ma'lumoti global-setup'da tayyorlanadi.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  use: {
    baseURL: APP_URL,
    locale: "uz-UZ",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL } }],
  webServer: [
    {
      command: "node ../../tooling/e2e/telegram-mock.mjs",
      url: `${TELEGRAM_URL}/health`,
      env: { TELEGRAM_PORT: String(TELEGRAM_PORT) },
      reuseExistingServer: false,
    },
    {
      // /health mijoz ro'yxati hali yozilmagan bo'lsa ham 200 qaytaradi
      command: `pnpm exec next start --port ${APP_PORT}`,
      url: `${APP_URL}/health`,
      env: appEnv(),
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
