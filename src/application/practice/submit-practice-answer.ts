/**
 * submitPracticeAnswer — answer one Practice Question (Run UX-02 P2, ADR-020).
 *
 * The client supplies only answer data and the Question/version it saw. The
 * SERVER derives: the learning-session identity (today's DailyPlan id, via
 * get-or-create), `answeredAt` (`now`), and `dailyPlanId`/`dailyPlanItemId`
 * (always null — Practice never resolves a DailyPlanItem). Everything else
 * is the normal `submitAnswer` pipeline (Attempt → Progress → engine), so
 * P1's early-correct rule applies via `dailyPlanItemId === null`.
 *
 * Re-validated at answer time (not only at selection): eligibility, Topic
 * scope, Question in the Course with its CURRENT version, and NOT pending in
 * today's plan.
 */
import type { ConfidenceLevel, SelectedAnswer } from "../../domain/learning/types";
import {
  getOrCreateDailyPlanForToday,
  type DailyPlanGenerationSettings,
} from "../dailyPlan/get-or-create-daily-plan-for-today";
import type { UnitOfWork } from "../learning/ports";
import { submitAnswer, type SubmitAnswerContext } from "../learning/submit-answer";
import { isPracticeEligible, isUuid } from "./practice-eligibility";
import { eligibilityPorts, type SelectPracticeBatchPorts } from "./select-practice-batch";

export interface SubmitPracticeAnswerCommand {
  userId: string;
  courseId: string;
  topicId: string | null;
  questionId: string;
  questionVersionId: string;
  submissionId: string;
  selectedAnswer: SelectedAnswer;
  confidenceLevel: ConfidenceLevel | null;
  responseTimeSeconds: number | null;
  /** Server-captured answer time — never client-supplied. */
  now: Date;
}

export type SubmitPracticeAnswerResult =
  | { kind: "NOT_ELIGIBLE" }
  | { kind: "NOT_IN_SCOPE" }
  | { kind: "TIMEZONE_NOT_SET" }
  /** The Question has a newer current version than the one the client answered. */
  | { kind: "QUESTION_UNAVAILABLE" }
  | { kind: "PENDING_IN_TODAY" }
  | { kind: "IDEMPOTENCY_KEY_CONFLICT" }
  | { kind: "INVALID_SELECTED_ANSWER"; reason: string }
  | { kind: "ACCEPTED"; isCorrect: boolean; wasIdempotentRetry: boolean };

export interface SubmitPracticeAnswerPorts extends SelectPracticeBatchPorts {
  uow: UnitOfWork;
}

export async function submitPracticeAnswer(
  command: SubmitPracticeAnswerCommand,
  settings: DailyPlanGenerationSettings,
  context: SubmitAnswerContext,
  ports: SubmitPracticeAnswerPorts,
): Promise<SubmitPracticeAnswerResult> {
  if (!isUuid(command.courseId)) return { kind: "NOT_ELIGIBLE" };
  if (!(await isPracticeEligible(eligibilityPorts(ports), command.userId, command.courseId))) {
    return { kind: "NOT_ELIGIBLE" };
  }

  if (!isUuid(command.questionId) || !isUuid(command.questionVersionId)) {
    return { kind: "NOT_IN_SCOPE" };
  }
  if (command.topicId !== null) {
    if (!isUuid(command.topicId)) return { kind: "NOT_IN_SCOPE" };
    const topic = await ports.topics.getTopic(command.topicId);
    if (topic === null || topic.courseId !== command.courseId || topic.archivedAt !== null) {
      return { kind: "NOT_IN_SCOPE" };
    }
  }

  const question = await ports.practice.findScopeQuestion(command.courseId, command.questionId);
  if (question === null) return { kind: "NOT_IN_SCOPE" };
  if (command.topicId !== null && question.topicId !== command.topicId) {
    return { kind: "NOT_IN_SCOPE" };
  }
  if (question.questionVersionId !== command.questionVersionId) {
    return { kind: "QUESTION_UNAVAILABLE" };
  }

  const planResult = await getOrCreateDailyPlanForToday(
    { userId: command.userId, now: command.now },
    settings,
    ports,
  );
  if (planResult.outcome === "TIMEZONE_NOT_SET") return { kind: "TIMEZONE_NOT_SET" };
  if (planResult.outcome === "USER_NOT_FOUND") return { kind: "NOT_ELIGIBLE" };
  const plan = planResult.plan;

  if (
    plan.items.some((item) => item.questionId === command.questionId && item.status === "pending")
  ) {
    return { kind: "PENDING_IN_TODAY" };
  }

  const result = await submitAnswer(
    {
      submissionId: command.submissionId,
      userId: command.userId,
      courseId: command.courseId,
      questionId: command.questionId,
      questionVersionId: command.questionVersionId,
      answeredAt: command.now,
      selectedAnswer: command.selectedAnswer,
      confidenceLevel: command.confidenceLevel,
      responseTimeSeconds: command.responseTimeSeconds,
      dailyPlanId: null,
      dailyPlanItemId: null,
      learningSessionId: plan.id,
      assistanceUsed: "NONE",
      attemptNumberForPresentedItem: 1,
      answerWasRevealedBeforeResponse: false,
    },
    context,
    ports.uow,
  );

  switch (result.kind) {
    case "ACCEPTED":
      return {
        kind: "ACCEPTED",
        isCorrect: result.attempt.isCorrect,
        wasIdempotentRetry: result.wasIdempotentRetry,
      };
    case "IDEMPOTENCY_KEY_CONFLICT":
      return { kind: "IDEMPOTENCY_KEY_CONFLICT" };
    case "INVALID_SELECTED_ANSWER":
      return { kind: "INVALID_SELECTED_ANSWER", reason: result.reason };
    case "QUESTION_VERSION_CONSISTENCY_VIOLATION":
      // Version/Question/Course consistency was validated above; reaching
      // this means the version changed underneath us — treat as unavailable.
      return { kind: "QUESTION_UNAVAILABLE" };
    case "DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED":
    case "DAILY_PLAN_ITEM_ALREADY_RESOLVED":
      // Unreachable: Practice never passes a dailyPlanItemId.
      throw new Error(`submitPracticeAnswer: unexpected submitAnswer outcome ${result.kind}`);
  }
}
