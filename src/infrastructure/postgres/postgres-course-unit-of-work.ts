/**
 * PostgreSQL implementation of `CourseUnitOfWork`
 * (`src/application/course/ports.ts`) — Run 005 S2 DB review finding:
 * `createCourse`'s two writes must commit or roll back together. Mirrors
 * `postgres-unit-of-work.ts`'s `PostgresUnitOfWork.runInTransaction`
 * exactly (same BEGIN/COMMIT/ROLLBACK shape, same rollback-failure-does-
 * not-mask-the-original-error handling), narrowed to this module's own
 * `CourseRepositories`.
 *
 * RUN010-H.1 constructed a `PostgresCourseAuthorRepository` and attached it
 * as `repos.authors`, at the time unused by any application code. As of
 * RUN010-H.2, `createCourse` (`src/application/course/create-course.ts`)
 * uses it: the two writes this UnitOfWork wraps are now the `courses`
 * insert + the creator's `course_authors` OWNER grant (`repos.authors
 * .grant(...)`) — no longer a `course_memberships` insert.
 */
import type { CourseRepositories, CourseUnitOfWork } from "../../application/course/ports";
import type { ConnectionProvider } from "./connection-provider";
import { PostgresCourseAuthorRepository } from "./course-author-repository";
import { PostgresCourseMembershipRepository } from "./course-membership-repository";
import { PostgresCourseRepository } from "./course-repository";
import { logUnexpectedError } from "@/lib/ops-log";

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
          logUnexpectedError("PostgresCourseUnitOfWork: ROLLBACK itself failed after a transaction error", rollbackError);
        }
        throw error;
      }
    });
  }
}
