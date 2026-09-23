/**
 * getCourseItemAnalysis — Pre-Pilot S2. Aggregate-only, current-
 * QuestionVersion-only Item Analysis for an authorized OWNER/active
 * INSTRUCTOR of one ACTIVE (PUBLISHED) Course.
 *
 * ## Authorization (fail closed)
 * Reuses `canAuthorCourse` exactly as `listQuestionsForCourse` does: a
 * missing, revoked, archived, or LEARNER membership is `NOT_AUTHORIZED`.
 * Membership is checked BEFORE Course status so a non-member learns nothing
 * about the Course's state.
 *
 * ## Active Course
 * "Active" reuses the DailyPlan meaning (`filterToPublishedCourseIds`):
 * `status === "PUBLISHED"`. DRAFT and ARCHIVED Courses return
 * `COURSE_NOT_ACTIVE` — the classroom view is not exposed for them.
 *
 * ## Disclosure
 * Thresholds live only in `domain/insights/aggregate-disclosure.ts`. When an
 * item is not ELIGIBLE its `stats` is `null`: no count, rate, or any other
 * derived number is returned, so a suppressed value cannot be recovered from
 * the payload. Zero-response items are simply not-ELIGIBLE ("no data yet").
 *
 * The result contains raw counts and a rate only — no interpretation, no
 * learner identity. `actorUserId` is trusted as-is at this boundary (see
 * `src/application/course/join-course.ts`).
 */
import { canAuthorCourse } from "../../domain/course/types";
import {
  decideAggregateDisclosure,
  type AggregateDisclosureDecision,
} from "../../domain/insights/aggregate-disclosure";
import type { ItemAnalysisRepositories } from "./ports";

export interface GetCourseItemAnalysisCommand {
  actorUserId: string;
  courseId: string;
  /** Explicit read instant, echoed back for the "last updated" display. */
  now: Date;
}

export interface ItemAnalysisStats {
  distinctResponderCount: number;
  correctCount: number;
  incorrectCount: number;
  /** Whole-number percent of responders who answered incorrectly (rounded). */
  incorrectRatePercent: number;
}

export interface ItemAnalysisItem {
  questionId: string;
  questionVersionId: string;
  prompt: string;
  disclosure: AggregateDisclosureDecision;
  /** Non-null only when `disclosure === "ELIGIBLE"`. */
  stats: ItemAnalysisStats | null;
}

export type GetCourseItemAnalysisResult =
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_ACTIVE" }
  | { outcome: "READY"; generatedAt: Date; items: ItemAnalysisItem[] };

export async function getCourseItemAnalysis(
  command: GetCourseItemAnalysisCommand,
  repos: ItemAnalysisRepositories,
): Promise<GetCourseItemAnalysisResult> {
  const membership = await repos.memberships.findMembership(command.actorUserId, command.courseId);
  if (membership === null || !canAuthorCourse(membership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const statuses = await repos.courses.listStatuses([command.courseId]);
  const course = statuses.find((entry) => entry.id === command.courseId);
  if (course === undefined || course.status !== "PUBLISHED") {
    return { outcome: "COURSE_NOT_ACTIVE" };
  }

  const [activeLearnerCount, rows] = await Promise.all([
    repos.itemAnalysis.countActiveLearners(command.courseId),
    repos.itemAnalysis.listCurrentVersionItemStats(command.courseId),
  ]);

  const items: ItemAnalysisItem[] = rows.map((row) => {
    const disclosure = decideAggregateDisclosure({
      activeLearnerCount,
      distinctResponderCount: row.distinctResponderCount,
    });
    if (disclosure !== "ELIGIBLE") {
      return {
        questionId: row.questionId,
        questionVersionId: row.questionVersionId,
        prompt: row.prompt,
        disclosure,
        stats: null,
      };
    }
    const incorrectCount = row.distinctResponderCount - row.correctCount;
    return {
      questionId: row.questionId,
      questionVersionId: row.questionVersionId,
      prompt: row.prompt,
      disclosure,
      stats: {
        distinctResponderCount: row.distinctResponderCount,
        correctCount: row.correctCount,
        incorrectCount,
        incorrectRatePercent: Math.round((incorrectCount / row.distinctResponderCount) * 100),
      },
    };
  });

  return { outcome: "READY", generatedAt: command.now, items };
}
