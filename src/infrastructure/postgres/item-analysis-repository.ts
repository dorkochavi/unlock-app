/**
 * PostgreSQL implementation of `ItemAnalysisRepository`
 * (`src/application/insights/ports.ts`) — Pre-Pilot S2. Read-only direct
 * aggregate over existing tables; no migration, no persisted aggregate.
 *
 * Counting rule: the FIRST persisted Attempt (ordered by server-side
 * `created_at`, then `id` — never the client-supplied `answered_at`) per
 * distinct user, on the Question's CURRENT QuestionVersion, by a user who
 * currently holds an active LEARNER membership in the Course. Repeat
 * Attempts, older-version Attempts, and Attempts by
 * instructors/revoked/archived members are excluded. `is_correct` is used
 * as persisted; grading is never recomputed.
 */
import type {
  CurrentVersionItemStats,
  ItemAnalysisRepository,
  TopicFirstAttemptStats,
} from "../../application/insights/ports";
import { readBoolean, readNullableString, readString } from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

/**
 * The single counting rule shared by Item Analysis and Topic Insights (Run
 * 009 S3): one row per (Question, active LEARNER) — that learner's first
 * persisted Attempt on the Question's CURRENT version. Parameter $1 = Course.
 */
const FIRST_ATTEMPTS_CTE = `with first_attempts as (
         select distinct on (a.question_id, a.user_id)
                a.question_id, a.user_id, a.is_correct
           from attempts a
           join questions q
             on q.id = a.question_id
            and q.course_id = $1
            and a.question_version_id = q.current_version_id
           join course_memberships m
             on m.user_id = a.user_id
            and m.course_id = $1
            and m.role = 'LEARNER' and m.revoked_at is null and m.archived_at is null
          where a.course_id = $1
          order by a.question_id, a.user_id, a.created_at, a.id
       )`;

export class PostgresItemAnalysisRepository implements ItemAnalysisRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async countActiveLearners(courseId: string): Promise<number> {
    const result = await this.db.query(
      `select count(*)::int as n
         from course_memberships
        where course_id = $1
          and role = 'LEARNER' and revoked_at is null and archived_at is null`,
      [courseId],
    );
    return toCount(result.rows[0]?.n);
  }

  async listCurrentVersionItemStats(courseId: string): Promise<CurrentVersionItemStats[]> {
    const result = await this.db.query(
      `${FIRST_ATTEMPTS_CTE}
       select q.id as question_id,
              qv.id as question_version_id,
              qv.prompt,
              count(f.user_id)::int as responder_count,
              (count(f.user_id) filter (where f.is_correct))::int as correct_count
         from questions q
         join question_versions qv on qv.id = q.current_version_id
         left join first_attempts f on f.question_id = q.id
        where q.course_id = $1
        group by q.id, qv.id, qv.prompt, q.created_at
        order by q.created_at, q.id`,
      [courseId],
    );
    return result.rows.map((row) => ({
      questionId: readString(row, "questions", "question_id"),
      questionVersionId: readString(row, "question_versions", "question_version_id"),
      prompt: readString(row, "question_versions", "prompt"),
      distinctResponderCount: toCount(row.responder_count),
      correctCount: toCount(row.correct_count),
    }));
  }

  /**
   * Topic is CURRENT-derived: a Question's Topic is its `questions.topic_id`
   * at read time, so reassigning it moves its historical first attempts to
   * the new Topic (Plan D6, accepted V1 behavior). Only published Questions
   * (current version present) are considered; archived Topics stay their own
   * flagged bucket and Questions with no Topic form one null bucket.
   */
  async listTopicFirstAttemptStats(courseId: string): Promise<TopicFirstAttemptStats[]> {
    const result = await this.db.query(
      `${FIRST_ATTEMPTS_CTE}
       select t.id as topic_id,
              t.name as topic_name,
              (t.archived_at is not null) as topic_archived,
              count(distinct f.user_id)::int as responder_count,
              count(f.user_id)::int as attempt_count,
              (count(f.user_id) filter (where f.is_correct))::int as correct_count
         from questions q
         left join topics t on t.id = q.topic_id
         left join first_attempts f on f.question_id = q.id
        where q.course_id = $1
          and q.current_version_id is not null
        group by t.id, t.name, t.archived_at, t.created_at
        order by t.created_at nulls last, t.id nulls last`,
      [courseId],
    );
    return result.rows.map((row) => ({
      topicId: readNullableString(row, "topics", "topic_id"),
      topicName: readNullableString(row, "topics", "topic_name"),
      topicArchived: row.topic_id != null && readBoolean(row, "topics", "topic_archived"),
      distinctResponderCount: toCount(row.responder_count),
      firstAttemptCount: toCount(row.attempt_count),
      correctAttemptCount: toCount(row.correct_count),
    }));
  }
}

function toCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
    throw new Error(
      `PostgresItemAnalysisRepository: expected a non-negative integer count, got ${String(value)}`,
    );
  }
  return n;
}
