import { defineConfig, devices } from "@playwright/test";

export const APP_PORT = 3003;
export const APP_URL = `http://localhost:${APP_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  use: {
    baseURL: APP_URL,
    locale: "uz-UZ",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
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
    url: `${APP_URL}/login`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
