import { defineConfig } from "vitest/config";

// Opt-in synthetic classroom-burst suite (Pre-Pilot S3) — `npm run test:burst`.
// Needs BURST_DATABASE_URL pointing at a REAL local Postgres server (never a
// hosted project); skipped otherwise. Deliberately separate from `npm test`
// and `npm run test:schema`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/burst/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 180000,
  },
});
