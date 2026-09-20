import { defineConfig, devices } from "@playwright/test";

/**
 * Browser Golden-Path E2E V1 (Run 004 Slice 7). See `e2e/README.md` for the
 * exact constraint this harness operates under before running any of it:
 * no local Supabase/Docker stack exists in this repo's development
 * environment, and the only configured Supabase project is the real hosted
 * Ruppin pilot project — this harness never creates hosted users/courses on
 * its own, and each spec explicitly documents what it does and does not
 * require against that project.
 *
 * `reuseExistingServer: true` outside CI so a developer's own `npm run dev`
 * (already pointed at whichever `.env.local` they've configured) is reused
 * rather than a second server being spawned.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
