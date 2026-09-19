/**
 * Route-layer DTO for `GET /api/daily-plan/today` — never returns the raw
 * `DailyPlan`/`DailyPlanItem` domain types directly over the wire.
 *
 * Uses ONLY fields that actually exist on `DailyPlan`/`DailyPlanItem`
 * (`src/application/dailyPlan/ports.ts`) — no invented `score` field (this
 * codebase's ranking model is deliberately tier-based, not numeric-score-
 * based — see `next-best-action-ranking.ts`'s own doc comment for why no
 * such field exists anywhere in the domain to expose), no invented
 * `recommendationType`/`reason` singular fields (the real fields are
 * `actionType` and `reasons`, plural).
 *
 * Deliberately DROPPED, as internal/redundant for the first UI:
 * - `DailyPlan.userId` / `DailyPlanItem.userId` — always the authenticated
 *   caller; the client already knows who it is.
 * - `DailyPlanItem.dailyPlanId` — redundant once items are nested under
 *   their own plan in this response shape.
 *
 * `Date` fields are serialized to ISO 8601 strings (the wire format);
 * `resolvedAt`/`startedAt`/`completedAt` stay `null` exactly when the
 * domain value is `null`, never coerced to an empty string or omitted.
 *
 * ## Learner-facing question content (`questionType`/`prompt`/`answerOptions`)
 *
 * `toDailyPlanDto`/`toDailyPlanItemDto` take a SEPARATE
 * `contentByVersionId` map, loaded by the caller (`handle-get-daily-plan
 * -today.ts`) via `LearnerQuestionContentRepository` — a dedicated read
 * path that never selects `correct_answer` (see that port's own doc
 * comment). This file's job is only to merge that already-safe content
 * into the response by the item's exact `questionVersionId`; it never reads
 * `question_versions` itself and has no way to reach `correct_answer`, by
 * construction. `toDailyPlanItemDto` THROWS if `contentByVersionId` is
 * missing an entry for an item's `questionVersionId` — it never silently
 * omits the fields or substitutes another version's content.
 */
import type { DailyPlan, DailyPlanItem } from "../../../../application/dailyPlan/ports";
import type { LearnerQuestionContent } from "../../../../application/learning/ports";

export interface AnswerOptionDto {
  id: string;
  content: string;
}

export interface DailyPlanItemDto {
  id: string;
  position: number;
  courseId: string;
  questionId: string;
  questionVersionId: string;
  actionType: string;
  tier: string;
  otherApplicableTypes: string[];
  reasons: string[];
  status: string;
  resolvedAt: string | null;
  completedAt: string | null;
  questionType: string;
  prompt: string;
  answerOptions: AnswerOptionDto[];
}

export interface DailyPlanDto {
  id: string;
  plannedForDate: string;
  status: string;
  engineVersion: string;
  generatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  items: DailyPlanItemDto[];
}

function toDailyPlanItemDto(
  item: DailyPlanItem,
  contentByVersionId: ReadonlyMap<string, LearnerQuestionContent>,
): DailyPlanItemDto {
  const content = contentByVersionId.get(item.questionVersionId);
  if (content === undefined) {
    // Never reached in production: `handle-get-daily-plan-today.ts` loads
    // content for every item's exact `questionVersionId` before calling
    // this function and maps a genuine gap to its own INTERNAL_ERROR
    // response rather than calling this at all. This throw is a second,
    // independent guard against ever silently omitting/substituting
    // content — see this file's module doc comment.
    throw new Error(
      `toDailyPlanItemDto: no learner-facing content supplied for questionVersionId "${item.questionVersionId}"`,
    );
  }
  return {
    id: item.id,
    position: item.position,
    courseId: item.courseId,
    questionId: item.questionId,
    questionVersionId: item.questionVersionId,
    actionType: item.actionType,
    tier: item.tier,
    otherApplicableTypes: item.otherApplicableTypes,
    reasons: item.reasons,
    status: item.status,
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
    completedAt: item.completedAt?.toISOString() ?? null,
    questionType: content.questionType,
    prompt: content.prompt,
    answerOptions: content.options,
  };
}

export function toDailyPlanDto(
  plan: DailyPlan,
  contentByVersionId: ReadonlyMap<string, LearnerQuestionContent>,
): DailyPlanDto {
  return {
    id: plan.id,
    plannedForDate: plan.plannedForDate,
    status: plan.status,
    engineVersion: plan.engineVersion,
    generatedAt: plan.generatedAt.toISOString(),
    startedAt: plan.startedAt?.toISOString() ?? null,
    completedAt: plan.completedAt?.toISOString() ?? null,
    items: plan.items.map((item) => toDailyPlanItemDto(item, contentByVersionId)),
  };
}
