/**
 * PostgreSQL implementation of `CourseRepository`
 * (`src/application/course/ports.ts`), backed by `courses.join_policy`.
 */
import { COURSE_JOIN_POLICIES, COURSE_STATUSES } from "../../domain/course/types";
import type {
  CourseAuthoringRecord,
  CourseRepository,
  CourseSummary,
  CreateCourseInput,
  UpdateCourseMetadataInput,
} from "../../application/course/ports";
import type { CourseStatus } from "../../domain/course/types";
import {
  readDate,
  readDateOnlyString,
  readEnum,
  readString,
} from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

const TABLE = "courses";

function mapAuthoringRow(row: Record<string, unknown>): CourseAuthoringRecord {
  return {
    id: readString(row, TABLE, "id"),
    title: readString(row, TABLE, "title"),
    status: readEnum(row, TABLE, "status", COURSE_STATUSES),
    joinPolicy: readEnum(row, TABLE, "join_policy", COURSE_JOIN_POLICIES),
    examDate: row.exam_date === null ? null : readDateOnlyString(row, TABLE, "exam_date"),
    createdAt: readDate(row, TABLE, "created_at"),
    updatedAt: readDate(row, TABLE, "updated_at"),
  };
}

const AUTHORING_COLUMNS =
  "id, title, status, join_policy, exam_date, created_at, updated_at";

export class PostgresCourseRepository implements CourseRepository {
  constructor(private readonly db: TransactionExecutor) {}

  /**
   * SECURITY-SENSITIVE, stated explicitly: names only `id, title` —
   * `owner_user_id`/`join_policy`/timestamps are never part of this SQL
   * text, so none of them can ever reach this port's public-safe caller
   * (Night-Run Slice 6's join page).
   */
  async getCourseSummary(courseId: string): Promise<CourseSummary | null> {
    const result = await this.db.query(
      "select id, title from courses where id = $1",
      [courseId],
    );
    if (result.rows.length !== 1) {
      return null;
    }
    return {
      id: readString(result.rows[0], TABLE, "id"),
      title: readString(result.rows[0], TABLE, "title"),
    };
  }

  /**
   * Batched form of `getCourseSummary` (`CourseRepository.getCourseSummaries`
   * doc comment). Same security-sensitive column list: `id, title` only.
   * Empty input short-circuits to an empty result rather than issuing
   * `= ANY($1)` with an empty array, which is valid SQL but a wasted round
   * trip for a case the caller (My Courses with zero memberships) already
   * knows the answer to.
   */
  async getCourseSummaries(courseIds: string[]): Promise<CourseSummary[]> {
    if (courseIds.length === 0) {
      return [];
    }
    const result = await this.db.query(
      "select id, title from courses where id = any($1::uuid[])",
      [courseIds],
    );
    return result.rows.map((row) => ({
      id: readString(row, TABLE, "id"),
      title: readString(row, TABLE, "title"),
    }));
  }

  /**
   * Batched form mirroring `getCourseSummaries` exactly (`CourseRepository
   * .listStatuses` doc comment) — same empty-input short-circuit, same
   * `= ANY($1::uuid[])` shape, different column list.
   */
  async listStatuses(courseIds: string[]): Promise<{ id: string; status: CourseStatus }[]> {
    if (courseIds.length === 0) {
      return [];
    }
    const result = await this.db.query(
      "select id, status from courses where id = any($1::uuid[])",
      [courseIds],
    );
    return result.rows.map((row) => ({
      id: readString(row, TABLE, "id"),
      status: readEnum(row, TABLE, "status", COURSE_STATUSES),
    }));
  }

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

  /** Narrow read for `joinCourse`'s eligibility check — see port doc comment. */
  async getJoinEligibility(courseId: string) {
    const result = await this.db.query(
      "select status, join_policy from courses where id = $1",
      [courseId],
    );
    if (result.rows.length !== 1) {
      return null;
    }
    return {
      status: readEnum(result.rows[0], TABLE, "status", COURSE_STATUSES),
      joinPolicy: readEnum(result.rows[0], TABLE, "join_policy", COURSE_JOIN_POLICIES),
    };
  }

  async createCourse(input: CreateCourseInput): Promise<CourseAuthoringRecord> {
    const result = await this.db.query(
      `insert into courses (owner_user_id, title, exam_date, status)
        values ($1, $2, $3, 'DRAFT')
        returning ${AUTHORING_COLUMNS}`,
      [input.ownerUserId, input.title, input.examDate],
    );
    return mapAuthoringRow(result.rows[0]);
  }

  async getCourseForAuthoring(courseId: string): Promise<CourseAuthoringRecord | null> {
    const result = await this.db.query(
      `select ${AUTHORING_COLUMNS} from courses where id = $1`,
      [courseId],
    );
    return result.rows.length === 1 ? mapAuthoringRow(result.rows[0]) : null;
  }

  /**
   * Dynamic `SET` clause: only fields actually present in `input` are
   * written (`title`/`examDate` each independently optional). `examDate`
   * explicitly `null` clears it; `undefined`/absent leaves it unchanged —
   * distinguished by `!== undefined`, never by truthiness, so a caller can
   * always tell "clear this field" from "don't touch this field." Fully
   * parameterized regardless of which fields are present — no value is ever
   * interpolated into the SQL text itself.
   */
  async updateCourseMetadata(
    courseId: string,
    input: UpdateCourseMetadataInput,
  ): Promise<CourseAuthoringRecord | null> {
    const setClauses: string[] = ["updated_at = now()"];
    const values: unknown[] = [courseId];

    if (input.title !== undefined) {
      values.push(input.title);
      setClauses.push(`title = $${values.length}`);
    }
    if (input.examDate !== undefined) {
      values.push(input.examDate);
      setClauses.push(`exam_date = $${values.length}`);
    }

    const result = await this.db.query(
      `update courses set ${setClauses.join(", ")}
        where id = $1
        returning ${AUTHORING_COLUMNS}`,
      values,
    );
    return result.rows.length === 1 ? mapAuthoringRow(result.rows[0]) : null;
  }

  async setCourseStatus(
    courseId: string,
    status: CourseStatus,
  ): Promise<CourseAuthoringRecord | null> {
    const result = await this.db.query(
      `update courses set status = $2, updated_at = now()
        where id = $1
        returning ${AUTHORING_COLUMNS}`,
      [courseId, status],
    );
    return result.rows.length === 1 ? mapAuthoringRow(result.rows[0]) : null;
  }
}
