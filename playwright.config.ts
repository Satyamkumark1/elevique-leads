import { defineConfig, devices } from "@playwright/test";

const STORAGE = "tests/e2e/.auth/team.json";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // tests share one seeded DB
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 }, // dev server compiles routes on first visit
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "login", testMatch: /auth\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "setup", testMatch: /auth\.setup\.ts/, dependencies: ["login"] },
    {
      name: "dashboard",
      testMatch: /dashboard\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: STORAGE },
    },
  ],
  webServer: {
    command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
