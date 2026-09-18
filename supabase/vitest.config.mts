import { defineConfig } from "vitest/config";

// Separate config, separate command (`npm run test:schema`) — deliberately
// NOT merged into the root vitest.config.mts / `npm test`. This suite spins
// up a real (WASM) PostgreSQL engine per test and verifies actual database
// constraint behavior; it is materially heavier than the domain/application
// unit suite and belongs to database-foundation verification, not the
// fast unit-test loop. Now covers both pure schema verification
// (`supabase/tests/schema.integration.test.ts`) and the Postgres
// infrastructure adapters built on top of it
// (`supabase/tests/postgres/*.test.ts`) — same category (real Postgres
// engine, heavier than a unit test), same command.
//
// `fileParallelism: false` + a generous `hookTimeout` are load-bearing, not
// arbitrary: each test file spins up its OWN in-process WASM PostgreSQL
// engine per test in `beforeEach`. Vitest's default file parallelism runs
// multiple test files in separate worker threads concurrently, which under
// this suite's real (not mocked) per-test PGlite instantiation caused
// genuine resource contention — CPU/WASM-init contention across
// simultaneously-starting engines, not a code defect — that intermittently
// blew past the default 10s `beforeEach` hook timeout once enough
// `postgres/*.test.ts` files existed to run side-by-side. Every failure
// observed was exactly this timeout shape, and every test passed
// individually. Running files sequentially trades some wall-clock time for
// determinism, which is the right trade for a suite already excluded from
// the fast loop.
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
