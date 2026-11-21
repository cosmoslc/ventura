import { defineConfig, devices } from "@playwright/test";

export const APP_PORT = 3004;
export const APP_URL = `http://localhost:${APP_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  use: {
    baseURL: APP_URL,
    locale: "uz-UZ",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      "x-playwright-test": "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${APP_PORT}`,
    url: `${APP_URL}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
