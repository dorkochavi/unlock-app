/**
 * Testable core of `POST /api/daily-plan/items/:itemId/answer` — mirrors
 * `daily-plan/today/handle-get-daily-plan-today.ts`'s shape exactly: pure
 * dependency-injected logic, no Next.js/Supabase/`pg` types. `route.ts` is a
 * thin wrapper that constructs these dependencies from real infrastructure
 * and adapts this function's plain `{status, body}` result into a
 * `Response`.
 *
 * ## Trust boundary
 *
 * `authenticate` is the ONLY source of `userId`. `itemId` comes from the URL
 * path (a route param, not request body). The request BODY accepts only
 * genuinely learner-controlled answer data — `submissionId` (the client's
 * own idempotency key, ADR-010's "client retry contract" — reused verbatim
 * across retries, never generated/replaced here),`selectedAnswer`,
 * `confidenceLevel`, `responseTimeSeconds`. `courseId`/`questionId`/
 * `questionVersionId`/`dailyPlanId` are never read from the request body at
 * all — `deps.submit` (real wiring: `submitDailyPlanItemAnswer`) resolves
 * them server-side from the persisted DailyPlanItem. `answeredAt` is the
 * `now` VALUE this function's caller supplies (captured once at the true
 * HTTP boundary, `route.ts`), never client-supplied — deliberately simpler
 * than `docs/API_V1_DRAFT.md` §1's draft DTO (which sketched a
 * client-supplied `answeredAt` for a different, unimplemented route): no
 * feature in this slice needs the learner's own clock, and skipping it
 * avoids a whole class of malformed-timestamp/clock-skew validation for no
 * current benefit. `assistanceUsed`/`answerWasRevealedBeforeResponse` are
 * not yet exposed by any UI feature in this slice, so this route does not
 * accept them from the client either — hardcoded to `"NONE"`/`false` inside
 * `submitDailyPlanItemAnswer`, not invented client-facing surface for an
 * unbuilt feature.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - missing/non-string `submissionId`, or `selectedAnswer` entirely absent
 *   from the body -> 400, `{error: {code: "INVALID_REQUEST"}}` — checked
 *   BEFORE `deps.submit` is ever called.
 * - `ITEM_NOT_FOUND_OR_NOT_OWNED` (the pre-fetch lookup in
 *   `submitDailyPlanItemAnswer`) OR `DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED`
 *   (submitAnswer's own authoritative re-check) -> 404, `{error: {code:
 *   "ITEM_NOT_FOUND"}}`. Deliberately the SAME code for both — a learner
 *   must never be able to distinguish "this item does not exist" from "this
 *   item belongs to someone else" (no existence leak across users).
 * - `DAILY_PLAN_ITEM_ALREADY_RESOLVED` -> 409, `{error: {code:
 *   "ITEM_ALREADY_RESOLVED", status}}` — a genuinely new submissionId
 *   arriving for an item some earlier submission already resolved. A real
 *   RETRY of the same submissionId never reaches this outcome; it comes
 *   back as `ACCEPTED` with `wasIdempotentRetry: true` instead.
 * - `IDEMPOTENCY_KEY_CONFLICT` -> 409, `{error: {code:
 *   "SUBMISSION_ID_REUSED"}}` — this exact `submissionId` was already used
 *   for a DIFFERENT logical command by this user (a client bug, not a
 *   normal retry).
 * - `INVALID_SELECTED_ANSWER` (ADR-014) -> 400, `{error: {code:
 *   "INVALID_ANSWER"}}` — the domain's own specific validation reason
 *   (`result.reason`) is logged server-side only, never included in the
 *   response body (`.claude/rules/api.md`: stable codes, not raw exception
 *   text).
 * - `QUESTION_VERSION_CONSISTENCY_VIOLATION` -> 500, `{error: {code:
 *   "INTERNAL_ERROR"}}` — should be unreachable for a real persisted
 *   DailyPlanItem (its own composite FKs already guarantee this
 *   consistency); logged loudly as a data-consistency fault, never a normal
 *   client error.
 * - `TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED` -> 500, `{error: {code:
 *   "INTERNAL_ERROR"}}` — genuinely unreachable from this route (it never
 *   sends `todaySessionItemId`); handled only for `SubmitAnswerResult`
 *   exhaustiveness, logged loudly if it somehow occurs.
 * - `ACCEPTED` -> 200, `{status: "COMPLETED", isCorrect, wasIdempotentRetry}`
 *   — deliberately excludes `correctOptionIds`/any grading-definition
 *   field/internal scheduler or mastery state. `isCorrect` alone is the
 *   only grading signal returned, matching this slice's explicit
 *   allowance ("correctness if permitted by existing contract").
 * - An unexpected thrown error (from `authenticate` or `deps.submit`) -> 500,
 *   `{error: {code: "INTERNAL_ERROR"}}`. Logged server-side only.
 */
import type { SubmitDailyPlanItemAnswerResult } from "../../../../../../application/dailyPlan/submit-daily-plan-item-answer";
import type { ConfidenceLevel, SelectedAnswer } from "../../../../../../domain/learning/types";
import type { RequireAuthenticatedUserResult } from "../../../../../../infrastructure/supabase/require-authenticated-user";

const VALID_CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = ["low", "medium", "high"];

export interface HandleSubmitDailyPlanItemAnswerDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  itemId: string;
  /** Raw client-supplied request body — validated here, never trusted as-is. */
  body: unknown;
  now: Date;
  submit: (command: {
    userId: string;
    dailyPlanItemId: string;
    submissionId: string;
    selectedAnswer: SelectedAnswer;
    confidenceLevel: ConfidenceLevel | null;
    responseTimeSeconds: number | null;
    answeredAt: Date;
  }) => Promise<SubmitDailyPlanItemAnswerResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function unauthenticatedResponse(): RouteJsonResponse {
  return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
}

function invalidRequestResponse(): RouteJsonResponse {
  return { status: 400, body: { error: { code: "INVALID_REQUEST" } } };
}

function itemNotFoundResponse(): RouteJsonResponse {
  return { status: 404, body: { error: { code: "ITEM_NOT_FOUND" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

/**
 * Structural validation only (right shape/type) — semantic validation
 * (unknown option id, wrong shape for the question's actual type, duplicate
 * ids) happens inside `submitAnswer` via `canonicalizeSelectedAnswer`
 * (ADR-014), which is the single source of truth for that rule and must not
 * be duplicated here.
 */
function readSelectedAnswer(body: Record<string, unknown>): SelectedAnswer | undefined {
  const value = body.selectedAnswer;
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value as string[];
  }
  return undefined;
}

function readConfidenceLevel(body: Record<string, unknown>): ConfidenceLevel | null | undefined {
  const value = body.confidenceLevel;
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && (VALID_CONFIDENCE_LEVELS as string[]).includes(value)) {
    return value as ConfidenceLevel;
  }
  return undefined;
}

function readResponseTimeSeconds(body: Record<string, unknown>): number | null | undefined {
  const value = body.responseTimeSeconds;
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return undefined;
}

export async function handleSubmitDailyPlanItemAnswer(
  deps: HandleSubmitDailyPlanItemAnswerDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "POST /api/daily-plan/items/:itemId/answer: unexpected error during authentication",
      error,
    );
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return unauthenticatedResponse();
  }

  if (deps.body === null || typeof deps.body !== "object") {
    return invalidRequestResponse();
  }
  const body = deps.body as Record<string, unknown>;

  const submissionId = body.submissionId;
  if (typeof submissionId !== "string" || submissionId.length === 0) {
    return invalidRequestResponse();
  }

  const selectedAnswer = readSelectedAnswer(body);
  if (selectedAnswer === undefined) {
    return invalidRequestResponse();
  }

  const confidenceLevel = readConfidenceLevel(body);
  if (confidenceLevel === undefined) {
    return invalidRequestResponse();
  }

  const responseTimeSeconds = readResponseTimeSeconds(body);
  if (responseTimeSeconds === undefined) {
    return invalidRequestResponse();
  }

  let result: SubmitDailyPlanItemAnswerResult;
  try {
    result = await deps.submit({
      userId: authResult.userId,
      dailyPlanItemId: deps.itemId,
      submissionId,
      selectedAnswer,
      confidenceLevel,
      responseTimeSeconds,
      answeredAt: deps.now,
    });
  } catch (error) {
    console.error(
      "POST /api/daily-plan/items/:itemId/answer: unexpected error during submission",
      error,
    );
    return internalErrorResponse();
  }

  switch (result.kind) {
    case "ITEM_NOT_FOUND_OR_NOT_OWNED":
    case "DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED":
      return itemNotFoundResponse();

    case "DAILY_PLAN_ITEM_ALREADY_RESOLVED":
      return {
        status: 409,
        body: { error: { code: "ITEM_ALREADY_RESOLVED", status: result.status } },
      };

    case "IDEMPOTENCY_KEY_CONFLICT":
      return { status: 409, body: { error: { code: "SUBMISSION_ID_REUSED" } } };

    case "INVALID_SELECTED_ANSWER":
      console.error(
        `POST /api/daily-plan/items/:itemId/answer: INVALID_SELECTED_ANSWER — ${result.reason}`,
      );
      return { status: 400, body: { error: { code: "INVALID_ANSWER" } } };

    case "QUESTION_VERSION_CONSISTENCY_VIOLATION":
      console.error(
        `POST /api/daily-plan/items/:itemId/answer: QUESTION_VERSION_CONSISTENCY_VIOLATION ` +
          `for questionVersionId (${result.questionVersionId}) — should be unreachable for a ` +
          `real persisted DailyPlanItem; treated as a server-side data-consistency fault.`,
      );
      return internalErrorResponse();

    case "TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED":
      console.error(
        "POST /api/daily-plan/items/:itemId/answer: unreachable TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED " +
          "outcome — this route never sends todaySessionItemId",
      );
      return internalErrorResponse();

    case "ACCEPTED":
      return {
        status: 200,
        body: {
          status: "COMPLETED",
          isCorrect: result.attempt.isCorrect,
          wasIdempotentRetry: result.wasIdempotentRetry,
        },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/daily-plan/items/:itemId/answer: unhandled SubmitDailyPlanItemAnswerResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}
