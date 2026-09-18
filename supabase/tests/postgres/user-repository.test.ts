/**
 * Real-Postgres (PGlite) integration tests for `PostgresUserRepository` —
 * proves the SQL against the actual migrated schema
 * (`supabase/migrations/20260920000000_user_timezone_v1.sql`).
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

import { parseIanaTimezone } from "../../../src/domain/user/timezone";
import { PostgresUserRepository } from "../../../src/infrastructure/postgres/user-repository";
import { createTestDb, insertUser } from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

describe("PostgresUserRepository", () => {
  it("findTimezone returns null timezone for a newly-created user (nullable/uninitialized)", async () => {
    const userId = await insertUser(db);
    const repo = new PostgresUserRepository(db);

    const record = await repo.findTimezone(userId);

    expect(record).toEqual({ userId, timezone: null });
  });

  it("findTimezone returns null for a nonexistent user", async () => {
    const repo = new PostgresUserRepository(db);
    expect(await repo.findTimezone(randomUUID())).toBeNull();
  });

  it("setTimezone persists and round-trips through findTimezone", async () => {
    const userId = await insertUser(db);
    const repo = new PostgresUserRepository(db);

    const updated = await repo.setTimezone(userId, parseIanaTimezone("Asia/Jerusalem"));
    expect(updated).toEqual({ userId, timezone: "Asia/Jerusalem" });

    const read = await repo.findTimezone(userId);
    expect(read).toEqual({ userId, timezone: "Asia/Jerusalem" });
  });

  it("setTimezone returns null for a nonexistent user", async () => {
    const repo = new PostgresUserRepository(db);
    const result = await repo.setTimezone(randomUUID(), parseIanaTimezone("UTC"));
    expect(result).toBeNull();
  });
});
