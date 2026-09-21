/**
 * PostgreSQL implementation of `QuestionUnitOfWork`
 * (`src/application/question/ports.ts`) — Run 006 S5: `publishQuestion`'s
 * insert-new-version + repoint-current-version-and-clear-draft writes must
 * commit or roll back together. Mirrors `PostgresCourseUnitOfWork` exactly
 * (same BEGIN/COMMIT/ROLLBACK shape, same rollback-failure-does-not-mask-
 * the-original-error handling), narrowed to `PublishQuestionRepositories`.
 */
import type { PublishQuestionRepositories, QuestionUnitOfWork } from "../../application/question/ports";
import type { ConnectionProvider } from "./connection-provider";
import { PostgresCourseMembershipRepository } from "./course-membership-repository";
import { PostgresCourseRepository } from "./course-repository";
import { PostgresQuestionRepository } from "./question-authoring-repository";

export class PostgresQuestionUnitOfWork implements QuestionUnitOfWork {
  constructor(private readonly connectionProvider: ConnectionProvider) {}

  async runInTransaction<T>(
    fn: (repos: PublishQuestionRepositories) => Promise<T>,
  ): Promise<T> {
    return this.connectionProvider.withConnection(async (db) => {
      await db.query("begin");
      try {
        const repos: PublishQuestionRepositories = {
          memberships: new PostgresCourseMembershipRepository(db),
          courses: new PostgresCourseRepository(db),
          questions: new PostgresQuestionRepository(db),
        };
        const result = await fn(repos);
        await db.query("commit");
        return result;
      } catch (error) {
        try {
          await db.query("rollback");
        } catch (rollbackError) {
          // Same discipline as `PostgresCourseUnitOfWork`: a failed
          // ROLLBACK must never replace/mask the original error, which is
          // what the caller actually needs to see.
          console.error(
            "PostgresQuestionUnitOfWork: ROLLBACK itself failed after a transaction error",
            rollbackError,
          );
        }
        throw error;
      }
    });
  }
}
