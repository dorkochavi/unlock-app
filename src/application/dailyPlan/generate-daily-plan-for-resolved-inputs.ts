/**
 * generateDailyPlanForResolvedInputs — the INTERNAL DailyPlan generation
 * core (ADR-016 §1/§2/§5).
 *
 * This is NOT the public long-term application API. It takes an explicit,
 * caller-supplied `eligibleCourseIds` list rather than deriving it from
 * CourseMembership — that derivation, plus persisted-timezone ->
 * `plannedForDate` resolution, belongs to a later, separate public entry
 * point (`getOrCreateDailyPlanForToday`, not implemented by this slice)
 * that will call this function once it has resolved both inputs. Keeping
 * this function's own contract free of timezone/membership concerns keeps
 * it a pure, deterministic-given-its-inputs orchestration core, testable in
 * isolation from either resolution step. It is deliberately NOT exposed as
 * a course-scoped DailyPlan API — `eligibleCourseIds` only selects which
 * Courses' candidates are POOLED INTO the one canonical `(userId,
 * plannedForDate)` DailyPlan; it never creates a separate, Course-keyed
 * plan (ADR-016 §1: "Course Today is NOT a separate plan").
 *
 * Orchestrates the SAME already-existing pure domain pipeline
 * `getOrCreateTodaySession` uses
 * (`src/application/learning/today-session.ts`):
 * generateNextBestActionCandidates -> rankNextBestActionCandidates ->
 * generateTodayPlan — extended here to run ONCE over a pool merged across
 * every `eligibleCourseId`, per
 * `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` Slice 1's own documented
 * plan ("repeated calls, concatenated... needs no port change"). No
 * changes to any of those three domain functions, and no `courseId` field
 * added to any domain candidate/plan-item type — `courseId` is recovered
 * here, from information this file's own per-Course progress-fetch loop
 * already has for free (a Question belongs to exactly one Course), not via
 * a second lookup.
 *
 * Freeze/idempotency semantics mirror `getOrCreateTodaySession` exactly:
 * this function only ever CREATES a plan when `findByKey` finds none; it
 * never regenerates or reorders an existing one, and
 * `DailyPlanRepository.createIfNotExists` is itself race-free by
 * construction (`INSERT ... ON CONFLICT DO NOTHING RETURNING` + fallback
 * `SELECT`, mirroring ADR-010's established pattern) — no additional
 * locking is needed here, matching `today-session.ts`'s own documented
 * reasoning for why its equivalent call needs none either. Whatever
 * `createIfNotExists` returns is returned as-is, including when it is the
 * winner of a concurrent race rather than this call's own locally
 * generated plan/items.
 */
import {
  generateNextBestActionCandidates,
  type NextBestActionContext,
} from "../../domain/learning/next-best-action";
import { rankNextBestActionCandidates } from "../../domain/learning/next-best-action-ranking";
import {
  generateTodayPlan,
  type TodayPlannerPolicy,
} from "../../domain/learning/today-planner";
import type { MemoryScheduler } from "../../domain/learning/scheduler";
import type { UserQuestionProgress } from "../../domain/learning/types";
import {
  NEW_MATERIAL_ACTION_TYPE,
  NEW_MATERIAL_TIER,
  UNSEEN_MATERIAL_REASON,
  type DailyPlan,
  type DailyPlanItem,
  type DailyPlanTransactionalRepositories,
  type DailyPlanUnitOfWork,
  type UnseenQuestionCandidate,
} from "./ports";

/**
 * ADR-017 §3: fixed V1 count, not a configurable policy value — deliberately
 * simpler than `TodayPlannerPolicy`'s injectable knobs, since this is a
 * one-shot fallback constant the ADR itself fixes for V1, not a calibration
 * surface any caller currently needs to vary.
 */
const MAX_NEW_MATERIAL_ITEMS = 3;

/**
 * ADR-017 §2/§3/§4: the fallback-only new-material discovery path — reached
 * ONLY when `ranked` (the ordinary next-best-action pool) is empty for this
 * learner today. Merges each eligible Course's own (already-limited, already
 * deterministically-ordered) result set and re-sorts globally by
 * `(createdAt, questionId)` before taking the final top-N — a Course-level
 * `LIMIT` alone cannot guarantee the correct GLOBAL top-N across multiple
 * Courses on its own.
 */
async function discoverNewMaterialItems(
  userId: string,
  eligibleCourseIds: string[],
  repos: DailyPlanTransactionalRepositories,
): Promise<Array<Omit<DailyPlanItem, "id" | "dailyPlanId">>> {
  const pooled: UnseenQuestionCandidate[] = [];
  for (const courseId of eligibleCourseIds) {
    const candidates = await repos.unseenQuestions.findUnseenQuestions(
      userId,
      courseId,
      MAX_NEW_MATERIAL_ITEMS,
    );
    pooled.push(...candidates);
  }

  pooled.sort((a, b) => {
    const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
    if (byCreatedAt !== 0) return byCreatedAt;
    return a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0;
  });

  return pooled.slice(0, MAX_NEW_MATERIAL_ITEMS).map((candidate, index) => ({
    userId,
    courseId: candidate.courseId,
    position: index,
    questionId: candidate.questionId,
    questionVersionId: candidate.questionVersionId,
    actionType: NEW_MATERIAL_ACTION_TYPE,
    tier: NEW_MATERIAL_TIER,
    otherApplicableTypes: [],
    reasons: [UNSEEN_MATERIAL_REASON],
    status: "pending",
    resolvedAt: null,
    completedAt: null,
  }));
}

export interface DailyPlanGenerationContext {
  now: Date;
  engineVersion: string;
  memoryScheduler: MemoryScheduler;
  todayPlannerPolicy: TodayPlannerPolicy;
}

export interface GenerateDailyPlanForResolvedInputsCommand {
  userId: string;
  /** ISO calendar-date string (YYYY-MM-DD) — already resolved by the caller. */
  plannedForDate: string;
  /**
   * Already-resolved, caller-supplied set of Courses to pool candidates
   * from. This function does NOT decide eligibility (active/non-archived/
   * non-revoked membership) — that is the future public entry point's job.
   * An empty array is valid input, not an error — see "Empty plan" in the
   * module doc comment.
   */
  eligibleCourseIds: string[];
}

export async function generateDailyPlanForResolvedInputs(
  command: GenerateDailyPlanForResolvedInputsCommand,
  context: DailyPlanGenerationContext,
  uow: DailyPlanUnitOfWork,
): Promise<DailyPlan> {
  return uow.runInTransaction(async (repos) => {
    const existing = await repos.dailyPlans.findByKey({
      userId: command.userId,
      plannedForDate: command.plannedForDate,
    });
    if (existing !== null) {
      return existing;
    }

    // Course-scoped pooling: `UserQuestionProgressRepository.listForUser`
    // is already Course-scoped (ADR-011), called once per eligible Course
    // and concatenated — per Slice 1, zero changes needed to the port
    // itself. `questionCourseId` is recorded here, from information this
    // loop already has for free, rather than via a second lookup later —
    // a Question belongs to exactly one Course, so the courseId a progress
    // row was fetched under IS that Question's Course.
    //
    // `eligibleCourseIds` is deduplicated (Set preserves first-seen/
    // insertion order) before iterating — a repeated courseId would
    // otherwise call `listForUser` twice and pool the same progress rows
    // twice, producing duplicate candidates for the same Question and
    // leaking into the persisted item's `otherApplicableTypes`.
    const eligibleCourseIds = [...new Set(command.eligibleCourseIds)];

    const progresses: UserQuestionProgress[] = [];
    const questionCourseId = new Map<string, string>();
    for (const courseId of eligibleCourseIds) {
      const courseProgress = await repos.progress.listForUser(
        command.userId,
        courseId,
      );
      for (const progress of courseProgress) {
        // Defensive only — real schema (`questions.course_id NOT NULL`)
        // makes a Question belonging to two Courses unreachable; this
        // guards against a malformed/buggy repository implementation
        // silently mis-attributing an item's courseId instead of failing
        // loudly.
        const existingCourseId = questionCourseId.get(progress.questionId);
        if (existingCourseId !== undefined && existingCourseId !== courseId) {
          throw new Error(
            `generateDailyPlanForResolvedInputs: questionId ` +
              `${progress.questionId} was returned under conflicting ` +
              `courseIds ("${existingCourseId}" and "${courseId}") — a ` +
              `Question must belong to exactly one Course; this indicates ` +
              `a UserQuestionProgressRepository.listForUser bug`,
          );
        }
        questionCourseId.set(progress.questionId, courseId);
      }
      progresses.push(...courseProgress);
    }

    const nbaContext: NextBestActionContext = {
      now: context.now,
      memoryScheduler: context.memoryScheduler,
    };
    const candidates = progresses.flatMap((progress) =>
      generateNextBestActionCandidates(progress, nbaContext),
    );
    // Ranked ONCE, globally, across the merged multi-Course pool — no
    // per-Course quota, no fairness balancing, no per-Course planning
    // (ADR-016 §9/§10). rankNextBestActionCandidates/generateTodayPlan
    // carry no courseId concept at all and are called completely
    // unmodified.
    const ranked = rankNextBestActionCandidates(candidates, { now: context.now });

    let items: Array<Omit<DailyPlanItem, "id" | "dailyPlanId">>;

    if (ranked.length > 0) {
      const plan = generateTodayPlan(
        { rankedCandidates: ranked, plannedForDate: command.plannedForDate },
        context.todayPlannerPolicy,
      );

      // QuestionVersion resolution/freezing is an application-layer
      // responsibility, not today-planner.ts's (ADR-010) — identical
      // reasoning and identical defensive skip to getOrCreateTodaySession: a
      // Question with no current version is skipped rather than crashing the
      // whole generation. `planItem.position` (below) is reused as-is, so a
      // skipped Question can leave a gap in persisted positions (e.g.
      // [0,1,2,4]) rather than being renumbered contiguously — intentional,
      // matching getOrCreateTodaySession's identical existing behavior; the
      // schema has no contiguity constraint and nothing reads position as a
      // dense sequence.
      items = [];
      for (const planItem of plan.items) {
        const version = await repos.questionVersions.getCurrentVersion(
          planItem.questionId,
        );
        if (version === null) {
          continue;
        }
        const courseId = questionCourseId.get(planItem.questionId);
        if (courseId === undefined) {
          // Unreachable: every ranked candidate originated from a progress
          // row fetched under some eligibleCourseId, recorded above before
          // ranking ever ran — surfaced loudly rather than silently, in
          // case that invariant is ever broken by a future change.
          throw new Error(
            `generateDailyPlanForResolvedInputs: no courseId recorded for ` +
              `questionId ${planItem.questionId} — this should be unreachable`,
          );
        }
        items.push({
          userId: command.userId,
          courseId,
          position: planItem.position,
          questionId: planItem.questionId,
          questionVersionId: version.versionId,
          actionType: planItem.actionType,
          tier: planItem.tier,
          otherApplicableTypes: planItem.otherApplicableTypes,
          reasons: planItem.reasons,
          status: "pending",
          resolvedAt: null,
          completedAt: null,
        });
      }
    } else {
      // ADR-017 §2: fallback-only new-material exposure — reached ONLY
      // when zero ordinary next-best-action candidates exist for this
      // learner today. Never mixed with the branch above in the same plan.
      items = await discoverNewMaterialItems(
        command.userId,
        eligibleCourseIds,
        repos,
      );
    }

    // No filler is ever fabricated when `items` is empty (zero eligible
    // Courses, zero progress, zero ranked candidates, AND zero eligible
    // unseen questions) — a zero-item DailyPlan is still persisted,
    // mirroring getOrCreateTodaySession's own unconditional
    // createIfNotExists call. Skipping persistence here would break "a
    // second Today view opened later the same day resumes the
    // already-generated plan" (ADR-016 §2) for a legitimately-empty day.
    return repos.dailyPlans.createIfNotExists(
      {
        userId: command.userId,
        plannedForDate: command.plannedForDate,
        status: "prepared",
        engineVersion: context.engineVersion,
        generatedAt: context.now,
        startedAt: null,
        completedAt: null,
      },
      items,
    );
  });
}
