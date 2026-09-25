/**
 * getCourseItemAnalysis — aggregate-only, current-QuestionVersion-only Item
 * Analysis for an authorized OWNER/active INSTRUCTOR of one ACTIVE
 * (PUBLISHED) Course. Part of the "ניתוח תשובות" surface (Run 009 S3).
 *
 * ## Authorization / Course state
 * `checkAnalysisAccess` (`analysis-access.ts`), shared with Topic Insights.
 *
 * ## Disclosure (F-02, Run 009 D1)
 * Thresholds live only in `domain/insights/aggregate-disclosure.ts`. An item
 * that is not ELIGIBLE is `INSUFFICIENT_DATA` with `band: null` — the reason
 * (Course too small vs too few responses) is collapsed so it cannot leak,
 * and no classification is returned. An ELIGIBLE item carries only a coarse
 * descriptive `band` over its first accepted answers. Responder counts,
 * correct counts, and rates are used internally and NEVER returned — not
 * exact, not bucketed, not as a percentage. No learner identity and no
 * per-option data. `actorUserId` is trusted as-is at this boundary (see
 * `src/application/course/join-course.ts`).
 */
import { deriveAnswerBand, type AnswerBand } from "../../domain/insights/answer-band";
import {
  decideAggregateDisclosure,
  toPublicDisclosure,
  type PublicDisclosure,
} from "../../domain/insights/aggregate-disclosure";
import { checkAnalysisAccess } from "./analysis-access";
import type { ItemAnalysisRepositories } from "./ports";

export interface GetCourseItemAnalysisCommand {
  actorUserId: string;
  courseId: string;
  /** Explicit read instant, echoed back for the "last updated" display. */
  now: Date;
}

export interface ItemAnalysisItem {
  questionId: string;
  questionVersionId: string;
  prompt: string;
  disclosure: PublicDisclosure;
  /** Non-null only when `disclosure === "ELIGIBLE"`. */
  band: AnswerBand | null;
}

export type GetCourseItemAnalysisResult =
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_ACTIVE" }
  | { outcome: "READY"; generatedAt: Date; items: ItemAnalysisItem[] };

export async function getCourseItemAnalysis(
  command: GetCourseItemAnalysisCommand,
  repos: ItemAnalysisRepositories,
): Promise<GetCourseItemAnalysisResult> {
  const access = await checkAnalysisAccess(command.actorUserId, command.courseId, repos);
  if (access !== "ALLOWED") {
    return { outcome: access };
  }

  const [activeLearnerCount, rows] = await Promise.all([
    repos.itemAnalysis.countActiveLearners(command.courseId),
    repos.itemAnalysis.listCurrentVersionItemStats(command.courseId),
  ]);

  const items: ItemAnalysisItem[] = rows.map((row) => {
    const disclosure = toPublicDisclosure(
      decideAggregateDisclosure({
        activeLearnerCount,
        distinctResponderCount: row.distinctResponderCount,
      }),
    );
    return {
      questionId: row.questionId,
      questionVersionId: row.questionVersionId,
      prompt: row.prompt,
      disclosure,
      band:
        disclosure === "ELIGIBLE"
          ? deriveAnswerBand(row.correctCount, row.distinctResponderCount)
          : null,
    };
  });

  return { outcome: "READY", generatedAt: command.now, items };
}
