import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // tests share one seeded DB
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 }, // dev server compiles routes on first visit
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "dashboard", testMatch: /dashboard\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
