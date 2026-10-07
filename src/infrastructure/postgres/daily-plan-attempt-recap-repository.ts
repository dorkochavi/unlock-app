/**
 * PostgreSQL reader for the Today learning recap (RUN TODAY-LEARNING-RECAP-004):
 * ONE plain read of the Attempts made on a single DailyPlan, with the question's
 * CURRENT topic (left joins — a question may have no topic; a topic may be
 * archived).
 *
 * Scoped by BOTH `user_id` (the authenticated learner, never client input) and
 * `daily_plan_id`, so another learner's attempts and Practice attempts
 * (`daily_plan_id is null`) can never match. Projects only the fields the recap
 * needs — never `selected_answer`, correctness keys or explanations. No writes,
 * no transaction (plain `SqlExecutor`), no schema change.
 */
import type {
  DailyPlanAttemptReader,
  LearningRecapAttemptRow,
} from "../../application/dailyPlan/derive-learning-recap";
import type { SqlExecutor } from "./sql-executor";

export class PostgresDailyPlanAttemptRecapRepository implements DailyPlanAttemptReader {
  constructor(private readonly db: SqlExecutor) {}

  async findAttemptsForPlan(
    userId: string,
    dailyPlanId: string,
  ): Promise<LearningRecapAttemptRow[]> {
    const result = await this.db.query(
      `select a.daily_plan_item_id, a.is_correct, a.confidence_level,
              t.id as topic_id, t.name as topic_name,
              (t.archived_at is not null) as topic_archived
         from attempts a
         left join questions q on q.id = a.question_id
         left join topics t on t.id = q.topic_id
        where a.user_id = $1 and a.daily_plan_id = $2
        order by a.answered_at asc, a.created_at asc, a.id asc`,
      [userId, dailyPlanId],
    );
    return result.rows
      .filter((row) => row.daily_plan_item_id !== null)
      .map((row) => ({
        dailyPlanItemId: String(row.daily_plan_item_id),
        isCorrect: row.is_correct === true,
        confidenceLevel: typeof row.confidence_level === "string" ? row.confidence_level : null,
        topicId: typeof row.topic_id === "string" ? row.topic_id : null,
        topicName: typeof row.topic_name === "string" ? row.topic_name : null,
        topicArchived: row.topic_archived === true,
      }));
  }
}
