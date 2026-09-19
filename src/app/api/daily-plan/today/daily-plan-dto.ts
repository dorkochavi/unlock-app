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
 */
import type { DailyPlan, DailyPlanItem } from "../../../../application/dailyPlan/ports";

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

function toDailyPlanItemDto(item: DailyPlanItem): DailyPlanItemDto {
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
  };
}

export function toDailyPlanDto(plan: DailyPlan): DailyPlanDto {
  return {
    id: plan.id,
    plannedForDate: plan.plannedForDate,
    status: plan.status,
    engineVersion: plan.engineVersion,
    generatedAt: plan.generatedAt.toISOString(),
    startedAt: plan.startedAt?.toISOString() ?? null,
    completedAt: plan.completedAt?.toISOString() ?? null,
    items: plan.items.map(toDailyPlanItemDto),
  };
}
