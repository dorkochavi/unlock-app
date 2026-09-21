/**
 * Testable core of `POST /api/courses/:courseId/import/confirm` (Run 007
 * S4 — "Confirm API"). Mirrors `../preview/handle-preview-import.ts`'s
 * authenticate-then-parse-then-invoke split and body contract exactly
 * (`{format, sourceText}`) — confirm resubmits the SAME raw payload the
 * client previewed, never a client-computed preview verdict
 * (`docs/CHATGPT_PLAN.md` §3 "confirm reparses/revalidates authoritative
 * raw input server-side — never trusts a client-computed preview verdict").
 *
 * ## Trust boundary
 *
 * No client-authoritative identity: `actorUserId` always comes from
 * `authenticate()`, never the request body. `format`/`sourceText` are the
 * only body fields read — no client-supplied row list, valid-row selection,
 * or resolved Topic id is ever accepted.
 *
 * ## Size limit (FUB-005)
 *
 * Same `MAX_IMPORT_SOURCE_LENGTH` (`../limits.ts`) HTTP-boundary bound as
 * preview, checked before `deps.confirm` is ever called.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - malformed body -> 400, `{error: {code: "INVALID_REQUEST"}}`.
 * - `sourceText` over the size limit -> 413, `{error: {code: "SOURCE_TOO_LARGE"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `COURSE_ARCHIVED` -> 409, `{error: {code: "COURSE_ARCHIVED"}}`.
 * - `MALFORMED_SOURCE` -> 400, `{error: {code: "MALFORMED_SOURCE", message}}`.
 * - `TOO_MANY_ROWS` -> 413, `{error: {code: "TOO_MANY_ROWS", totalRows}}`
 *   — row-count companion to `SOURCE_TOO_LARGE` (`MAX_IMPORT_ROWS`, Run 008
 *   S1.D), inherited from `previewImport`'s Phase 1 reparse.
 * - `INVALID_ROWS` -> 400, `{error: {code: "INVALID_ROWS", totalRows, invalidCount, errors}}`
 *   — the whole batch was rejected before any transaction opened; `errors`
 *   comes only from this codebase's own controlled row validators, never a
 *   raw exception.
 * - `STATE_CHANGED` -> 409, `{error: {code: "STATE_CHANGED"}}` — a
 *   concurrent Course/Topic change invalidated the reparsed batch inside the
 *   write transaction; zero writes occurred, caller should preview again.
 * - `CONFIRMED` -> 201, `{createdCount, createdQuestionIds}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../../lib/uuid";
import { MAX_IMPORT_SOURCE_LENGTH } from "../limits";

import type { ConfirmImportResult } from "@/application/import/confirm-import";
import type { ImportSourceFormat } from "@/application/import/preview-import";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleConfirmImportDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  body: unknown;
  confirm: (
    command: { actorUserId: string; courseId: string; format: ImportSourceFormat; sourceText: string },
  ) => Promise<ConfirmImportResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

function invalidRequestResponse(): RouteJsonResponse {
  return { status: 400, body: { error: { code: "INVALID_REQUEST" } } };
}

interface ParsedConfirmBody {
  format: ImportSourceFormat;
  sourceText: string;
}

/** Shape-checks the raw request body into `{format, sourceText}` — returns `null` on any malformed/missing field, never throws. Identical contract to `../preview/handle-preview-import.ts`'s own body parser. */
function parseConfirmImportBody(body: unknown): ParsedConfirmBody | null {
  if (body === null || typeof body !== "object") {
    return null;
  }
  const raw = body as Record<string, unknown>;
  if (raw.format !== "JSON" && raw.format !== "CSV") {
    return null;
  }
  if (typeof raw.sourceText !== "string") {
    return null;
  }
  return { format: raw.format, sourceText: raw.sourceText };
}

export async function handleConfirmImport(
  deps: HandleConfirmImportDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "POST /api/courses/:courseId/import/confirm: unexpected error during authentication",
      error,
    );
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  const parsedBody = parseConfirmImportBody(deps.body);
  if (parsedBody === null) {
    return invalidRequestResponse();
  }

  if (parsedBody.sourceText.length > MAX_IMPORT_SOURCE_LENGTH) {
    return { status: 413, body: { error: { code: "SOURCE_TOO_LARGE" } } };
  }

  let result: ConfirmImportResult;
  try {
    result = await deps.confirm({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      format: parsedBody.format,
      sourceText: parsedBody.sourceText,
    });
  } catch (error) {
    console.error("POST /api/courses/:courseId/import/confirm: unexpected error during confirm", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "COURSE_ARCHIVED":
      return { status: 409, body: { error: { code: "COURSE_ARCHIVED" } } };

    case "MALFORMED_SOURCE":
      return { status: 400, body: { error: { code: "MALFORMED_SOURCE", message: result.error } } };

    case "TOO_MANY_ROWS":
      return { status: 413, body: { error: { code: "TOO_MANY_ROWS", totalRows: result.totalRows } } };

    case "INVALID_ROWS":
      return {
        status: 400,
        body: {
          error: {
            code: "INVALID_ROWS",
            totalRows: result.totalRows,
            invalidCount: result.invalidCount,
            errors: result.errors,
          },
        },
      };

    case "STATE_CHANGED":
      return { status: 409, body: { error: { code: "STATE_CHANGED" } } };

    case "CONFIRMED":
      return {
        status: 201,
        body: { createdCount: result.createdCount, createdQuestionIds: result.createdQuestionIds },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/courses/:courseId/import/confirm: unhandled ConfirmImportResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}
