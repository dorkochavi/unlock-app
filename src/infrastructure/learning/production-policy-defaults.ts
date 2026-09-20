/**
 * Centralized production Learning Engine policy defaults — closes the gap
 * `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` found ("no
 * production default anywhere in src/", §1/§3/§8).
 *
 * Every value here is a CONSERVATIVE PRODUCTION DEFAULT, not a locked
 * product invariant — see the cited `docs/OPEN_QUESTIONS.md` entries for
 * what remains genuinely open (long-term calibration, not "whether to have
 * a value at all"). No value is invented fresh here: each one reuses,
 * transparently and without alteration, the same numbers this repo's own
 * domain/application test fixtures had already independently converged on
 * (`src/application/learning/__tests__/submit-answer.test.ts`,
 * `src/domain/learning/__tests__/learning-engine-golden-scenarios.test.ts`)
 * — a single canonical set, not a second competing one.
 *
 * Every exported policy object is `Object.freeze`d: these constants are
 * shared by reference across every `createProductionSubmitAnswerContext`/
 * `createProductionTodaySessionContext` call
 * (`src/infrastructure/learning/composition-root.ts`) in the same process,
 * not copied per call, so an accidental in-place mutation of one returned
 * context's policy field would otherwise silently corrupt every other
 * context built from the same defaults. Freezing makes that mutation throw
 * (`TypeError`, since this codebase's ES modules run in strict mode)
 * instead of silently succeeding — see
 * `src/infrastructure/learning/__tests__/composition-root.test.ts`'s
 * "production policy defaults are immutable" cases.
 */
import type { EvidenceStrengthPolicy } from "../../domain/learning/evidence-strength";
import type { MasteryPolicy } from "../../domain/learning/mastery";
import type { MisconceptionPolicy } from "../../domain/learning/misconception";
import type { RetrievalQualificationPolicy } from "../../domain/learning/retrieval-qualification";
import type { TodayPlannerPolicy } from "../../domain/learning/today-planner";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `docs/OPEN_QUESTIONS.md` #12: ENGINEERING CALIBRATION, not yet
 * product-locked. One day is the same starting point already used
 * consistently across this repo's own test fixtures.
 */
export const PRODUCTION_RETRIEVAL_QUALIFICATION_POLICY: RetrievalQualificationPolicy =
  Object.freeze({
    minGapMsForSpacedRetrieval: 1 * DAY_MS,
  });

/**
 * ENGINEERING CALIBRATION, with required product visibility (audit §7:
 * feeds `MasteryPolicy` directly, so not a pure engineering-only value) —
 * same numbers already used consistently across this repo's own test
 * fixtures.
 */
export const PRODUCTION_EVIDENCE_STRENGTH_POLICY: EvidenceStrengthPolicy =
  Object.freeze({
    minMeaningfulAttemptsForEarly: 1,
    minMeaningfulAttemptsForModerate: 3,
    minMeaningfulAttemptsForStrong: 5,
    minSpacedRetrievalsForModerate: 1,
    minSpacedRetrievalsForStrong: 3,
    minObservationSpanMsForStrong: 3 * DAY_MS,
  });

/**
 * `docs/OPEN_QUESTIONS.md` #11: accepted conservative production default
 * (Dor's product-owner review, `docs/LEARNING_ENGINE.md` §16b). "No
 * unresolved lapse" is enforced by the domain's own existing lapse-state
 * check (`src/domain/learning/lapse.ts`, applied in
 * `src/domain/learning/progress-update.ts`) — not a field here, so no
 * additional threshold is invented beyond what `MasteryPolicy`'s shape
 * already exposes.
 */
export const PRODUCTION_MASTERY_POLICY: MasteryPolicy = Object.freeze({
  minSpacedRetrievalsForStrengthening: 1,
  minSpacedRetrievalsForMastered: 3,
  minEvidenceStrengthForMastered: "strong",
  minRetrievabilityForMastered: 0.8,
});

/**
 * `docs/OPEN_QUESTIONS.md` #13: accepted illustrative candidate score
 * model, explicitly NOT product-locked. `activeScoreThreshold: 4` (more
 * than one `confidentErrorScoreIncrement`) is what actually implements the
 * accepted principle "one high-confidence wrong alone must not directly
 * create ACTIVE" — a single +2 increment only reaches
 * `suspectedScoreThreshold` (2), never `activeScoreThreshold` (4); reaching
 * ACTIVE requires at least two qualifying confident-error signals.
 */
export const PRODUCTION_MISCONCEPTION_POLICY: MisconceptionPolicy = Object.freeze({
  confidentErrorScoreIncrement: 2,
  recoveryScoreDecrement: 1,
  minScore: 0,
  maxScore: 10,
  suspectedScoreThreshold: 2,
  activeScoreThreshold: 4,
  resolvedScoreThreshold: 0,
});

/**
 * `docs/OPEN_QUESTIONS.md` #16 / ADR-016 §5 /
 * `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`: the accepted default DIRECTION is
 * dynamic sizing (minimum useful 5, typical 8-12, hard maximum 15) — NOT a
 * single fixed number. `src/domain/learning/today-planner.ts`'s current
 * architecture only exposes one `maxItems` truncation ceiling; it has no
 * tiered minimum/typical-range behavior. The DailyPlan path is implemented,
 * but the fuller dynamic-sizing model remains calibration/architecture work;
 * this composition root intentionally does not invent that missing behavior.
 * `maxItems` is set to the accepted HARD MAXIMUM (15), the conservative
 * ceiling this single-field shape can express: `generateTodayPlan` already
 * never fabricates filler items when fewer are ranked (its own "no filler"
 * rule), so this does not force a plan up to 15 when fewer are genuinely
 * justified — it only caps the upper bound.
 */
export const PRODUCTION_TODAY_PLANNER_POLICY: TodayPlannerPolicy = Object.freeze({
  maxItems: 15,
});

/**
 * `docs/OPEN_QUESTIONS.md` #10 (Engine Versioning Granularity, OPEN): a
 * single starting version string is required by every Attempt/
 * UserQuestionProgress write regardless of that open question's eventual
 * outcome. Not a claim that this granularity scheme is final.
 */
export const PRODUCTION_ENGINE_VERSION = "learning-engine-v1";
