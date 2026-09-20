/**
 * Testable core of `POST /api/daily-plan/items/:itemId/skip` — mirrors
 * `answer/handle-submit-daily-plan-item-answer.ts`'s shape. No request body
 * is accepted at all: Skip has no learner-controlled data (ADR-016,
 * Night-Run Slice 3) — `itemId` (URL path) and the authenticated `userId`
 * are the only inputs.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - `ITEM_NOT_FOUND_OR_NOT_OWNED` -> 404, `{error: {code: "ITEM_NOT_FOUND"}}`
 *   — same non-leaking posture as the answer route (never distinguishes
 *   "does not exist" from "belongs to someone else").
 * - `ALREADY_RESOLVED` -> 409, `{error: {code: "ITEM_ALREADY_RESOLVED",
 *   status}}` — skipping an already-completed/already-skipped item is
 *   reported, never silently treated as success and never an unexpected
 *   error.
 * - `SKIPPED` -> 200, `{status: "SKIPPED"}` — no grading/correctness field
 *   exists for Skip at all (it is not an answer).
 * - An unexpected thrown error (from `authenticate` or `deps.skip`) -> 500,
 *   `{error: {code: "INTERNAL_ERROR"}}`. Logged server-side only.
 */
import type { SkipDailyPlanItemResult } from "../../../../../../application/dailyPlan/skip-daily-plan-item";
import type { RequireAuthenticatedUserResult } from "../../../../../../infrastructure/supabase/require-authenticated-user";

export interface HandleSkipDailyPlanItemDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  itemId: string;
  now: Date;
  skip: (command: {
    userId: string;
    dailyPlanItemId: string;
    skippedAt: Date;
  }) => Promise<SkipDailyPlanItemResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function unauthenticatedResponse(): RouteJsonResponse {
  return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleSkipDailyPlanItem(
  deps: HandleSkipDailyPlanItemDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "POST /api/daily-plan/items/:itemId/skip: unexpected error during authentication",
      error,
    );
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return unauthenticatedResponse();
  }

  let result: SkipDailyPlanItemResult;
  try {
    result = await deps.skip({
      userId: authResult.userId,
      dailyPlanItemId: deps.itemId,
      skippedAt: deps.now,
    });
  } catch (error) {
    console.error(
      "POST /api/daily-plan/items/:itemId/skip: unexpected error during skip",
      error,
    );
    return internalErrorResponse();
  }

  switch (result.kind) {
    case "ITEM_NOT_FOUND_OR_NOT_OWNED":
      return { status: 404, body: { error: { code: "ITEM_NOT_FOUND" } } };

    case "ALREADY_RESOLVED":
      return {
        status: 409,
        body: { error: { code: "ITEM_ALREADY_RESOLVED", status: result.status } },
      };

    case "SKIPPED":
      return { status: 200, body: { status: "SKIPPED" } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/daily-plan/items/:itemId/skip: unhandled SkipDailyPlanItemResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}
