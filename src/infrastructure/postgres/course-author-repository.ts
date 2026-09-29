/**
 * PostgreSQL implementation of `CourseAuthorRepository`
 * (`src/application/course/ports.ts`), backed by `course_authors`
 * (RUN010-H.1, FUB-036 Option 4 architecture). Mirrors
 * `PostgresCourseMembershipRepository`'s exact patterns. As of RUN010-H.2,
 * this is the authorization source of truth for every Course/Topic/
 * Question/Import/Insights management call site (`findActiveCapabilities`,
 * via the domain predicate `hasActiveAuthorGrant`), `create-course.ts`
 * (`grant`), and "My Courses" (`listActiveForUser`) — see this table's
 * migration (`supabase/migrations/20260929010000_course_authors_v1.sql`)
 * for the phased plan this Slice continues.
 */
import type {
  CourseAuthorCapability,
  CourseAuthorRepository,
} from "../../application/course/ports";
import { mapCourseAuthorRow } from "./course-author-mapper";
import type { TransactionExecutor } from "./sql-executor";

export class PostgresCourseAuthorRepository implements CourseAuthorRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async findActiveCapabilities(userId: string, courseId: string) {
    const result = await this.db.query(
      `select * from course_authors
        where user_id = $1 and course_id = $2 and revoked_at is null`,
      [userId, courseId],
    );
    return result.rows.map(mapCourseAuthorRow);
  }

  async listActiveForUser(userId: string) {
    const result = await this.db.query(
      `select * from course_authors
        where user_id = $1 and revoked_at is null`,
      [userId],
    );
    return result.rows.map(mapCourseAuthorRow);
  }

  async listActiveForCourse(courseId: string) {
    const result = await this.db.query(
      `select * from course_authors
        where course_id = $1 and revoked_at is null`,
      [courseId],
    );
    return result.rows.map(mapCourseAuthorRow);
  }

  /**
   * Race-free by construction (`CourseMembershipRepository.createMembership`'s
   * own established pattern, reused here): `INSERT ... ON CONFLICT (user_id,
   * course_id, capability) DO NOTHING RETURNING`, never a check-then-insert.
   * If this call loses the race, the caller-supplied `grant` is silently
   * discarded in favor of the already-committed row (`wasNew: false`).
   */
  async grant(
    grant: Parameters<CourseAuthorRepository["grant"]>[0],
  ) {
    const inserted = await this.db.query(
      `insert into course_authors (user_id, course_id, capability, granted_at, revoked_at)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, course_id, capability) do nothing
       returning *`,
      [
        grant.userId,
        grant.courseId,
        grant.capability,
        grant.grantedAt,
        grant.revokedAt,
      ],
    );

    if (inserted.rows.length === 1) {
      return { grant: mapCourseAuthorRow(inserted.rows[0]), wasNew: true };
    }

    const existing = await this.db.query(
      `select * from course_authors
        where user_id = $1 and course_id = $2 and capability = $3`,
      [grant.userId, grant.courseId, grant.capability],
    );
    if (existing.rows.length !== 1) {
      // The conflict branch fired, so a row must exist — reachable only via
      // a real bug (e.g. a concurrent delete between the conflicting INSERT
      // and this SELECT; no code path in this codebase deletes a
      // course_authors row), surfaced loudly rather than silently returning
      // an impossible null, mirroring
      // `PostgresCourseMembershipRepository.createMembership`'s own
      // equivalent guard.
      throw new Error(
        `PostgresCourseAuthorRepository.grant: INSERT reported a conflict ` +
          `for (user_id=${grant.userId}, course_id=${grant.courseId}, ` +
          `capability=${grant.capability}) but no matching row was found ` +
          `on the follow-up SELECT`,
      );
    }
    return { grant: mapCourseAuthorRow(existing.rows[0]), wasNew: false };
  }

  async revoke(
    userId: string,
    courseId: string,
    capability: CourseAuthorCapability,
    revokedAt: Date,
  ) {
    const result = await this.db.query(
      `update course_authors
          set revoked_at = $4
        where user_id = $1 and course_id = $2 and capability = $3
        returning *`,
      [userId, courseId, capability, revokedAt],
    );
    return result.rows.length === 1 ? mapCourseAuthorRow(result.rows[0]) : null;
  }
}
