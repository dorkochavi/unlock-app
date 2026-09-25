/**
 * PostgreSQL implementation of `LearnerTopicProgressRepository`
 * (`src/application/progress/ports.ts`) — Run 009 S1. Read-only; no
 * migration, no persisted aggregate.
 *
 * One row per published Question (`current_version_id is not null`) of the
 * Course, joined to its CURRENT Topic (`questions.topic_id`, D6) and to this
 * learner's `user_question_progress` row (left join — a missing row is not
 * evidence either way). `attempted` = any real Attempt by this learner on the
 * Question (ADR-017), independent of the progress row and QuestionVersion.
 */
import type {
  LearnerCourseQuestionRow,
  LearnerTopicProgressRepository,
} from "../../application/progress/ports";
import type { MasteryCategory, MisconceptionState } from "../../domain/learning/types";
import { MASTERY_CATEGORIES, MISCONCEPTION_STATES } from "../../domain/learning/types";
import {
  readBoolean,
  readEnum,
  readNullableDate,
  readNullableString,
  readString,
} from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

const TABLE = "learner_topic_progress";

export class PostgresLearnerTopicProgressRepository implements LearnerTopicProgressRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async listCourseQuestionsForLearner(
    userId: string,
    courseId: string,
  ): Promise<LearnerCourseQuestionRow[]> {
    const result = await this.db.query(
      `select q.id as question_id,
              t.id as topic_id,
              t.name as topic_name,
              (t.archived_at is not null) as topic_archived,
              exists (
                select 1 from attempts a
                 where a.user_id = $1 and a.question_id = q.id
              ) as attempted,
              p.user_id as progress_user_id,
              p.mastery_category,
              p.misconception_state,
              p.last_lapse_at,
              p.retrieval_baseline_at
         from questions q
         left join topics t on t.id = q.topic_id
         left join user_question_progress p on p.question_id = q.id and p.user_id = $1
        where q.course_id = $2
          and q.current_version_id is not null
        order by t.created_at, t.id, q.created_at, q.id`,
      [userId, courseId],
    );

    return result.rows.map((row) => ({
      questionId: readString(row, TABLE, "question_id"),
      topicId: readNullableString(row, TABLE, "topic_id"),
      topicName: readNullableString(row, TABLE, "topic_name"),
      topicArchived: row.topic_id != null && readBoolean(row, TABLE, "topic_archived"),
      learnerState: {
        attempted: readBoolean(row, TABLE, "attempted"),
        progress:
          row.progress_user_id == null
            ? null
            : {
                masteryCategory: readEnum<MasteryCategory>(
                  row,
                  TABLE,
                  "mastery_category",
                  MASTERY_CATEGORIES,
                ),
                misconceptionState: readEnum<MisconceptionState>(
                  row,
                  TABLE,
                  "misconception_state",
                  MISCONCEPTION_STATES,
                ),
                lastLapseAt: readNullableDate(row, TABLE, "last_lapse_at"),
                retrievalBaselineAt: readNullableDate(row, TABLE, "retrieval_baseline_at"),
              },
      },
    }));
  }
}
