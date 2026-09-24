/**
 * Orchestrates answering one DailyPlanItem (ADR-016, Night-Run Slice 1) —
 * the application-layer entry point behind
 * `POST /api/daily-plan/items/:itemId/answer`.
 *
 * This function itself contains NO learning/grading policy. It resolves the
 * item's `courseId`/`questionId`/`questionVersionId`/`dailyPlanId` via a
 * plain, non-transactional read, then delegates every correctness/
 * idempotency/progress-update/resolution decision to `submitAnswer`
 * (`../learning/submit-answer.ts`), which runs entirely inside its own
 * transaction.
 *
 * ## Why a pre-fetch, and why it is safe
 *
 * `SubmitAnswerCommand` requires `courseId`/`questionId`/`questionVersionId`
 * as plain fields (ADR-010's existing, heavily-audited shape) — the caller
 * is expected to already know them. This function is that caller: it reads
 * the persisted DailyPlanItem ONCE, outside any transaction, purely to
 * populate those fields. This pre-fetch is advisory only, never the
 * authoritative check — `submitAnswer`'s OWN internal
 * `repos.dailyPlanItems.findItemById` lookup, made under its advisory lock
 * INSIDE the transaction, re-validates ownership, question/version
 * consistency, AND pending status from scratch. A race between this
 * pre-fetch and the transaction (e.g. the item is resolved by a concurrent
 * request in between) is therefore safe: `submitAnswer` rejects cleanly in
 * that case (`DAILY_PLAN_ITEM_ALREADY_RESOLVED`), and no Attempt or
 * progress mutation from the stale pre-fetch ever reaches persistence.
 *
 * ## Trust boundary
 *
 * The caller (see `route.ts`) supplies only `userId` (from verified
 * authentication), `dailyPlanItemId` (a URL path parameter), and genuinely
 * learner-controlled answer fields. `courseId`/`questionId`/
 * `questionVersionId`/`dailyPlanId` are never accepted from the caller —
 * they exist on this function's command only via the server-side lookup
 * below. `attemptNumberForPresentedItem` is hardcoded to `1`: a
 * DailyPlanItem resolves at most once (`.claude/rules/learning-engine.md`),
 * so there is no "second presented attempt" concept for this flow to
 * express, unlike Manual Practice.
 */
import { submitAnswer } from "../learning/submit-answer";
import type { SubmitAnswerContext, SubmitAnswerResult } from "../learning/submit-answer";
import type { DailyPlanAnswerTarget, UnitOfWork } from "../learning/ports";
import {
  hasActiveLearnerMembership,
  type LiveLearnerMembershipLookup,
} from "./live-learner-membership";
import type {
  AssistanceType,
  ConfidenceLevel,
  SelectedAnswer,
} from "../../domain/learning/types";

/**
 * Deliberately narrower than `DailyPlanAnswerRepository`
 * (`application/learning/ports.ts`) — this lookup never needs `status` or
 * `markCompleted`, only enough to populate `SubmitAnswerCommand`'s required
 * fields. Any real implementation of the fuller port (e.g.
 * `PostgresDailyPlanRepository`) already structurally satisfies this.
 */
export interface DailyPlanItemAnswerLookup {
  findItemById(itemId: string): Promise<Pick<
    DailyPlanAnswerTarget,
    "id" | "dailyPlanId" | "userId" | "courseId" | "questionId" | "questionVersionId"
  > | null>;
}

export interface SubmitDailyPlanItemAnswerCommand {
  userId: string;
  dailyPlanItemId: string;
  submissionId: string;
  selectedAnswer: SelectedAnswer;
  confidenceLevel: ConfidenceLevel | null;
  responseTimeSeconds: number | null;
  assistanceUsed: AssistanceType;
  answerWasRevealedBeforeResponse: boolean;
  answeredAt: Date;
}

export type SubmitDailyPlanItemAnswerResult =
  | { kind: "ITEM_NOT_FOUND_OR_NOT_OWNED" }
  | SubmitAnswerResult;

export interface SubmitDailyPlanItemAnswerDependencies {
  items: DailyPlanItemAnswerLookup;
  memberships: LiveLearnerMembershipLookup;
  context: SubmitAnswerContext;
  uow: UnitOfWork;
}

export async function submitDailyPlanItemAnswer(
  command: SubmitDailyPlanItemAnswerCommand,
  deps: SubmitDailyPlanItemAnswerDependencies,
): Promise<SubmitDailyPlanItemAnswerResult> {
  const item = await deps.items.findItemById(command.dailyPlanItemId);

  // Never distinguishes "does not exist" from "exists but belongs to
  // someone else" to the caller — same non-leaking posture as
  // submitAnswer's own TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED /
  // DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED outcomes.
  if (item === null || item.userId !== command.userId) {
    return { kind: "ITEM_NOT_FOUND_OR_NOT_OWNED" };
  }

  // F-04a: live membership check, BEFORE any transaction/Attempt work — a
  // revoked/archived learner can no longer act on an existing plan. Reported
  // as the same non-leaking outcome as not-found/not-owned.
  if (!(await hasActiveLearnerMembership(deps.memberships, command.userId, item.courseId))) {
    return { kind: "ITEM_NOT_FOUND_OR_NOT_OWNED" };
  }

  return submitAnswer(
    {
      submissionId: command.submissionId,
      userId: command.userId,
      courseId: item.courseId,
      questionId: item.questionId,
      questionVersionId: item.questionVersionId,
      answeredAt: command.answeredAt,
      selectedAnswer: command.selectedAnswer,
      confidenceLevel: command.confidenceLevel,
      responseTimeSeconds: command.responseTimeSeconds,
      dailyPlanId: item.dailyPlanId,
      dailyPlanItemId: item.id,
      learningSessionId: null,
      assistanceUsed: command.assistanceUsed,
      attemptNumberForPresentedItem: 1,
      answerWasRevealedBeforeResponse: command.answerWasRevealedBeforeResponse,
    },
    deps.context,
    deps.uow,
  );
}
