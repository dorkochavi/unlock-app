/**
 * PostgreSQL implementation of `UnseenQuestionRepository`
 * (`src/application/dailyPlan/ports.ts`) — ADR-017 (Starter / New-Material
 * Exposure V1).
 *
 * SECURITY/CORRECTNESS-SENSITIVE, stated explicitly: the SQL text below is
 * the actual enforcement point for "unseen" (ADR-017 §1 — no prior real
 * Attempt for that Question, checked via `NOT EXISTS` against `attempts`,
 * never inferred from `user_question_progress` row absence) and for "has a
 * resolvable current QuestionVersion" (`current_version_id is not null`).
 * The query also resolves `question_version_id` directly (a plain join on
 * `questions.current_version_id`) rather than requiring a second per-question
 * lookup — avoiding the N+1 pattern the normal candidate path already
 * avoids for `UserQuestionProgress`. Selects no grading-only field.
 *
 * RUN010-E — Topic-diversifying selection (bounded, envelope-preserving,
 * evidence-backed fix; see `docs/FOLLOW_UP_BACKLOG.md` for the investigation
 * this responds to): the PREVIOUS ordering (`created_at asc, id asc` only,
 * globally per Course) had no Topic awareness at all — a Course whose
 * oldest-created unseen Questions all happened to belong to one Topic would
 * have its ENTIRE New-Material fallback (all `limit`, typically 3, slots)
 * drawn from that single Topic every time, silently starving every other
 * Topic of any early calibration evidence for as long as that Topic still
 * had unseen material left. Authoring order (`created_at`) has no
 * pedagogical meaning for calibration representativeness, so this was pure
 * accident, not a deliberate choice.
 *
 * Fix: round-robin by `topic_id` via `row_number() over (partition by
 * topic_id order by created_at asc, id asc)`, then order by that rank first
 * (so every distinct Topic contributes its own earliest-created eligible
 * Question before any Topic contributes a second) and by `topic_id`/
 * `question_id` only as a final deterministic tie-break. `topic_id` is
 * nullable indefinitely (pre-authoring-model Questions, or a draft with no
 * Topic chosen — see `20260928000000_question_authoring_v1.sql`); PostgreSQL
 * partitions NULL as its own single group, so "no Topic assigned" is simply
 * treated as one more Topic-like bucket in the round-robin, never excluded
 * and never given special priority.
 *
 * Still strictly `unseen`-only, still capped by the caller's `limit`
 * (unchanged — ADR-017's fixed V1 `MAX_NEW_MATERIAL_ITEMS = 3`, not raised
 * or lowered here), still fully deterministic given the same DB state, and
 * still scoped to ONE Course's own candidate set — this does not touch
 * `generate-daily-plan-for-resolved-inputs.ts`'s existing cross-Course
 * pooling re-sort (by `createdAt` only), which stays a Course-count
 * concern, not a Topic concern (see that file's own doc comment on why a
 * per-Course `LIMIT` alone can't guarantee the correct global top-N). A
 * learner with material in MULTIPLE simultaneously-eligible Courses can
 * therefore still see the cross-Course step partially override one
 * Course's own Topic-diversified order — an explicitly acknowledged,
 * bounded residual gap (not a per-Course fairness quota, which ADR-017
 * still forbids), recorded in `docs/FOLLOW_UP_BACKLOG.md` rather than
 * solved here.
 */
import type {
  UnseenQuestionCandidate,
  UnseenQuestionRepository,
} from "../../application/dailyPlan/ports";
import { readDate, readString } from "./row-validation";
import type { TransactionExecutor } from "./sql-executor";

const TABLE = "questions";

export class PostgresUnseenQuestionRepository implements UnseenQuestionRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async findUnseenQuestions(
    userId: string,
    courseId: string,
    limit: number,
  ): Promise<UnseenQuestionCandidate[]> {
    const result = await this.db.query(
      `with eligible as (
         select q.id as question_id, q.course_id, q.current_version_id as question_version_id,
                q.created_at, q.topic_id,
                row_number() over (
                  partition by q.topic_id
                  order by q.created_at asc, q.id asc
                ) as topic_rank
           from questions q
          where q.course_id = $1
            and q.current_version_id is not null
            and not exists (
              select 1 from attempts a
               where a.user_id = $2 and a.question_id = q.id
            )
       )
       select question_id, course_id, question_version_id, created_at
         from eligible
        order by topic_rank asc, topic_id asc nulls last, question_id asc
        limit $3`,
      [courseId, userId, limit],
    );
    return result.rows.map((row) => ({
      questionId: readString(row, TABLE, "question_id"),
      courseId: readString(row, TABLE, "course_id"),
      questionVersionId: readString(row, TABLE, "question_version_id"),
      createdAt: readDate(row, TABLE, "created_at"),
    }));
  }
}
