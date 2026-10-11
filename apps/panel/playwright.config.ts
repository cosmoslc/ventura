import { defineConfig, devices } from "@playwright/test";
import { APP_PORT, APP_URL, TELEGRAM_PORT, TELEGRAM_URL, appEnv } from "./e2e/env";

/*
 * Asosiy oqimlar (CLAUDE.md): kirish + 2FA va "Yangi loyiha" ustozi.
 * Panel production build'da ishga tushadi (avval `pnpm build`), Telegram o'rnida soxta server.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Bitta test foydalanuvchisi va umumiy baza — testlar ketma-ket
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
      command: "node e2e/telegram-mock.mjs",
      url: `${TELEGRAM_URL}/health`,
      env: { TELEGRAM_PORT: String(TELEGRAM_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec next start --port ${APP_PORT}`,
      url: `${APP_URL}/login`,
      env: appEnv(),
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
