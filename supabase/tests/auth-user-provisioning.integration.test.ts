/**
 * Integration test for the `auth.users -> public.users` provisioning
 * trigger (`supabase/migrations/20260923000000_auth_user_provisioning.sql`).
 *
 * IMPORTANT — what this test does and does NOT prove:
 *
 * PGlite (the in-process WASM Postgres engine every other test in this
 * repo runs against) starts completely bare — verified directly, before
 * writing this file: a fresh PGlite instance has ZERO rows in
 * `pg_namespace` for `nspname = 'auth'`, i.e. no `auth` schema, no
 * `auth.users` table, nothing Supabase-specific at all. Supabase's real
 * `auth` schema (GoTrue's own tables, columns, extensions, RLS, etc.) is
 * provisioned by Supabase's own infrastructure when a real project is
 * created or `supabase start` runs — it is NOT part of anything in
 * `supabase/migrations/` (which only ever describes OUR OWN schema,
 * applied on top of whatever Auth setup already exists) and cannot be
 * faithfully reproduced here. `supabase/tests/postgres/db-harness.ts`'s
 * `createTestDb()` therefore creates a MINIMAL stand-in `auth.users`
 * table (one column, `id uuid primary key` — the only thing this
 * migration's trigger reads) before applying the real migration chain,
 * purely so that chain (including this migration) can apply at all in
 * this harness — see that file's own comment on `createTestDb()`.
 *
 * This test therefore does NOT prove the trigger works against Supabase's
 * real `auth.users` table — that requires a real Supabase project (local
 * via the CLI/Docker, or hosted) and remains out of scope, consistent
 * with `supabase/README.md`'s own "What was NOT verified" section, which
 * already lists this exact limitation for Auth generally.
 *
 * What it DOES genuinely prove, against a real Postgres engine: the
 * ACTUAL committed migration file's SQL (applied via the same
 * filename-order migration chain every other integration test uses, not
 * a paraphrase) is syntactically valid Postgres, and the trigger
 * function's own logic is behaviorally correct — inserting into the
 * stand-in `auth.users` really does provision a matching `public.users`
 * row, and the `on conflict (id) do nothing` clause really does prevent a
 * duplicate-key error.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestDb } from "./postgres/db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

describe("auth.users -> public.users provisioning trigger", () => {
  it("provisions a matching public.users row when a new auth.users row is inserted", async () => {
    const id = randomUUID();

    await db.query("insert into auth.users (id) values ($1)", [id]);

    const result = await db.query<{ id: string }>(
      "select id from public.users where id = $1",
      [id],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(id);
  });

  it("is idempotent: does not error when a matching public.users row already exists for that id", async () => {
    const id = randomUUID();
    // Simulates the ON CONFLICT branch actually being reachable — a
    // public.users row already exists for this id before auth.users
    // ever receives it.
    await db.query("insert into public.users (id) values ($1)", [id]);

    await expect(
      db.query("insert into auth.users (id) values ($1)", [id]),
    ).resolves.toBeDefined();

    const result = await db.query<{ id: string }>(
      "select id from public.users where id = $1",
      [id],
    );
    expect(result.rows).toHaveLength(1);
  });

  it("does not create any other public.users row as a side effect", async () => {
    const before = await db.query<{ count: string }>(
      "select count(*)::int as count from public.users",
    );
    expect(Number(before.rows[0].count)).toBe(0);

    await db.query("insert into auth.users (id) values ($1)", [randomUUID()]);

    const after = await db.query<{ count: string }>(
      "select count(*)::int as count from public.users",
    );
    expect(Number(after.rows[0].count)).toBe(1);
  });
});
