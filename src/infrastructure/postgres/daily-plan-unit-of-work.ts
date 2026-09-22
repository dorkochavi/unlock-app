/**
 * PostgreSQL implementation of `DailyPlanUnitOfWork`
 * (`src/application/dailyPlan/ports.ts`) — mirrors `PostgresUnitOfWork`
 * (`postgres-unit-of-work.ts`)'s BEGIN/COMMIT/ROLLBACK pattern exactly,
 * scoped to the repositories DailyPlan generation actually needs:
 * `dailyPlans`, `progress`, `questionVersions`, `unseenQuestions` (ADR-017,
 * only ever read when the ranked-candidate pool is empty).
 *
 * Deliberately does NOT acquire `submitAnswer`'s advisory lock
 * (`acquireLearnerQuestionLock`, ADR-010) — DailyPlan generation only ever
 * READS `UserQuestionProgress`, it never reads-then-writes it (that
 * read-then-write pattern is exactly what the advisory lock exists to
 * serialize), and `DailyPlanRepository.createIfNotExists` is already
 * race-free by construction (`INSERT ... ON CONFLICT (user_id,
 * planned_for_date) DO NOTHING RETURNING`), so no additional locking is
 * needed here either.
 */
import type {
  DailyPlanTransactionalRepositories,
  DailyPlanUnitOfWork,
} from "../../application/dailyPlan/ports";
import type { ConnectionProvider } from "./connection-provider";
import { PostgresDailyPlanRepository } from "./daily-plan-repository";
import { PostgresQuestionVersionRepository } from "./question-version-repository";
import { PostgresUserQuestionProgressRepository } from "./progress-repository";
import { PostgresUnseenQuestionRepository } from "./unseen-question-repository";

export class PostgresDailyPlanUnitOfWork implements DailyPlanUnitOfWork {
  constructor(private readonly connectionProvider: ConnectionProvider) {}

  /**
   * BEGIN — run `fn` with repositories bound to this one transaction —
   * COMMIT on success, ROLLBACK on any thrown error, which is always
   * re-thrown afterward (never swallowed — matches `PostgresUnitOfWork`'s
   * identical discipline, `docs/ARCHITECTURE.md` §21).
   */
  async runInTransaction<T>(
    fn: (repos: DailyPlanTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.connectionProvider.withConnection(async (db) => {
      await db.query("begin");
      try {
        const repos: DailyPlanTransactionalRepositories = {
          dailyPlans: new PostgresDailyPlanRepository(db),
          progress: new PostgresUserQuestionProgressRepository(db),
          questionVersions: new PostgresQuestionVersionRepository(db),
          unseenQuestions: new PostgresUnseenQuestionRepository(db),
        };
        const result = await fn(repos);
        await db.query("commit");
        return result;
      } catch (error) {
        try {
          await db.query("rollback");
        } catch (rollbackError) {
          // Same reasoning as PostgresUnitOfWork: a failed ROLLBACK must
          // never silently replace the original error with a less useful
          // one — the original `error` is what this function throws;
          // the rollback failure is surfaced (not swallowed), just not in
          // place of the real cause.
          console.error(
            "PostgresDailyPlanUnitOfWork: ROLLBACK itself failed after a transaction error",
            rollbackError,
          );
        }
        throw error;
      }
    });
  }
}
