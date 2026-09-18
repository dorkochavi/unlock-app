/**
 * PostgreSQL implementation of `UnitOfWork` (`src/application/learning/
 * ports.ts`) and ADR-010's transaction-scoped advisory lock.
 */
import type {
  TransactionalRepositories,
  UnitOfWork,
} from "../../application/learning/ports";
import { PostgresAnswerCorrectnessChecker } from "./answer-correctness-checker";
import { PostgresAttemptRepository } from "./attempt-repository";
import type { ConnectionProvider } from "./connection-provider";
import { PostgresQuestionVersionRepository } from "./question-version-repository";
import { PostgresUserQuestionProgressRepository } from "./progress-repository";
import type { TransactionExecutor } from "./sql-executor";
import { PostgresTodaySessionRepository } from "./today-session-repository";

/**
 * ADR-010's transaction-scoped advisory lock, keyed by `(userId,
 * questionId)`:
 *
 *   SELECT pg_advisory_xact_lock(hashtextextended(user_id || ':' || question_id, 0));
 *
 * Automatically released at COMMIT/ROLLBACK — no explicit unlock call
 * exists or is needed.
 *
 * **Collision possibility, stated explicitly (Phase 11 review)**:
 * `hashtextextended` maps its input to a 64-bit hash, so two DIFFERENT
 * `(userId, questionId)` pairs can theoretically hash to the same bigint
 * and therefore serialize against each other despite being logically
 * unrelated. This affects THROUGHPUT ONLY, never correctness: a collision
 * makes two unrelated pairs briefly wait on each other's transactions, it
 * never lets two transactions for the SAME pair proceed concurrently
 * (which is the only property `submitAnswer`'s correctness actually
 * depends on — see ADR-010's "First-progress-row concurrency" section).
 * This must not be read as "unrelated pairs can never serialize" — they
 * can, rarely, and that is an accepted throughput cost, not a
 * correctness gap.
 *
 * **Discipline requirement, not enforced by this function**: every code
 * path that reads-then-writes `UserQuestionProgress` for a given
 * `(userId, questionId)` MUST call this first, in the same transaction,
 * before any such read/write. This module has no way to enforce that
 * globally — it is an application-level contract (ADR-010's own "Required
 * discipline" paragraph), currently followed by `submit-answer.ts`
 * (verified: its very first transactional step is
 * `repos.acquireLearnerQuestionLock(...)`) and by nothing else in this
 * codebase that writes `UserQuestionProgress`, because nothing else does.
 *
 * **What PGlite does and does not prove about this function**: PGlite is a
 * genuine PostgreSQL engine, so `pg_advisory_xact_lock`/`hashtextextended`
 * really execute and really succeed — this is verified in this
 * repository's integration tests. What PGlite CANNOT prove is that the
 * lock actually blocks a second, concurrent transaction: PGlite runs as a
 * single in-process WASM instance with no real second concurrent backend
 * to contend with (`supabase/README.md`'s own "what pglite does not
 * prove" note, extended here to advisory locks specifically). Real
 * concurrent-blocking behavior requires a real multi-connection Postgres
 * instance — see `supabase/README.md`'s "What was NOT verified" section
 * for the concrete follow-up requirement this implies.
 */
export async function acquireLearnerQuestionLock(
  db: TransactionExecutor,
  userId: string,
  questionId: string,
): Promise<void> {
  await db.query(
    "select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text, 0))",
    [userId, questionId],
  );
}

export class PostgresUnitOfWork implements UnitOfWork {
  constructor(private readonly connectionProvider: ConnectionProvider) {}

  /**
   * BEGIN — run `fn` with repositories bound to this one transaction —
   * COMMIT on success, ROLLBACK on any thrown error, which is always
   * re-thrown afterward (never swallowed — `docs/ARCHITECTURE.md` §21).
   */
  async runInTransaction<T>(
    fn: (repos: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.connectionProvider.withConnection(async (db) => {
      await db.query("begin");
      try {
        const repos: TransactionalRepositories = {
          acquireLearnerQuestionLock: (userId, questionId) =>
            acquireLearnerQuestionLock(db, userId, questionId),
          attempts: new PostgresAttemptRepository(db),
          progress: new PostgresUserQuestionProgressRepository(db),
          answerCorrectness: new PostgresAnswerCorrectnessChecker(db),
          questionVersions: new PostgresQuestionVersionRepository(db),
          todaySessions: new PostgresTodaySessionRepository(db),
        };
        const result = await fn(repos);
        await db.query("commit");
        return result;
      } catch (error) {
        try {
          await db.query("rollback");
        } catch (rollbackError) {
          // Mutation-review finding: a naive `await db.query("rollback");
          // throw error;` would let a FAILED rollback (e.g. the connection
          // already dropped) silently replace the original error with the
          // rollback's own — hiding the actual cause of the failure behind
          // a secondary, less useful one. The original `error` is what
          // actually matters to the caller and remains what this function
          // throws; the rollback failure is still surfaced (not
          // swallowed), just not in place of the real cause. No logging
          // framework exists yet (`docs/ARCHITECTURE.md` §24: introduce
          // one when there is a concrete operational need) — `console
          // .error` is the minimal honest fallback until then.
          console.error(
            "PostgresUnitOfWork: ROLLBACK itself failed after a transaction error",
            rollbackError,
          );
        }
        throw error;
      }
    });
  }
}
