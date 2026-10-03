import { defineConfig } from "vitest/config";

// Opt-in real-PostgreSQL concurrency suite (PILOT-HARDENING-EVIDENCE-001 Slice C,
// FUB-042 item 7) - `npm run test:real-pg`. Needs UNLOCK_REAL_PG_URL pointing at a
// LOCAL disposable Postgres server (localhost/127.0.0.1/::1 only; any other host
// is refused); skipped otherwise. Deliberately separate from `npm test` and
// `npm run test:schema`. See docs/REAL_POSTGRES_VERIFICATION_PLAN.md.
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/real-pg/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 120000,
  },
});
