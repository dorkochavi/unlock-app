/**
 * Testable core of `POST /api/courses/:courseId/import/preview` (Run 007
 * S3 — "Preview API"). Mirrors `courses/[courseId]/questions/[questionId]
 * /handle-update-question-draft.ts`'s authenticate-then-parse-then-invoke
 * split: `authenticate` is the only source of `actorUserId`; `courseId`
 * comes from the URL path; the request body is untyped `unknown` JSON,
 * shape-checked here BEFORE reaching `previewImport` (Run 007 S2).
 *
 * ## Trust boundary
 *
 * No client-authoritative identity: `actorUserId` always comes from
 * `authenticate()`, never the request body. `format`/`sourceText` are the
 * only body fields read.
 *
 * ## Size limit (FUB-005)
 *
 * `sourceText` longer than `MAX_IMPORT_SOURCE_LENGTH`
 * (`../limits.ts`) is rejected before `deps.preview` is ever called — the
 * concrete HTTP-boundary limit FUB-005 deferred to this Slice.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - malformed body (missing/invalid `format` or `sourceText`) -> 400,
 *   `{error: {code: "INVALID_REQUEST"}}` — checked BEFORE `deps.preview`.
 * - `sourceText` over the size limit -> 413, `{error: {code: "SOURCE_TOO_LARGE"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `COURSE_ARCHIVED` -> 409, `{error: {code: "COURSE_ARCHIVED"}}` — matches
 *   this codebase's established `COURSE_ARCHIVED`/`TOPIC_ARCHIVED` 409
 *   precedent (`.../publish/handle-publish-question.ts`).
 * - `MALFORMED_SOURCE` -> 400, `{error: {code: "MALFORMED_SOURCE", message}}`
 *   — `message` comes only from the S1 adapters' own controlled parse
 *   errors, never a raw exception.
 * - `TOO_MANY_ROWS` -> 413, `{error: {code: "TOO_MANY_ROWS", totalRows}}`
 *   — row-count companion to the `SOURCE_TOO_LARGE` character-count limit
 *   above (`MAX_IMPORT_ROWS`, Run 008 S1.D); only knowable after parsing,
 *   so checked inside `previewImport`, not here.
 * - `PREVIEWED` -> 200, `{preview: PreviewImportDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../../lib/uuid";
import { MAX_IMPORT_SOURCE_LENGTH } from "../limits";
import { toPreviewImportDto } from "./preview-import-dto";

import type { ImportSourceFormat, PreviewImportResult } from "@/application/import/preview-import";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandlePreviewImportDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  body: unknown;
  preview: (
    command: { actorUserId: string; courseId: string; format: ImportSourceFormat; sourceText: string },
  ) => Promise<PreviewImportResult>;
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

interface ParsedPreviewBody {
  format: ImportSourceFormat;
  sourceText: string;
}

/** Shape-checks the raw request body into `{format, sourceText}` — returns `null` on any malformed/missing field, never throws. */
function parsePreviewImportBody(body: unknown): ParsedPreviewBody | null {
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

export async function handlePreviewImport(
  deps: HandlePreviewImportDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "POST /api/courses/:courseId/import/preview: unexpected error during authentication",
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

  const parsedBody = parsePreviewImportBody(deps.body);
  if (parsedBody === null) {
    return invalidRequestResponse();
  }

  if (parsedBody.sourceText.length > MAX_IMPORT_SOURCE_LENGTH) {
    return { status: 413, body: { error: { code: "SOURCE_TOO_LARGE" } } };
  }

  let result: PreviewImportResult;
  try {
    result = await deps.preview({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      format: parsedBody.format,
      sourceText: parsedBody.sourceText,
    });
  } catch (error) {
    console.error("POST /api/courses/:courseId/import/preview: unexpected error during preview", error);
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

    case "PREVIEWED":
      return { status: 200, body: { preview: toPreviewImportDto(result) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/courses/:courseId/import/preview: unhandled PreviewImportResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}
