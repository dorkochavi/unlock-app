/**
 * Testable core of `PATCH /api/courses/:courseId/questions/:questionId`
 * (Run 006 S4 — "save Question draft"). Mirrors
 * `courses/[courseId]/topics/[topicId]/handle-rename-topic.ts`'s
 * authenticate-then-parse-then-invoke split.
 *
 * ## Trust boundary
 *
 * `authenticate` is the only source of `actorUserId`. `courseId`/`questionId`
 * come from the URL path. The request body may only supply the fields
 * `updateQuestionDraft` itself accepts (`topicId`, `questionType`, `prompt`,
 * `answerOptions`, `correctOptionIds`, `explanation`), each independently
 * optional (absent = leave unchanged, `null` = explicitly clear) and
 * shape-checked here BEFORE reaching the application layer — this is a raw
 * `unknown` JSON body, not yet a typed `UpdateQuestionDraftInput`.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` or `questionId` -> 404,
 *   `{error: {code: "QUESTION_NOT_FOUND"}}`.
 * - malformed body (wrong type for a present field) -> 400,
 *   `{error: {code: "INVALID_REQUEST"}}` — checked BEFORE `deps.update`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `QUESTION_NOT_FOUND` -> 404, `{error: {code: "QUESTION_NOT_FOUND"}}`.
 * - `TOPIC_NOT_FOUND` -> 404, `{error: {code: "TOPIC_NOT_FOUND"}}`.
 * - `TOPIC_ARCHIVED` -> 409, `{error: {code: "TOPIC_ARCHIVED"}}` — a real,
 *   existing state conflicting with the requested NEW association, matching
 *   this codebase's established `INVALID_TRANSITION` 409 precedent
 *   (`courses/[courseId]/publish/handle-publish-course.ts`).
 * - `INVALID_DRAFT` -> 400, `{error: {code: "INVALID_DRAFT", message}}` —
 *   `message` comes only from this codebase's own controlled domain
 *   validator (`assertSaveableQuestionDraftContent`), never a raw exception,
 *   so it is safe to return to the authorized instructor actively editing
 *   their own draft.
 * - `UPDATED` -> 200, `{question: QuestionAuthoringDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { QUESTION_TYPES } from "../../../../../../domain/learning/answer";
import { isUuid } from "../../../../../../lib/uuid";
import { toQuestionAuthoringDto } from "../question-dto";

import type { UpdateQuestionDraftResult } from "@/application/question/update-question-draft";
import type { AnswerOption, UpdateQuestionDraftInput } from "@/application/question/ports";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleUpdateQuestionDraftDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  questionId: string;
  body: unknown;
  update: (
    command: { actorUserId: string; courseId: string; questionId: string } & UpdateQuestionDraftInput,
  ) => Promise<UpdateQuestionDraftResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function questionNotFoundResponse(): RouteJsonResponse {
  return { status: 404, body: { error: { code: "QUESTION_NOT_FOUND" } } };
}

function invalidRequestResponse(): RouteJsonResponse {
  return { status: 400, body: { error: { code: "INVALID_REQUEST" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

function isAnswerOptionArray(value: unknown): value is AnswerOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).id === "string" &&
        typeof (entry as Record<string, unknown>).content === "string",
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/**
 * Parses+shape-validates the raw request body into a partial
 * `UpdateQuestionDraftInput` — every recognized key is independently
 * optional; an unrecognized key is silently ignored (not an error), matching
 * this codebase's existing PATCH body convention
 * (`courses/[courseId]/manage/handle-update-course-metadata.ts`). Returns
 * `null` on any recognized-but-malformed field.
 */
function parseUpdateQuestionDraftBody(body: unknown): UpdateQuestionDraftInput | null {
  if (body === null || typeof body !== "object") {
    return null;
  }
  const raw = body as Record<string, unknown>;
  const input: UpdateQuestionDraftInput = {};

  if ("topicId" in raw) {
    if (raw.topicId !== null && typeof raw.topicId !== "string") return null;
    input.topicId = raw.topicId as string | null;
  }
  if ("questionType" in raw) {
    if (raw.questionType !== null && !(QUESTION_TYPES as readonly string[]).includes(raw.questionType as string)) {
      return null;
    }
    input.questionType = raw.questionType as UpdateQuestionDraftInput["questionType"];
  }
  if ("prompt" in raw) {
    if (raw.prompt !== null && typeof raw.prompt !== "string") return null;
    input.prompt = raw.prompt as string | null;
  }
  if ("answerOptions" in raw) {
    if (raw.answerOptions !== null && !isAnswerOptionArray(raw.answerOptions)) return null;
    input.answerOptions = raw.answerOptions as AnswerOption[] | null;
  }
  if ("correctOptionIds" in raw) {
    if (raw.correctOptionIds !== null && !isStringArray(raw.correctOptionIds)) return null;
    input.correctOptionIds = raw.correctOptionIds as string[] | null;
  }
  if ("explanation" in raw) {
    if (raw.explanation !== null && typeof raw.explanation !== "string") return null;
    input.explanation = raw.explanation as string | null;
  }

  return input;
}

export async function handleUpdateQuestionDraft(
  deps: HandleUpdateQuestionDraftDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "PATCH /api/courses/:courseId/questions/:questionId: unexpected error during authentication",
      error,
    );
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId) || !isUuid(deps.questionId)) {
    return questionNotFoundResponse();
  }

  const input = parseUpdateQuestionDraftBody(deps.body);
  if (input === null) {
    return invalidRequestResponse();
  }

  let result: UpdateQuestionDraftResult;
  try {
    result = await deps.update({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      questionId: deps.questionId,
      ...input,
    });
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/questions/:questionId: unexpected error during update", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "QUESTION_NOT_FOUND":
      return questionNotFoundResponse();

    case "TOPIC_NOT_FOUND":
      return { status: 404, body: { error: { code: "TOPIC_NOT_FOUND" } } };

    case "TOPIC_ARCHIVED":
      return { status: 409, body: { error: { code: "TOPIC_ARCHIVED" } } };

    case "INVALID_DRAFT":
      return { status: 400, body: { error: { code: "INVALID_DRAFT", message: result.message } } };

    case "UPDATED":
      return { status: 200, body: { question: toQuestionAuthoringDto(result.question) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "PATCH /api/courses/:courseId/questions/:questionId: unhandled UpdateQuestionDraftResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}
