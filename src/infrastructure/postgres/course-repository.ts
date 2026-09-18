/**
 * PostgreSQL implementation of `CourseRepository`
 * (`src/application/course/ports.ts`), backed by `courses.join_policy`.
 */
import { COURSE_JOIN_POLICIES } from "../../domain/course/types";
import type { CourseRepository } from "../../application/course/ports";
import { readEnum } from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

const TABLE = "courses";

export class PostgresCourseRepository implements CourseRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async getJoinPolicy(courseId: string) {
    const result = await this.db.query(
      "select join_policy from courses where id = $1",
      [courseId],
    );
    return result.rows.length === 1
      ? readEnum(result.rows[0], TABLE, "join_policy", COURSE_JOIN_POLICIES)
      : null;
  }

  async setJoinPolicy(
    courseId: string,
    joinPolicy: (typeof COURSE_JOIN_POLICIES)[number],
  ) {
    const result = await this.db.query(
      `update courses set join_policy = $2, updated_at = now()
        where id = $1
        returning join_policy`,
      [courseId, joinPolicy],
    );
    return result.rows.length === 1
      ? readEnum(result.rows[0], TABLE, "join_policy", COURSE_JOIN_POLICIES)
      : null;
  }
}
