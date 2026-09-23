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
 * The result contains a responder count and a coarse incorrect-rate bucket only — no interpretation, no
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

/**
 * Deliberately NOT exact correct/incorrect counts: exact numbers would let
 * an authorized instructor infer one learner's answer by differencing two
 * sequential manual refreshes. The rate is a coarse bucket (nearest 10
 * percentage points) and the exact correct count never leaves this
 * function. Item Analysis is intended to be refreshed after a group
 * answering window, not after each individual learner response.
 */
export const INCORRECT_RATE_BUCKET_PERCENT = 10;

export interface ItemAnalysisStats {
  distinctResponderCount: number;
  /** Incorrect rate rounded to the nearest 10 percentage points (0, 10, ... 100). */
  approximateIncorrectRatePercent: number;
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
    const exactRatePercent =
      ((row.distinctResponderCount - row.correctCount) / row.distinctResponderCount) * 100;
    return {
      questionId: row.questionId,
      questionVersionId: row.questionVersionId,
      prompt: row.prompt,
      disclosure,
      stats: {
        distinctResponderCount: row.distinctResponderCount,
        approximateIncorrectRatePercent:
          Math.round(exactRatePercent / INCORRECT_RATE_BUCKET_PERCENT) * INCORRECT_RATE_BUCKET_PERCENT,
      },
    };
  });

  return { outcome: "READY", generatedAt: command.now, items };
}
