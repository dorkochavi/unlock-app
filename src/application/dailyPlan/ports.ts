/**
 * Persistence port for the DailyPlan application layer — ADR-016 §1/§19.
 *
 * Deliberately mirrors `src/application/learning/ports.ts`'s
 * `TodaySession`/`TodaySessionItem`/`TodaySessionRepository` shape closely:
 * DailyPlan is the accepted TARGET architecture superseding TodaySession's
 * per-Course key (ADR-016 §1), not a conceptually different thing. The one
 * structural difference: `courseId` lives on each `DailyPlanItem`
 * independently, not on a single parent session.
 *
 * Candidate generation/multi-Course pooling now exists —
 * `generate-daily-plan-for-resolved-inputs.ts` (internal generation core
 * only, not the public entry point; see that file's own doc comment) — and
 * this file additionally carries that generation core's own transaction
 * contract (`DailyPlanTransactionalRepositories`/`DailyPlanUnitOfWork`,
 * below). Still NOT implemented: a `PostgresDailyPlanUnitOfWork`, the
 * public timezone/membership-driven entry point, and any wiring into
 * `submitAnswer` — see `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` step 6
 * for what remains before this is used end-to-end.
 */
import {
  NEXT_BEST_ACTION_REASONS,
  NEXT_BEST_ACTION_TYPES,
  type NextBestActionType,
} from "../../domain/learning/next-best-action";
import { NEXT_BEST_ACTION_PRIORITY_TIERS } from "../../domain/learning/next-best-action-ranking";
import type { DailyPlanItemStatus } from "../../domain/dailyPlan/types";
import type {
  QuestionVersionRepository,
  UserQuestionProgressRepository,
} from "../learning/ports";

/**
 * ADR-017 (Starter / New-Material Exposure V1): the PERSISTED
 * `DailyPlanItem` shape is a strict superset of `next-best-action.ts`'s own
 * `NextBestActionType`/`NextBestActionReason` and
 * `next-best-action-ranking.ts`'s `NextBestActionPriorityTier` —
 * deliberately. Those domain files stay scoped to "candidate generation
 * only, 4 of 7 types" (their own doc comments) and are UNCHANGED by this
 * ADR; `generateNextBestActionCandidates` never produces a `NEW_LEARNING`
 * candidate. `NEW_LEARNING`/`NEW_MATERIAL`/`UNSEEN_MATERIAL` exist ONLY as
 * values a `DailyPlanItem` can carry, produced exclusively by the
 * fallback-only new-material selection path in
 * `generate-daily-plan-for-resolved-inputs.ts` — never by ranking.
 */
export const NEW_MATERIAL_ACTION_TYPE = "NEW_LEARNING" as const;
export const NEW_MATERIAL_TIER = "NEW_MATERIAL" as const;
export const UNSEEN_MATERIAL_REASON = "UNSEEN_MATERIAL" as const;

export const DAILY_PLAN_ITEM_ACTION_TYPES = [
  ...NEXT_BEST_ACTION_TYPES,
  NEW_MATERIAL_ACTION_TYPE,
] as const;
export type DailyPlanItemActionType = (typeof DAILY_PLAN_ITEM_ACTION_TYPES)[number];

export const DAILY_PLAN_ITEM_TIERS = [
  ...NEXT_BEST_ACTION_PRIORITY_TIERS,
  NEW_MATERIAL_TIER,
] as const;
export type DailyPlanItemTier = (typeof DAILY_PLAN_ITEM_TIERS)[number];

export const DAILY_PLAN_ITEM_REASONS = [
  ...NEXT_BEST_ACTION_REASONS,
  UNSEEN_MATERIAL_REASON,
] as const;
export type DailyPlanItemReason = (typeof DAILY_PLAN_ITEM_REASONS)[number];

export interface DailyPlanItem {
  id: string;
  dailyPlanId: string;
  userId: string;
  courseId: string;
  position: number;
  questionId: string;
  questionVersionId: string;
  actionType: DailyPlanItemActionType;
  tier: DailyPlanItemTier;
  /** Never includes `NEW_LEARNING` — that concept has no "other applicable type" notion in V1. */
  otherApplicableTypes: NextBestActionType[];
  reasons: DailyPlanItemReason[];
  status: DailyPlanItemStatus;
  /** Set once, the first time this item leaves `pending` (ADR-016 §19). */
  resolvedAt: Date | null;
  /** Set only for a COMPLETED item — equals `resolvedAt` in that case. */
  completedAt: Date | null;
}

/**
 * ADR-017 §1/§4: one eligible unseen Question (no prior real Attempt),
 * already carrying its current `QuestionVersion` id (resolved in the same
 * query, avoiding a second per-question lookup) and `createdAt` for the
 * deterministic global tie-break across multiple eligible Courses —
 * `generate-daily-plan-for-resolved-inputs.ts` merges each Course's own
 * (already-limited) result set and re-sorts globally before taking the
 * final top-N.
 */
export interface UnseenQuestionCandidate {
  questionId: string;
  courseId: string;
  questionVersionId: string;
  createdAt: Date;
}

export interface UnseenQuestionRepository {
  /**
   * Deterministic order (`created_at` asc, `id` asc — ADR-017 §4), limited
   * to `limit` rows. Excludes any Question the learner has a real Attempt
   * for (ADR-017 §1) and any Question with no resolvable current
   * `QuestionVersion`. Selects only non-grading fields.
   */
  findUnseenQuestions(
    userId: string,
    courseId: string,
    limit: number,
  ): Promise<UnseenQuestionCandidate[]>;
}

export interface DailyPlan {
  id: string;
  userId: string;
  plannedForDate: string;
  status: string;
  engineVersion: string;
  generatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  items: DailyPlanItem[];
}

export interface DailyPlanKey {
  userId: string;
  plannedForDate: string;
}

/**
 * Outcome of resolving (completing or skipping) a DailyPlanItem. ADR-016
 * §19 requires a distinct, typed outcome for the already-resolved case —
 * never a silent success, never a silently-discarded second resolution.
 */
export type ResolveDailyPlanItemResult =
  | { outcome: "RESOLVED"; item: DailyPlanItem }
  | { outcome: "ALREADY_RESOLVED"; item: DailyPlanItem }
  | { outcome: "NOT_FOUND" };

export interface DailyPlanRepository {
  findByKey(key: DailyPlanKey): Promise<DailyPlan | null>;

  /**
   * Race-free by construction (`INSERT ... ON CONFLICT (user_id,
   * planned_for_date) DO NOTHING RETURNING` + fallback `SELECT`, mirroring
   * `TodaySessionRepository.createIfNotExists`/ADR-010's established
   * pattern). Returns the newly-created plan, or the existing one if
   * another concurrent call won the race for the same key — the
   * caller-supplied `plan`/`items` are silently discarded in that case,
   * exactly as `TodaySessionRepository.createIfNotExists` already
   * documents for its own contract.
   */
  createIfNotExists(
    plan: Omit<DailyPlan, "items" | "id">,
    items: Array<Omit<DailyPlanItem, "id" | "dailyPlanId">>,
  ): Promise<DailyPlan>;

  findItemById(itemId: string): Promise<DailyPlanItem | null>;

  /**
   * Resolves a `pending` item as COMPLETED. Enforces ADR-016 §19's
   * single-use rule: an item that is already `completed` or `skipped`
   * returns `ALREADY_RESOLVED` with its current (unchanged) state, never a
   * silent overwrite. Returns `NOT_FOUND` if no item exists for `itemId`.
   */
  markCompleted(
    itemId: string,
    completedAt: Date,
  ): Promise<ResolveDailyPlanItemResult>;

  /**
   * Resolves a `pending` item as SKIPPED. Same single-use enforcement as
   * `markCompleted`. Never creates an Attempt and never touches
   * `UserQuestionProgress` — this port has no way to, since it only ever
   * issues an `UPDATE daily_plan_items`.
   */
  markSkipped(
    itemId: string,
    skippedAt: Date,
  ): Promise<ResolveDailyPlanItemResult>;
}

/**
 * Transaction contract for DailyPlan GENERATION only (ADR-016 §1/§2) — used
 * by `generateDailyPlanForResolvedInputs`
 * (`generate-daily-plan-for-resolved-inputs.ts`), not by the persistence
 * port above on its own.
 *
 * Deliberately does NOT reuse `src/application/learning/ports.ts`'s
 * `UnitOfWork`/`TransactionalRepositories` types: DailyPlan generation's
 * read set (`UserQuestionProgress`, `QuestionVersion`) does not overlap
 * with `submitAnswer`'s write set (`Attempt`, `UserQuestionProgress`
 * writes, `TodaySessionItem` writes) and needs no advisory lock (mirroring
 * `getOrCreateTodaySession`'s own reasoning for why its equivalent call
 * needs none either) — reusing that type would couple
 * `application/dailyPlan` to `application/learning`'s own transaction
 * shape for no benefit. The individual repository PORT interfaces
 * (`UserQuestionProgressRepository`, `QuestionVersionRepository`) are
 * reused directly, unchanged, from `application/learning/ports.ts` — only
 * the UnitOfWork/TransactionalRepositories wrapper itself is new.
 */
export interface DailyPlanTransactionalRepositories {
  dailyPlans: DailyPlanRepository;
  progress: UserQuestionProgressRepository;
  questionVersions: QuestionVersionRepository;
  /** ADR-017 — only read when the ranked-candidate pool is empty. */
  unseenQuestions: UnseenQuestionRepository;
}

export interface DailyPlanUnitOfWork {
  /**
   * Runs `fn` inside one database transaction — mirrors
   * `application/learning/ports.ts`'s `UnitOfWork.runInTransaction`
   * contract exactly (any thrown error rolls the whole transaction back;
   * nothing partial is ever committed) without importing that file's
   * types. No Postgres implementation exists yet — a later slice.
   */
  runInTransaction<T>(
    fn: (repos: DailyPlanTransactionalRepositories) => Promise<T>,
  ): Promise<T>;
}
