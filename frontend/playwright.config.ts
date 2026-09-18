import { defineConfig, devices } from "@playwright/test";

// Every test builds its own data through the public API (e2e/support/api.ts); there is no global fixture,
// so any spec can run alone and in any order.
// E2E runs against the fully integrated app (Spring Boot serving the built SPA + real
// PostgreSQL) - in CI via the same docker compose stack the container smoke test uses;
// locally point E2E_BASE_URL at any running instance (see docs/frontend/REACT_MIGRATION.md).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    // Local convenience only: E2E_CHANNEL=chrome (or msedge) uses an installed browser instead of
    // Playwright's downloaded Chromium. CI leaves it unset and uses the bundled Chromium.
    channel: process.env.E2E_CHANNEL,
    // The backend pins its JVM to Asia/Ho_Chi_Minh and sends offset-less LocalDateTime strings, so the
    // browser deliberately runs in a very different zone to prove nothing depends on matching clocks.
    timezoneId: process.env.E2E_TIMEZONE ?? "America/Los_Angeles",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile-360",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
