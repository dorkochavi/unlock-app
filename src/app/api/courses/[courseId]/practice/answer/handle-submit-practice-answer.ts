/**
 * Testable core of `POST /api/courses/:courseId/practice/answer` — answer one
 * Practice Question (Run UX-02 P3, ADR-020).
 *
 * ## Trust boundary
 *
 * `authenticate` is the ONLY source of `userId`; `courseId` is a path
 * parameter. The body carries only learner-controlled answer data and the
 * Question/version the learner saw: `questionId`, `questionVersionId`,
 * `submissionId` (client idempotency key, ADR-010), `selectedAnswer`, an
 * optional `topicId` (Topic Practice scope), optional
 * `responseTimeSeconds`, and optional `confidenceLevel`. The client NEVER
 * supplies a learner id, a session id, a plan/item id or an answer time —
 * the application derives the learning-day session and `now` is captured at
 * the route boundary.
 *
 * RUN010-G / OQ-014: `confidenceLevel` (`"low" | "medium" | "high"`, or
 * absent/null) is now accepted here — same trust category as
 * `responseTimeSeconds`, a learner self-report the server does not
 * independently re-derive (see `submit-answer.ts`'s module doc comment,
 * which already documented `confidenceLevel` as exactly this kind of
 * client-owned evidence field). This closes a real gap: the domain/
 * misconception pipeline already required `confidenceLevel === "high"` on
 * an incorrect Attempt to escalate (`misconception.ts`), but this route
 * previously hardcoded `confidenceLevel: null` on every Practice Attempt,
 * making that gate structurally unreachable from Practice. Only the input
 * source changed here — `submitPracticeAnswer`/`submitAnswer`/
 * `misconception.ts` themselves are untouched.
 *
 * ## HTTP mapping
 *
 * - unauthenticated -> 401 `UNAUTHENTICATED` (before body validation).
 * - malformed `courseId` -> 404 `COURSE_NOT_FOUND`.
 * - malformed body / ids / selectedAnswer shape -> 400 `INVALID_REQUEST`.
 * - `NOT_ELIGIBLE` -> 403 `PRACTICE_NOT_AVAILABLE`.
 * - `NOT_IN_SCOPE` -> 404 `QUESTION_NOT_FOUND` (unknown Question, other
 *   Course, other Topic, unpublished — indistinguishable by design).
 * - `PENDING_IN_TODAY` -> 409 `PENDING_IN_TODAY`.
 * - `QUESTION_UNAVAILABLE` -> 409 `QUESTION_UNAVAILABLE` (the Question has a
 *   newer version; nothing was recorded).
 * - `IDEMPOTENCY_KEY_CONFLICT` -> 409 `SUBMISSION_ID_REUSED`.
 * - `INVALID_SELECTED_ANSWER` -> 400 `INVALID_ANSWER` (reason logged only).
 * - `TIMEZONE_NOT_SET` -> 422 `TIMEZONE_NOT_SET`.
 * - `ACCEPTED` -> 200 `{isCorrect, correctOptionIds, explanation}` (UX-03-QA1
 *   Finding 2/3 — the correct option id(s) and explanation, fetched via
 *   `deps.getFeedbackContent` AFTER acceptance, keyed by the exact
 *   `questionVersionId` answered; still no scheduler/mastery state).
 * - unexpected error -> 500 `INTERNAL_ERROR`.
 */
import { isUuid } from "../../../../../../lib/uuid";
import type { SubmitPracticeAnswerResult } from "../../../../../../application/practice/submit-practice-answer";
import type { ConfidenceLevel, SelectedAnswer } from "../../../../../../domain/learning/types";
import { CONFIDENCE_LEVELS } from "../../../../../../domain/learning/types";
import type { RequireAuthenticatedUserResult } from "../../../../../../infrastructure/supabase/require-authenticated-user";
import { logClientRejection, logUnexpectedError, logUnhandledOutcome } from "@/lib/ops-log";

export interface HandleSubmitPracticeAnswerDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  /** Raw client body — validated here, never trusted as-is. */
  body: unknown;
  now: Date;
  submit: (command: {
    userId: string;
    courseId: string;
    topicId: string | null;
    questionId: string;
    questionVersionId: string;
    submissionId: string;
    selectedAnswer: SelectedAnswer;
    confidenceLevel: ConfidenceLevel | null;
    responseTimeSeconds: number | null;
    now: Date;
  }) => Promise<SubmitPracticeAnswerResult>;
  /**
   * UX-03-QA1 Finding 2/3: called ONLY after `submit` returns `ACCEPTED`,
   * with the exact `questionVersionId` the learner answered.
   */
  getFeedbackContent: (
    questionVersionId: string,
  ) => Promise<{ correctOptionIds: string[]; explanation: string | null }>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

const error = (status: number, code: string): RouteJsonResponse => ({
  status,
  body: { error: { code } },
});

/** Structural check only; semantic validation is `submitAnswer`'s (ADR-014). */
function readSelectedAnswer(value: unknown): SelectedAnswer | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value as string[];
  }
  return undefined;
}

/**
 * RUN010-G / OQ-014: absent/null -> no signal (`null`); one of the three
 * canonical `ConfidenceLevel` strings -> that value; anything else is a
 * malformed request. Mirrors `handle-submit-daily-plan-item-answer.ts`'s
 * `readConfidenceLevel`.
 */
function readConfidenceLevel(body: Record<string, unknown>): ConfidenceLevel | null | undefined {
  const value = body.confidenceLevel;
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && (CONFIDENCE_LEVELS as readonly string[]).includes(value)) {
    return value as ConfidenceLevel;
  }
  return undefined;
}

export async function handleSubmitPracticeAnswer(
  deps: HandleSubmitPracticeAnswerDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (cause) {
    logUnexpectedError("POST /api/courses/:courseId/practice/answer: error during authentication", cause);
    return error(500, "INTERNAL_ERROR");
  }
  if (authResult.outcome === "UNAUTHENTICATED") return error(401, "UNAUTHENTICATED");

  if (!isUuid(deps.courseId)) return error(404, "COURSE_NOT_FOUND");

  if (deps.body === null || typeof deps.body !== "object" || Array.isArray(deps.body)) {
    return error(400, "INVALID_REQUEST");
  }
  const body = deps.body as Record<string, unknown>;

  const { questionId, questionVersionId, submissionId, topicId, responseTimeSeconds } = body;
  if (
    typeof questionId !== "string" ||
    !isUuid(questionId) ||
    typeof questionVersionId !== "string" ||
    !isUuid(questionVersionId) ||
    typeof submissionId !== "string" ||
    submissionId.length === 0 ||
    submissionId.length > 128
  ) {
    return error(400, "INVALID_REQUEST");
  }
  if (
    topicId !== undefined &&
    topicId !== null &&
    (typeof topicId !== "string" || !isUuid(topicId))
  ) {
    return error(400, "INVALID_REQUEST");
  }
  let responseTime: number | null = null;
  if (responseTimeSeconds !== undefined && responseTimeSeconds !== null) {
    if (
      typeof responseTimeSeconds !== "number" ||
      !Number.isFinite(responseTimeSeconds) ||
      responseTimeSeconds < 0
    ) {
      return error(400, "INVALID_REQUEST");
    }
    responseTime = responseTimeSeconds;
  }
  const selectedAnswer = readSelectedAnswer(body.selectedAnswer);
  if (selectedAnswer === undefined) return error(400, "INVALID_REQUEST");

  const confidenceLevel = readConfidenceLevel(body);
  if (confidenceLevel === undefined) return error(400, "INVALID_REQUEST");

  let result: SubmitPracticeAnswerResult;
  try {
    result = await deps.submit({
      userId: authResult.userId,
      courseId: deps.courseId,
      topicId: typeof topicId === "string" ? topicId : null,
      questionId,
      questionVersionId,
      submissionId,
      selectedAnswer,
      confidenceLevel,
      responseTimeSeconds: responseTime,
      now: deps.now,
    });
  } catch (cause) {
    logUnexpectedError("POST /api/courses/:courseId/practice/answer: unexpected error", cause);
    return error(500, "INTERNAL_ERROR");
  }

  switch (result.kind) {
    case "NOT_ELIGIBLE":
      return error(403, "PRACTICE_NOT_AVAILABLE");
    case "NOT_IN_SCOPE":
      return error(404, "QUESTION_NOT_FOUND");
    case "PENDING_IN_TODAY":
      return error(409, "PENDING_IN_TODAY");
    case "QUESTION_UNAVAILABLE":
      return error(409, "QUESTION_UNAVAILABLE");
    case "IDEMPOTENCY_KEY_CONFLICT":
      return error(409, "SUBMISSION_ID_REUSED");
    case "TIMEZONE_NOT_SET":
      return error(422, "TIMEZONE_NOT_SET");
    case "INVALID_SELECTED_ANSWER":
      // Constant label only: `result.reason` echoes the submitted answer.
      logClientRejection("POST /api/courses/:courseId/practice/answer: INVALID_SELECTED_ANSWER");
      return error(400, "INVALID_ANSWER");
    case "ACCEPTED": {
      const feedback = await deps.getFeedbackContent(questionVersionId);
      return {
        status: 200,
        body: {
          isCorrect: result.isCorrect,
          correctOptionIds: feedback.correctOptionIds,
          explanation: feedback.explanation,
        },
      };
    }
    default: {
      const exhaustiveCheck: never = result;
      logUnhandledOutcome("POST /api/courses/:courseId/practice/answer: unhandled outcome", exhaustiveCheck);
      return error(500, "INTERNAL_ERROR");
    }
  }
}
