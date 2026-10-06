/**
 * Proves the reusable statement counter over real PGlite: counts are exact,
 * transaction control is separated, a rolled-back transaction still counts,
 * and neither SQL text nor parameters are retained anywhere on the counter.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";
import { createTestDb, insertUser, pgliteConnectionProvider } from "./db-harness";
import { classifyStatement, createStatementCounter } from "./statement-counter";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});

describe("classifyStatement", () => {
  it.each([
    ["select 1", "select"],
    ["  SELECT * from t", "select"],
    ["with x as (select 1) select * from x", "select"],
    ["insert into t values ($1)", "insert"],
    ["update t set a = 1", "update"],
    ["delete from t", "delete"],
    ["BEGIN", "begin"],
    ["commit", "commit"],
    ["rollback", "rollback"],
    ["select pg_advisory_xact_lock($1)", "select"],
    ["savepoint x", "other"],
  ])("%s -> %s", (text, verb) => {
    expect(classifyStatement(text)).toBe(verb);
  });
});

describe("createStatementCounter over PGlite", () => {
  it("counts plain executor statements by verb and resets", async () => {
    const counter = createStatementCounter();
    const exec = counter.wrapExecutor(db as unknown as SqlExecutor);
    const userId = await insertUser(exec);
    await exec.query("select id from users where id = $1", [userId]);
    await exec.query("select id from users where id = $1", [userId]);
    expect(counter.total).toBe(3);
    expect(counter.nonTx).toBe(3);
    expect(counter.byVerb).toMatchObject({ insert: 1, select: 2, begin: 0 });
    counter.reset();
    expect(counter.total).toBe(0);
  });

  it("counts a committed transaction through the provider, BEGIN/COMMIT separated", async () => {
    const counter = createStatementCounter();
    const uow = new PostgresUnitOfWork(counter.wrapProvider(pgliteConnectionProvider(db)));
    await uow.runInTransaction(async (tx) => {
      expect(tx).toBeDefined();
    });
    expect(counter.checkouts).toBe(1);
    expect(counter.byVerb.begin).toBe(1);
    expect(counter.byVerb.commit).toBe(1);
    expect(counter.nonTx).toBe(0);
  });

  it("counts BEGIN then ROLLBACK when the transaction body throws", async () => {
    const counter = createStatementCounter();
    const uow = new PostgresUnitOfWork(counter.wrapProvider(pgliteConnectionProvider(db)));
    await expect(
      uow.runInTransaction(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(counter.byVerb).toMatchObject({ begin: 1, rollback: 1, commit: 0 });
  });

  it("retains no SQL text or parameters (counts and verbs only)", async () => {
    const counter = createStatementCounter();
    const exec = counter.wrapExecutor(db as unknown as SqlExecutor);
    const secret = "learner-secret-answer@example.com";
    await exec.query("select $1::text as v /* tableXYZ */", [secret]);
    const dump = JSON.stringify({ ...counter, byVerb: counter.byVerb });
    expect(dump).not.toContain(secret);
    expect(dump).not.toContain("tableXYZ");
    expect(Object.keys(counter.byVerb).sort()).toEqual(
      ["begin", "commit", "delete", "insert", "other", "rollback", "select", "update"],
    );
  });
});
