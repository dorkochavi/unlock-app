/**
 * getOrCreateTodaySession / getTodaySession — the application-layer use
 * cases for Today session generation/resume.
 *
 * Orchestrates the already-existing pure domain pipeline
 * (generateNextBestActionCandidates -> rankNextBestActionCandidates ->
 * generateTodayPlan) and persists its output; contains no ranking/planning
 * policy of its own.
 *
 * Today generation and Today execution are separate operations
 * (`docs/DATABASE.md` §19) — this file only ever CREATES a session when
 * `findByKey` finds none; it never regenerates or reorders an existing
 * one. `TodaySessionRepository.createIfNotExists` is itself race-free
 * (ADR-010), so this file does not need its own additional locking for
 * the "two concurrent callers both try to create the same session" case —
 * see docs/PERSISTENCE_SCHEMA_V1.md's `today_sessions` section for why the
 * INSERT ... ON CONFLICT DO NOTHING pattern is race-free by Postgres's own
 * unique-index insert semantics, without an advisory lock here (unlike
 * submitAnswer's first-Attempt race, which specifically needed one).
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
import type {
  TodaySession,
  TodaySessionItem,
  TodaySessionKey,
  UnitOfWork,
} from "./ports";

export interface TodaySessionContext {
  now: Date;
  engineVersion: string;
  memoryScheduler: MemoryScheduler;
  todayPlannerPolicy: TodayPlannerPolicy;
}

export async function getTodaySession(
  key: TodaySessionKey,
  uow: UnitOfWork,
): Promise<TodaySession | null> {
  // Pure read — no side effects, matching "Today resume" being a plain
  // lookup with no planning/generation logic on this path at all.
  return uow.runInTransaction((repos) => repos.todaySessions.findByKey(key));
}

export async function getOrCreateTodaySession(
  key: TodaySessionKey,
  context: TodaySessionContext,
  uow: UnitOfWork,
): Promise<TodaySession> {
  return uow.runInTransaction(async (repos) => {
    const existing = await repos.todaySessions.findByKey(key);
    if (existing !== null) {
      return existing;
    }

    const progresses = await repos.progress.listForUser(
      key.userId,
      key.courseId,
    );

    const nbaContext: NextBestActionContext = {
      now: context.now,
      memoryScheduler: context.memoryScheduler,
    };
    const candidates = progresses.flatMap((progress) =>
      generateNextBestActionCandidates(progress, nbaContext),
    );
    const ranked = rankNextBestActionCandidates(candidates, {
      now: context.now,
    });
    const plan = generateTodayPlan(
      { rankedCandidates: ranked, plannedForDate: key.plannedForDate },
      context.todayPlannerPolicy,
    );

    // Question-version resolution is an application-layer responsibility,
    // not today-planner.ts's (ADR-010). A Question with no current version
    // is skipped defensively — this should not normally happen for a
    // Question that already had enough evidence to generate an NBA
    // candidate, but generateTodayPlan has no way to know about
    // QuestionVersion at all, so this file is the first place able to
    // notice and must not let one bad Question crash the whole session.
    const items: Array<Omit<TodaySessionItem, "id" | "todaySessionId">> = [];
    for (const planItem of plan.items) {
      const version = await repos.questionVersions.getCurrentVersion(
        planItem.questionId,
      );
      if (version === null) {
        continue;
      }
      items.push({
        userId: key.userId,
        position: planItem.position,
        questionId: planItem.questionId,
        questionVersionId: version.versionId,
        actionType: planItem.actionType,
        tier: planItem.tier,
        otherApplicableTypes: planItem.otherApplicableTypes,
        reasons: planItem.reasons,
        status: "pending",
        completedAt: null,
      });
    }

    return repos.todaySessions.createIfNotExists(
      {
        userId: key.userId,
        courseId: key.courseId,
        plannedForDate: key.plannedForDate,
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
