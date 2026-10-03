/**
 * PILOT-HARDENING-EVIDENCE-001 Slice C - FUB-042 item 7 (c): REAL PostgreSQL,
 * TWO real connections (not PGlite) driving the REAL `revokeCourseAuthor` use
 * case + REAL `PostgresCourseUnitOfWork` / `PostgresCourseAuthorRepository`.
 *
 * Opt-in: skipped unless `UNLOCK_REAL_PG_URL` is set; refuses any non-local
 * host (never point this at a hosted project). Creates and drops its own
 * throwaway database. Run: `npm run test:real-pg` (see
 * docs/RUNS/2026-10-04-PILOT-HARDENING-EVIDENCE-001-C-revoke-concurrency.md).
 *
 * Interleavings are forced deterministically by decorating the connection
 * handed to the use case (`HookedProvider`): a hook can pause a transaction
 * before/after a classified statement (actor-auth read, FOR UPDATE lock,
 * revoke UPDATE, COMMIT). Randomised-jitter loops complement them.
 *
 * Limits: one local PostgreSQL 17 server; says nothing about hosted
 * Supabase/Supavisor behaviour. Not wired to any route.
 */
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  revokeCourseAuthor,
  type RevokeCourseAuthorResult,
} from "../../../src/application/course/revoke-course-author";
import type { CourseAuthorCapability } from "../../../src/application/course/ports";
import type { ConnectionProvider } from "../../../src/infrastructure/postgres/connection-provider";
import { PgConnectionProvider } from "../../../src/infrastructure/postgres/pg-connection-provider";
import { PostgresCourseUnitOfWork } from "../../../src/infrastructure/postgres/postgres-course-unit-of-work";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";

const BASE_URL = process.env.UNLOCK_REAL_PG_URL;

// Hosted-isolation guard: refuse anything that is not a local server.
if (BASE_URL && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE_URL).hostname)) {
  throw new Error("UNLOCK_REAL_PG_URL must point at a local Postgres (localhost/127.0.0.1/::1).");
}

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(here, "../../migrations");

type Kind = "begin" | "commit" | "rollback" | "actorAuth" | "lock" | "revoke" | "other";
interface Hooks {
  before?: (kind: Kind) => Promise<void> | void;
  after?: (kind: Kind) => Promise<void> | void;
}

function classify(sql: string): Kind {
  const s = sql.replace(/\s+/g, " ").trim().toLowerCase();
  if (s === "begin") return "begin";
  if (s === "commit") return "commit";
  if (s === "rollback") return "rollback";
  if (s.startsWith("update course_authors")) return "revoke";
  if (s.startsWith("select * from course_authors") && s.includes("for update")) return "lock";
  if (s.startsWith("select * from course_authors")) return "actorAuth";
  return "other";
}

/** Real pg connection, with test hooks around each statement. */
class HookedProvider implements ConnectionProvider {
  private readonly inner: PgConnectionProvider;
  constructor(pool: pg.Pool, private readonly hooks: Hooks) {
    this.inner = new PgConnectionProvider(pool);
  }
  withConnection<T>(fn: (db: SqlExecutor) => Promise<T>): Promise<T> {
    return this.inner.withConnection((db) =>
      fn({
        query: async <Row extends Record<string, unknown> = Record<string, unknown>>(
          text: string,
          params?: readonly unknown[],
        ) => {
          const kind = classify(text);
          await this.hooks.before?.(kind);
          const result = await db.query<Row>(text, params);
          await this.hooks.after?.(kind);
          return result;
        },
      }),
    );
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const jitter = (): Hooks => ({
  before: async () => {
    if (Math.random() < 0.5) await sleep(Math.random() * 4);
  },
  after: async () => {
    if (Math.random() < 0.5) await sleep(Math.random() * 4);
  },
});

const suite = BASE_URL ? describe : describe.skip;

suite("revokeCourseAuthor on REAL PostgreSQL, two connections (FUB-042 item 7)", () => {
  const dbName = `unlock_conc_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  let url: string;
  let admin: pg.Pool; // assertions + pg_stat_activity (own connection)
  let poolA: pg.Pool; // connection #1 (max 1)
  let poolB: pg.Pool; // connection #2 (max 1)
  let poolC: pg.Pool; // connection #3 (3rd actor in multi-actor races)

  const uowFor = (pool: pg.Pool, hooks: Hooks = {}) =>
    new PostgresCourseUnitOfWork(new HookedProvider(pool, hooks));

  beforeAll(async () => {
    const root = new pg.Client({ connectionString: BASE_URL });
    await root.connect();
    await root.query(`create database ${dbName}`);
    await root.end();
    const u = new URL(BASE_URL!);
    u.pathname = `/${dbName}`;
    url = u.toString();
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("create schema if not exists auth");
      await client.query("create table if not exists auth.users (id uuid primary key)");
      for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
        await client.query(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      }
    } finally {
      await client.end();
    }
    admin = new pg.Pool({ connectionString: url, max: 2 });
    poolA = new pg.Pool({ connectionString: url, max: 1 });
    poolB = new pg.Pool({ connectionString: url, max: 1 });
    poolC = new pg.Pool({ connectionString: url, max: 1 });
  });

  afterAll(async () => {
    await Promise.all([admin?.end(), poolA?.end(), poolB?.end(), poolC?.end()]);
    const root = new pg.Client({ connectionString: BASE_URL });
    await root.connect();
    await root.query(`drop database if exists ${dbName} with (force)`);
    await root.end();
  });

  /** A fresh Course with `n` active INSTRUCTOR authors (index 0 = OWNER). */
  async function seed(n: number) {
    const ownerRow = randomUUID();
    const users: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const id = i === 0 ? ownerRow : randomUUID();
      await admin.query("insert into users (id, timezone) values ($1, 'UTC')", [id]);
      users.push(id);
    }
    const courseId = randomUUID();
    await admin.query(
      `insert into courses (id, owner_user_id, title, status, join_policy)
       values ($1, $2, 'Conc Course', 'PUBLISHED', 'OPEN')`,
      [courseId, users[0]],
    );
    for (let i = 0; i < n; i += 1) {
      await admin.query(
        "insert into course_authors (user_id, course_id, capability) values ($1, $2, $3)",
        [users[i], courseId, i === 0 ? "OWNER" : "INSTRUCTOR"],
      );
    }
    const cap = (i: number): CourseAuthorCapability => (i === 0 ? "OWNER" : "INSTRUCTOR");
    return { users, courseId, cap };
  }

  async function activeCount(courseId: string): Promise<number> {
    const r = await admin.query(
      "select count(*)::int as n from course_authors where course_id = $1 and revoked_at is null",
      [courseId],
    );
    return r.rows[0].n as number;
  }
  async function activeUsers(courseId: string): Promise<string[]> {
    const r = await admin.query(
      "select user_id from course_authors where course_id = $1 and revoked_at is null",
      [courseId],
    );
    return r.rows.map((row) => row.user_id as string);
  }

  async function waitUntilBlockedOnLock(minBlocked = 1) {
    for (let i = 0; i < 200; i += 1) {
      const r = await admin.query(
        `select count(*)::int as n from pg_stat_activity
          where datname = $1 and wait_event_type = 'Lock' and query ilike '%for update%'`,
        [dbName],
      );
      if ((r.rows[0].n as number) >= minBlocked) return;
      await sleep(25);
    }
    throw new Error("expected a backend to be blocked on a row lock, none was");
  }

  // ---------------------------------------------------------------- N1
  describe("N1 - concurrent revokes cannot leave zero active authors", () => {
    it("NEGATIVE CONTROL: a naive count-then-revoke (no FOR UPDATE) DOES reach zero under forced interleaving, so this harness can detect the defect", async () => {
      const { users, courseId } = await seed(2);
      const bothRead = [deferred(), deferred()];
      const naive = async (pool: pg.Pool, idx: 0 | 1, target: string) => {
        const c = await pool.connect();
        try {
          await c.query("begin");
          const n = (
            await c.query(
              "select count(*)::int as n from course_authors where course_id = $1 and revoked_at is null",
              [courseId],
            )
          ).rows[0].n as number;
          bothRead[idx].resolve();
          await Promise.all(bothRead.map((d) => d.promise)); // both saw n = 2
          if (n > 1) {
            await c.query(
              "update course_authors set revoked_at = now() where user_id = $1 and course_id = $2",
              [target, courseId],
            );
          }
          await c.query("commit");
        } finally {
          c.release();
        }
      };
      await Promise.all([naive(poolA, 0, users[1]), naive(poolB, 1, users[0])]);
      expect(await activeCount(courseId)).toBe(0); // the defect the real code must prevent
    });

    it("forced: B BLOCKS on A's FOR UPDATE lock; after A commits B gets LAST_AUTHOR; exactly one author stays active", async () => {
      const { users, courseId, cap } = await seed(2);
      const aHoldsLock = deferred();
      const releaseA = deferred();
      const a = revokeCourseAuthor(
        { actorUserId: users[0], courseId, targetUserId: users[1], capability: cap(1) },
        uowFor(poolA, {
          after: async (k) => {
            if (k === "lock") {
              aHoldsLock.resolve();
              await releaseA.promise; // hold the row locks, uncommitted
            }
          },
        }),
      );
      await aHoldsLock.promise;
      let bDone = false;
      const b = revokeCourseAuthor(
        { actorUserId: users[1], courseId, targetUserId: users[0], capability: cap(0) },
        uowFor(poolB),
      ).finally(() => (bDone = true));
      await waitUntilBlockedOnLock(); // proves real lock blocking on a 2nd backend
      expect(bDone).toBe(false);
      releaseA.resolve();
      const [ra, rb] = await Promise.all([a, b]);
      expect(ra.outcome).toBe("REVOKED");
      // B actor-auth read (pre-lock) saw B active (A uncommitted); under the lock B re-reads
      // committed state: only A (the revoke target of A was B) is left -> LAST_AUTHOR.
      expect(rb.outcome).toBe("LAST_AUTHOR");
      expect(await activeUsers(courseId)).toEqual([users[0]]);
    });

    it("randomised jitter x 60: two actors revoke each other (2 authors) - never zero active; one REVOKED and one LAST_AUTHOR/NOT_AUTHORIZED", async () => {
      const seen = new Map<string, number>();
      for (let i = 0; i < 60; i += 1) {
        const { users, courseId, cap } = await seed(2);
        const [r1, r2] = await Promise.all([
          revokeCourseAuthor(
            { actorUserId: users[0], courseId, targetUserId: users[1], capability: cap(1) },
            uowFor(poolA, jitter()),
          ),
          revokeCourseAuthor(
            { actorUserId: users[1], courseId, targetUserId: users[0], capability: cap(0) },
            uowFor(poolB, jitter()),
          ),
        ]);
        expect(await activeCount(courseId)).toBe(1);
        const outs = [r1.outcome, r2.outcome].sort();
        expect(outs.filter((o) => o === "REVOKED")).toHaveLength(1);
        expect(outs.filter((o) => o !== "REVOKED")[0]).toMatch(/^(LAST_AUTHOR|NOT_AUTHORIZED)$/);
        const key = outs.join("+");
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      console.info("N1 2-author mutual outcomes:", Object.fromEntries(seen));
    });

    it("randomised jitter x 40: self-revoke races (2 authors, both revoke themselves) - never zero", async () => {
      for (let i = 0; i < 40; i += 1) {
        const { users, courseId, cap } = await seed(2);
        await Promise.all([
          revokeCourseAuthor(
            { actorUserId: users[0], courseId, targetUserId: users[0], capability: cap(0) },
            uowFor(poolA, jitter()),
          ),
          revokeCourseAuthor(
            { actorUserId: users[1], courseId, targetUserId: users[1], capability: cap(1) },
            uowFor(poolB, jitter()),
          ),
        ]);
        expect(await activeCount(courseId)).toBe(1);
      }
    });

    it("randomised jitter x 40: three actors on three connections, ring revoke A->B, B->C, C->A (3 authors) - never zero", async () => {
      for (let i = 0; i < 40; i += 1) {
        const { users, courseId, cap } = await seed(3);
        const pools = [poolA, poolB, poolC];
        await Promise.all(
          [0, 1, 2].map((k) =>
            revokeCourseAuthor(
              {
                actorUserId: users[k],
                courseId,
                targetUserId: users[(k + 1) % 3],
                capability: cap((k + 1) % 3),
              },
              uowFor(pools[k], jitter()),
            ),
          ),
        );
        expect(await activeCount(courseId)).toBeGreaterThanOrEqual(1);
      }
    });

    it("randomised jitter x 30: opposing last-two races across different Courses on the same connections never interfere", async () => {
      for (let i = 0; i < 30; i += 1) {
        const c1 = await seed(2);
        const c2 = await seed(2);
        await Promise.all([
          revokeCourseAuthor(
            { actorUserId: c1.users[0], courseId: c1.courseId, targetUserId: c1.users[1], capability: c1.cap(1) },
            uowFor(poolA, jitter()),
          ),
          revokeCourseAuthor(
            { actorUserId: c1.users[1], courseId: c1.courseId, targetUserId: c1.users[0], capability: c1.cap(0) },
            uowFor(poolB, jitter()),
          ),
          revokeCourseAuthor(
            { actorUserId: c2.users[0], courseId: c2.courseId, targetUserId: c2.users[1], capability: c2.cap(1) },
            uowFor(poolC, jitter()),
          ),
        ]);
        expect(await activeCount(c1.courseId)).toBe(1);
        expect(await activeCount(c2.courseId)).toBe(1); // c2's single revoke is independent of c1's lock
      }
    });
  });

  // ---------------------------------------------------------------- N2
  describe("N2 - already-revoked author handling cannot corrupt active counts", () => {
    it("sequential: re-revoking an already-revoked author -> NOT_A_GRANT_HOLDER, count and revoked_at unchanged", async () => {
      const { users, courseId, cap } = await seed(3);
      const cmd = { actorUserId: users[0], courseId, targetUserId: users[1], capability: cap(1) };
      expect((await revokeCourseAuthor(cmd, uowFor(poolA))).outcome).toBe("REVOKED");
      const before = await admin.query(
        "select revoked_at from course_authors where user_id = $1 and course_id = $2",
        [users[1], courseId],
      );
      expect((await revokeCourseAuthor(cmd, uowFor(poolA))).outcome).toBe("NOT_A_GRANT_HOLDER");
      const after = await admin.query(
        "select revoked_at from course_authors where user_id = $1 and course_id = $2",
        [users[1], courseId],
      );
      expect(after.rows[0].revoked_at).toEqual(before.rows[0].revoked_at);
      expect(await activeCount(courseId)).toBe(2);
    });

    it("forced: two actors revoke the SAME target concurrently (3 authors): one REVOKED, the loser (blocked on the lock) sees NOT_A_GRANT_HOLDER; exactly 2 remain", async () => {
      const { users, courseId, cap } = await seed(3);
      const aHoldsLock = deferred();
      const releaseA = deferred();
      const a = revokeCourseAuthor(
        { actorUserId: users[0], courseId, targetUserId: users[2], capability: cap(2) },
        uowFor(poolA, {
          after: async (k) => {
            if (k === "lock") {
              aHoldsLock.resolve();
              await releaseA.promise;
            }
          },
        }),
      );
      await aHoldsLock.promise;
      const b = revokeCourseAuthor(
        { actorUserId: users[1], courseId, targetUserId: users[2], capability: cap(2) },
        uowFor(poolB),
      );
      await waitUntilBlockedOnLock();
      releaseA.resolve();
      const [ra, rb] = await Promise.all([a, b]);
      expect(ra.outcome).toBe("REVOKED");
      expect(rb.outcome).toBe("NOT_A_GRANT_HOLDER");
      expect(await activeCount(courseId)).toBe(2);
    });

    it("randomised jitter x 50: concurrent same-target revokes never double-count (always exactly 2 of 3 remain)", async () => {
      for (let i = 0; i < 50; i += 1) {
        const { users, courseId, cap } = await seed(3);
        const rs = await Promise.all([
          revokeCourseAuthor(
            { actorUserId: users[0], courseId, targetUserId: users[2], capability: cap(2) },
            uowFor(poolA, jitter()),
          ),
          revokeCourseAuthor(
            { actorUserId: users[1], courseId, targetUserId: users[2], capability: cap(2) },
            uowFor(poolB, jitter()),
          ),
        ]);
        expect(rs.map((r) => r.outcome).sort()).toEqual(["NOT_A_GRANT_HOLDER", "REVOKED"]);
        expect(await activeCount(courseId)).toBe(2);
      }
    });

    it("randomised jitter x 40: revoke of an already-revoked target racing a revoke of the other (2 active left) never zeroes the Course", async () => {
      for (let i = 0; i < 40; i += 1) {
        const { users, courseId, cap } = await seed(3);
        // users[2] already revoked, so active = {0, 1}
        await revokeCourseAuthor(
          { actorUserId: users[0], courseId, targetUserId: users[2], capability: cap(2) },
          uowFor(poolA),
        );
        const rs = await Promise.all([
          revokeCourseAuthor(
            { actorUserId: users[0], courseId, targetUserId: users[2], capability: cap(2) },
            uowFor(poolA, jitter()),
          ),
          revokeCourseAuthor(
            { actorUserId: users[1], courseId, targetUserId: users[0], capability: cap(0) },
            uowFor(poolB, jitter()),
          ),
        ]);
        expect(rs[0].outcome).toMatch(/^(NOT_A_GRANT_HOLDER|NOT_AUTHORIZED)$/);
        expect(await activeCount(courseId)).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ---------------------------------------------------------------- N3
  describe("N3 - actor revoked mid-flight (stale actor-authorization snapshot, FUB-042 item 7(b))", () => {
    /** Pauses the actor transaction AFTER its auth read, BEFORE it asks for the lock. */
    function pauseAfterActorAuth() {
      const paused = deferred();
      const resume = deferred();
      const hooks: Hooks = {
        after: async (k) => {
          if (k === "actorAuth") {
            paused.resolve();
            await resume.promise;
          }
        },
      };
      return { paused: paused.promise, resume: resume.resolve, hooks };
    }

    it("OBSERVED: actor A authorized, then revoked by B (committed) before A's lock; A (stale) still REVOKES C - last-author invariant holds (1 active left)", async () => {
      const { users, courseId, cap } = await seed(3); // A=0 OWNER, B=1, C=2
      const gate = pauseAfterActorAuth();
      const a = revokeCourseAuthor(
        { actorUserId: users[0], courseId, targetUserId: users[2], capability: cap(2) },
        uowFor(poolA, gate.hooks),
      );
      await gate.paused;
      const rb = await revokeCourseAuthor(
        { actorUserId: users[1], courseId, targetUserId: users[0], capability: cap(0) },
        uowFor(poolB),
      );
      expect(rb.outcome).toBe("REVOKED"); // A is now revoked and committed
      gate.resume();
      const ra: RevokeCourseAuthorResult = await a;
      // Current behaviour (stale-snapshot window): a revoked actor completes the in-flight write.
      // If FUB-042 7(b) is ever fixed (actor auth derived from the locked rows), this becomes NOT_AUTHORIZED.
      expect(ra.outcome).toBe("REVOKED");
      expect(await activeUsers(courseId)).toEqual([users[1]]);
    });

    it("OBSERVED: mutual revoke with a third author present - A paused after auth, B revokes A, A (stale) revokes B: both complete, only C remains (>=1 invariant holds)", async () => {
      const { users, courseId, cap } = await seed(3);
      const gate = pauseAfterActorAuth();
      const a = revokeCourseAuthor(
        { actorUserId: users[0], courseId, targetUserId: users[1], capability: cap(1) },
        uowFor(poolA, gate.hooks),
      );
      await gate.paused;
      const rb = await revokeCourseAuthor(
        { actorUserId: users[1], courseId, targetUserId: users[0], capability: cap(0) },
        uowFor(poolB),
      );
      expect(rb.outcome).toBe("REVOKED");
      gate.resume();
      const ra = await a;
      expect(ra.outcome).toBe("REVOKED"); // strict serial order would have said NOT_AUTHORIZED
      expect(await activeUsers(courseId)).toEqual([users[2]]);
    });

    it("2 authors: A paused after auth, B revokes A, A (stale) targets B -> LAST_AUTHOR (invariant protects; no mutation)", async () => {
      const { users, courseId, cap } = await seed(2);
      const gate = pauseAfterActorAuth();
      const a = revokeCourseAuthor(
        { actorUserId: users[0], courseId, targetUserId: users[1], capability: cap(1) },
        uowFor(poolA, gate.hooks),
      );
      await gate.paused;
      const rb = await revokeCourseAuthor(
        { actorUserId: users[1], courseId, targetUserId: users[0], capability: cap(0) },
        uowFor(poolB),
      );
      expect(rb.outcome).toBe("REVOKED");
      gate.resume();
      expect((await a).outcome).toBe("LAST_AUTHOR");
      expect(await activeUsers(courseId)).toEqual([users[1]]);
    });

    it("a never-authorized actor is still refused (NOT_AUTHORIZED) and an actor revoked BEFORE it starts is refused (no stale window)", async () => {
      const { users, courseId, cap } = await seed(3);
      await revokeCourseAuthor(
        { actorUserId: users[1], courseId, targetUserId: users[0], capability: cap(0) },
        uowFor(poolB),
      );
      const stale = await revokeCourseAuthor(
        { actorUserId: users[0], courseId, targetUserId: users[2], capability: cap(2) },
        uowFor(poolA),
      );
      expect(stale.outcome).toBe("NOT_AUTHORIZED");
      expect(await activeCount(courseId)).toBe(2);
    });
  });
});
