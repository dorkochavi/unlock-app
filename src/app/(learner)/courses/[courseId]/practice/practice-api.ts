/**
 * Client-side calls and pure helpers for the Practice screen (Run UX-02 P4,
 * docs/UX_SPEC.md §10). The screen never sends a user id, session id or time;
 * the server derives all of them (ADR-020).
 *
 * Every function here never rejects: a network failure or unreadable body
 * maps to `ERROR`, so the screen always reaches a recoverable state.
 */
import { isUuid } from "@/lib/uuid";

export type PracticeFrom = "course" | "progress";

/** Client-held skipped ids are sent with "another 10"; the server caps them at 200. */
const MAX_SENT_SKIP_IDS = 200;

export interface PracticeItemDto {
  questionId: string;
  questionVersionId: string;
  questionType: string;
  prompt: string;
  answerOptions: Array<{ id: string; content: string }>;
  /** UX-03-QA1 Finding 7: current Topic attribution, not grading data. */
  topicId: string | null;
}

export interface PracticeBatchDto {
  scope: { kind: "COURSE" | "TOPIC"; title: string };
  items: PracticeItemDto[];
  hasMore: boolean;
}

export type FetchPracticeBatchOutcome =
  | { outcome: "READY"; batch: PracticeBatchDto }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "TIMEZONE_NOT_SET" }
  /** 403/404: the Course/Topic is not (or no longer) practiceable for this learner. */
  | { outcome: "UNAVAILABLE" }
  | { outcome: "ERROR" };

export type SubmitPracticeAnswerOutcome =
  | {
      outcome: "ACCEPTED";
      isCorrect: boolean;
      correctOptionIds: string[];
      explanation: string | null;
    }
  | { outcome: "UNAUTHENTICATED" }
  /** 409 pending-in-Today / new version, 404 unpublished: move on, nothing was recorded. */
  | { outcome: "QUESTION_UNAVAILABLE" }
  /** 403: Practice is no longer available for this Course. */
  | { outcome: "UNAVAILABLE" }
  | { outcome: "ERROR" };

/** Whitelisted origin only — anything else falls back to the Course page. */
export function parsePracticeFrom(value: string | null): PracticeFrom {
  return value === "progress" ? "progress" : "course";
}

/** A Topic id only if it is uuid-shaped; the server validates authoritatively. */
export function parsePracticeTopicId(value: string | null): string | null {
  return value !== null && isUuid(value) ? value : null;
}

export function practiceOriginHref(courseId: string, from: PracticeFrom): string {
  return from === "progress" ? "/progress" : `/courses/${courseId}`;
}

/** The Practice screen's own path (with scope + origin) — used for sign-in `next=`. */
export function practicePath(courseId: string, topicId: string | null, from: PracticeFrom): string {
  const query = [topicId !== null ? `topic=${topicId}` : null, `from=${from}`]
    .filter(Boolean)
    .join("&");
  return `/courses/${courseId}/practice?${query}`;
}

export function practiceBatchUrl(
  courseId: string,
  topicId: string | null,
  skippedQuestionIds: readonly string[],
): string {
  const params = new URLSearchParams();
  if (topicId !== null) params.set("topicId", topicId);
  const skip = skippedQuestionIds.slice(-MAX_SENT_SKIP_IDS);
  if (skip.length > 0) params.set("skip", skip.join(","));
  const query = params.toString();
  return `/api/courses/${courseId}/practice${query ? `?${query}` : ""}`;
}

function isPracticeItem(value: unknown): value is PracticeItemDto {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.questionId === "string" &&
    typeof v.questionVersionId === "string" &&
    typeof v.questionType === "string" &&
    typeof v.prompt === "string" &&
    Array.isArray(v.answerOptions) &&
    v.answerOptions.every(
      (o) =>
        typeof o === "object" &&
        o !== null &&
        typeof (o as Record<string, unknown>).id === "string" &&
        typeof (o as Record<string, unknown>).content === "string",
    ) &&
    (v.topicId === null || typeof v.topicId === "string")
  );
}

export async function fetchPracticeBatch(
  courseId: string,
  topicId: string | null,
  skippedQuestionIds: readonly string[],
): Promise<FetchPracticeBatchOutcome> {
  try {
    const response = await fetch(practiceBatchUrl(courseId, topicId, skippedQuestionIds), {
      method: "GET",
      cache: "no-store",
    });
    if (response.status === 401) return { outcome: "UNAUTHENTICATED" };
    if (response.status === 422) return { outcome: "TIMEZONE_NOT_SET" };
    if (response.status === 403 || response.status === 404) return { outcome: "UNAVAILABLE" };
    if (!response.ok) return { outcome: "ERROR" };
    const body = (await response.json()) as Partial<PracticeBatchDto> | null;
    if (
      body === null ||
      typeof body !== "object" ||
      typeof body.hasMore !== "boolean" ||
      !Array.isArray(body.items) ||
      !body.items.every(isPracticeItem) ||
      typeof body.scope?.title !== "string" ||
      (body.scope.kind !== "COURSE" && body.scope.kind !== "TOPIC")
    ) {
      return { outcome: "ERROR" };
    }
    return {
      outcome: "READY",
      batch: { scope: body.scope, items: body.items, hasMore: body.hasMore },
    };
  } catch {
    return { outcome: "ERROR" };
  }
}

export async function submitPracticeAnswer(
  courseId: string,
  body: {
    questionId: string;
    questionVersionId: string;
    submissionId: string;
    selectedAnswer: string | string[] | null;
    topicId: string | null;
  },
): Promise<SubmitPracticeAnswerOutcome> {
  try {
    const response = await fetch(`/api/courses/${courseId}/practice/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return { outcome: "UNAUTHENTICATED" };
    if (response.status === 403) return { outcome: "UNAVAILABLE" };
    if (response.status === 404) return { outcome: "QUESTION_UNAVAILABLE" };
    if (response.status === 409) {
      const error = (await response.json().catch(() => null)) as {
        error?: { code?: string };
      } | null;
      const code = error?.error?.code;
      return code === "PENDING_IN_TODAY" || code === "QUESTION_UNAVAILABLE"
        ? { outcome: "QUESTION_UNAVAILABLE" }
        : { outcome: "ERROR" };
    }
    if (!response.ok) return { outcome: "ERROR" };
    const json = (await response.json()) as {
      isCorrect?: unknown;
      correctOptionIds?: unknown;
      explanation?: unknown;
    };
    if (typeof json.isCorrect !== "boolean") return { outcome: "ERROR" };
    const correctOptionIds =
      Array.isArray(json.correctOptionIds) &&
      json.correctOptionIds.every((id) => typeof id === "string")
        ? json.correctOptionIds
        : [];
    const explanation = typeof json.explanation === "string" ? json.explanation : null;
    return { outcome: "ACCEPTED", isCorrect: json.isCorrect, correctOptionIds, explanation };
  } catch {
    return { outcome: "ERROR" };
  }
}
