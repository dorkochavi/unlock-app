/**
 * PostgreSQL implementation of `CourseUnitOfWork`
 * (`src/application/course/ports.ts`) — Run 005 S2 DB review finding:
 * `createCourse`'s `courses` insert + creator's OWNER `course_memberships`
 * insert must commit or roll back together. Mirrors
 * `postgres-unit-of-work.ts`'s `PostgresUnitOfWork.runInTransaction`
 * exactly (same BEGIN/COMMIT/ROLLBACK shape, same rollback-failure-does-
 * not-mask-the-original-error handling), narrowed to this module's own
 * `CourseRepositories`.
 *
 * RUN010-H.1: also constructs a `PostgresCourseAuthorRepository` and attaches
 * it as `repos.authors`. `CourseRepositories.authors` is optional
 * specifically so this stays additive: nothing currently reads `repos.authors`
 * anywhere (this Slice only wires availability); a later Slice (H.2) is
 * expected to start using it, e.g. for `createCourse`'s eventual switch to
 * granting a `course_authors` row instead of an OWNER `course_memberships`
 * row.
 */
import type { CourseRepositories, CourseUnitOfWork } from "../../application/course/ports";
import type { ConnectionProvider } from "./connection-provider";
import { PostgresCourseAuthorRepository } from "./course-author-repository";
import { PostgresCourseMembershipRepository } from "./course-membership-repository";
import { PostgresCourseRepository } from "./course-repository";

export class PostgresCourseUnitOfWork implements CourseUnitOfWork {
  constructor(private readonly connectionProvider: ConnectionProvider) {}

  async runInTransaction<T>(
    fn: (repos: CourseRepositories) => Promise<T>,
  ): Promise<T> {
    return this.connectionProvider.withConnection(async (db) => {
      await db.query("begin");
      try {
        const repos: CourseRepositories = {
          memberships: new PostgresCourseMembershipRepository(db),
          courses: new PostgresCourseRepository(db),
          authors: new PostgresCourseAuthorRepository(db),
        };
        const result = await fn(repos);
        await db.query("commit");
        return result;
      } catch (error) {
        try {
          await db.query("rollback");
        } catch (rollbackError) {
          // Same discipline as `PostgresUnitOfWork`: a failed ROLLBACK must
          // never replace/mask the original error, which is what the
          // caller actually needs to see.
          console.error(
            "PostgresCourseUnitOfWork: ROLLBACK itself failed after a transaction error",
            rollbackError,
          );
        }
        throw error;
      }
    });
  }
}
