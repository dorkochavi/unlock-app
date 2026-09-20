/**
 * Production composition root for the Learning Engine — the first place in
 * this repo that assembles a real `SubmitAnswerContext`/`TodaySessionContext`
 * from concrete production values
 * (`docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` §4/§8: no such
 * root existed anywhere in `src/` before this).
 *
 * No HTTP/API/UI wiring lives in this file. These factories return plain
 * production context objects for application/route composition to pass to
 * `submitAnswer` and the legacy `getOrCreateTodaySession` path. The current
 * DailyPlan flow reuses the same centralized Learning Engine defaults through
 * its own composition root rather than duplicating policy values here.
 *
 * `now` is a required, explicit parameter on every factory — neither
 * function reads the clock itself. This matches the domain layer's own
 * "never call `Date.now()` internally" discipline
 * (`src/domain/learning/progress-update.ts`'s `now` field), extended here
 * to composition-root code so a caller can always prove determinism and
 * never has a hidden clock dependency to reason about.
 */
import { randomUUID } from "node:crypto";

import type { SubmitAnswerContext } from "../../application/learning/submit-answer";
import type { TodaySessionContext } from "../../application/learning/today-session";
import { TsFsrsMemoryScheduler } from "./fsrs/ts-fsrs-memory-scheduler";
import {
  PRODUCTION_ENGINE_VERSION,
  PRODUCTION_EVIDENCE_STRENGTH_POLICY,
  PRODUCTION_MASTERY_POLICY,
  PRODUCTION_MISCONCEPTION_POLICY,
  PRODUCTION_RETRIEVAL_QUALIFICATION_POLICY,
  PRODUCTION_TODAY_PLANNER_POLICY,
} from "./production-policy-defaults";

/** Builds a real `SubmitAnswerContext` from production defaults. */
export function createProductionSubmitAnswerContext(
  now: Date,
): SubmitAnswerContext {
  return {
    now,
    engineVersion: PRODUCTION_ENGINE_VERSION,
    memoryScheduler: new TsFsrsMemoryScheduler(),
    retrievalQualificationPolicy: PRODUCTION_RETRIEVAL_QUALIFICATION_POLICY,
    evidenceStrengthPolicy: PRODUCTION_EVIDENCE_STRENGTH_POLICY,
    masteryPolicy: PRODUCTION_MASTERY_POLICY,
    misconceptionPolicy: PRODUCTION_MISCONCEPTION_POLICY,
    generateId: () => randomUUID(),
    // No anomaly-detection capability exists yet (docs/LEARNING_ENGINE.md
    // §10) — () => false is an honest "no signal available," matching
    // submit-answer.ts's own module doc comment, not an invented rule.
    determineSuspiciousTiming: () => false,
  };
}

/** Builds a real `TodaySessionContext` from production defaults. */
export function createProductionTodaySessionContext(
  now: Date,
): TodaySessionContext {
  return {
    now,
    engineVersion: PRODUCTION_ENGINE_VERSION,
    memoryScheduler: new TsFsrsMemoryScheduler(),
    todayPlannerPolicy: PRODUCTION_TODAY_PLANNER_POLICY,
  };
}
