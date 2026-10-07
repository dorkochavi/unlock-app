"use client";

/**
 * Author-dual-role entry actions on the instructor Course surface (Run
 * 2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001 Slice A).
 *
 * An Author is NOT automatically a learner (FUB-036 Option 4, RUN010-H.3:
 * authoring and learner membership are independent). This component only makes
 * the EXISTING safe self-enrollment path discoverable: "ללמוד את הקורס" calls
 * the existing `POST /api/courses/:id/join` (server-authorized; the author
 * bypass for DRAFT/AUTHORIZED_ONLY and the OQ-045 ARCHIVED hard-stop live in
 * `joinCourse`), then opens the ordinary learner Course page. The join is
 * idempotent (`ALREADY_MEMBER`), so an existing active learner is simply
 * navigated in without any mutation. No auto-enrollment, no second learning
 * path, no evidence/Today change.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

import { Notice } from "@/components/notice";
import { getMessages } from "@/messages";

export type LearnOwnCourseOutcome =
  | "READY"
  | "UNAUTHENTICATED"
  | "NOT_AUTHORIZED"
  | "ACCESS_REVOKED"
  | "NOT_FOUND"
  | "ERROR";

/** Maps the existing join endpoint's HTTP contract to a UI outcome. */
export async function enrollSelfAsLearner(
  courseId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LearnOwnCourseOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/courses/${courseId}/join`, { method: "POST" });
  } catch {
    return "ERROR";
  }
  if (response.status === 401) return "UNAUTHENTICATED";
  if (response.status === 404) return "NOT_FOUND";
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    return body?.error?.code === "ACCESS_REVOKED" ? "ACCESS_REVOKED" : "NOT_AUTHORIZED";
  }
  return response.ok ? "READY" : "ERROR";
}

export function OwnCourseActionsView({
  manageHref,
  onLearn,
  learning,
  errorMessage,
}: {
  manageHref: string;
  onLearn: () => void;
  learning: boolean;
  errorMessage: string | null;
}) {
  const messages = getMessages().instructor.manage.ownCourse;
  return (
    <div className="flex flex-col gap-2">
      {/* Rendered on the light tinted header: one primary, one quiet secondary. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onLearn}
          disabled={learning}
          className="inline-flex min-h-control-lg w-full items-center justify-center rounded-control bg-primary px-6 text-body font-bold text-primary-contrast transition duration-150 hover:bg-primary-hover active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-75 disabled:hover:bg-primary disabled:active:scale-100 sm:w-auto sm:min-w-48"
        >
          {learning ? messages.learning : messages.learnAction}
        </button>
        <Link
          href={manageHref}
          className="inline-flex min-h-control-lg w-full items-center justify-center rounded-control border border-border-strong bg-surface px-6 text-center font-semibold text-foreground transition duration-150 hover:bg-surface-muted active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
        >
          {messages.manageAction}
        </Link>
      </div>
      {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}
    </div>
  );
}

export function OwnCourseActions({ courseId }: { courseId: string }) {
  const messages = getMessages().instructor.manage.ownCourse;
  const router = useRouter();
  const [learning, setLearning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLearn() {
    if (learning) return;
    setLearning(true);
    setError(null);
    const outcome = await enrollSelfAsLearner(courseId);
    switch (outcome) {
      case "READY":
        router.push(`/courses/${courseId}`);
        return;
      case "UNAUTHENTICATED":
        router.push(`/login?next=${encodeURIComponent(`/instructor/courses/${courseId}`)}`);
        return;
      case "NOT_AUTHORIZED":
        setError(messages.notAllowedError);
        break;
      case "ACCESS_REVOKED":
        setError(messages.accessRevokedError);
        break;
      case "NOT_FOUND":
      case "ERROR":
        setError(messages.genericError);
        break;
    }
    setLearning(false);
  }

  return (
    <OwnCourseActionsView
      manageHref="#course-management"
      onLearn={handleLearn}
      learning={learning}
      errorMessage={error}
    />
  );
}
