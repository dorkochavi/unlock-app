/**
 * PostgreSQL implementation of `ImportUnitOfWork`
 * (`src/application/import/ports.ts`) — Run 007 S4: `confirmImport`'s
 * mutable-invariant re-check + per-row `createDraft`/`updateDraft` writes
 * must commit or roll back together. Mirrors `PostgresQuestionUnitOfWork`
 * exactly (same BEGIN/COMMIT/ROLLBACK shape, same rollback-failure-does-not-
 * mask-the-original-error handling), narrowed to `ImportRepositories`
 * (adds `topics`, which `PublishQuestionRepositories` deliberately omits —
 * see `ports.ts`'s own doc comment for why confirm's transaction needs it).
 */
import type { ImportRepositories, ImportUnitOfWork } from "../../application/import/ports";
import type { ConnectionProvider } from "./connection-provider";
import { PostgresCourseMembershipRepository } from "./course-membership-repository";
import { PostgresCourseRepository } from "./course-repository";
import { PostgresQuestionRepository } from "./question-authoring-repository";
import { PostgresTopicRepository } from "./topic-repository";

export class PostgresImportUnitOfWork implements ImportUnitOfWork {
  constructor(private readonly connectionProvider: ConnectionProvider) {}

  async runInTransaction<T>(fn: (repos: ImportRepositories) => Promise<T>): Promise<T> {
    return this.connectionProvider.withConnection(async (db) => {
      await db.query("begin");
      try {
        const repos: ImportRepositories = {
          memberships: new PostgresCourseMembershipRepository(db),
          courses: new PostgresCourseRepository(db),
          questions: new PostgresQuestionRepository(db),
          topics: new PostgresTopicRepository(db),
        };
        const result = await fn(repos);
        await db.query("commit");
        return result;
      } catch (error) {
        try {
          await db.query("rollback");
        } catch (rollbackError) {
          // Same discipline as `PostgresQuestionUnitOfWork`: a failed
          // ROLLBACK must never replace/mask the original error, which is
          // what the caller actually needs to see.
          console.error(
            "PostgresImportUnitOfWork: ROLLBACK itself failed after a transaction error",
            rollbackError,
          );
        }
        throw error;
      }
    });
  }
}
