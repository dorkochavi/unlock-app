"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getMessages } from "@/messages";

type ViewState =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "error" }
  | { kind: "ready"; title: string; joinError: boolean }
  | { kind: "notAuthorized" }
  | { kind: "accessRevoked" };

async function fetchCourseTitle(
  courseId: string,
): Promise<{ outcome: "READY"; title: string } | { outcome: "NOT_FOUND" } | { outcome: "ERROR" }> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}`);
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 404) {
    return { outcome: "NOT_FOUND" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  try {
    const body = (await response.json()) as { course: { title: string } };
    return { outcome: "READY", title: body.course.title };
  } catch {
    return { outcome: "ERROR" };
  }
}

type JoinOutcome =
  | { outcome: "JOINED" }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "ACCESS_REVOKED" }
  | { outcome: "NOT_FOUND" }
  | { outcome: "ERROR" };

async function joinCourseRequest(courseId: string): Promise<JoinOutcome> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/join`, { method: "POST" });
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) {
    return { outcome: "UNAUTHENTICATED" };
  }
  if (response.status === 404) {
    return { outcome: "NOT_FOUND" };
  }
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    return body?.error?.code === "ACCESS_REVOKED"
      ? { outcome: "ACCESS_REVOKED" }
      : { outcome: "NOT_AUTHORIZED" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  return { outcome: "JOINED" };
}

export default function JoinCoursePage() {
  const messages = getMessages();
  const params = useParams<{ courseId: string }>();
  const courseId = String(params.courseId);
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [joining, setJoining] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await fetchCourseTitle(courseId);
      if (cancelled) return;
      if (result.outcome === "READY") {
        setState({ kind: "ready", title: result.title, joinError: false });
      } else if (result.outcome === "NOT_FOUND") {
        setState({ kind: "notFound" });
      } else {
        setState({ kind: "error" });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, retryCount]);

  async function handleJoin() {
    if (joining) return;
    setJoining(true);
    try {
      const result = await joinCourseRequest(courseId);
      switch (result.outcome) {
        case "UNAUTHENTICATED":
          router.push(`/login?next=${encodeURIComponent(`/join/${courseId}`)}`);
          return;
        case "NOT_AUTHORIZED":
          setState({ kind: "notAuthorized" });
          return;
        case "ACCESS_REVOKED":
          setState({ kind: "accessRevoked" });
          return;
        case "NOT_FOUND":
          setState({ kind: "notFound" });
          return;
        case "ERROR":
          setState((previous) =>
            previous.kind === "ready" ? { ...previous, joinError: true } : previous,
          );
          return;
        case "JOINED":
          router.push("/today");
          router.refresh();
          return;
      }
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{messages.join.heading}</h1>

        {state.kind === "loading" ? <p className="text-zinc-600 dark:text-zinc-400">{messages.join.loading}</p> : null}

        {state.kind === "notFound" ? (
          <div>
            <p className="mb-2 text-lg">{messages.join.notFoundTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.join.notFoundBody}</p>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div>
            <p className="mb-4 text-lg">{messages.join.genericErrorTitle}</p>
            <button
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
            >
              {messages.join.retry}
            </button>
          </div>
        ) : null}

        {state.kind === "notAuthorized" ? (
          <div>
            <p className="mb-2 text-lg">{messages.join.notAuthorizedTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.join.notAuthorizedBody}</p>
          </div>
        ) : null}

        {state.kind === "accessRevoked" ? (
          <div>
            <p className="mb-2 text-lg">{messages.join.accessRevokedTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.join.accessRevokedBody}</p>
          </div>
        ) : null}

        {state.kind === "ready" ? (
          <div>
            <p className="mb-6 text-lg font-medium">{state.title}</p>
            {state.joinError ? (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400">{messages.join.joinErrorTitle}</p>
            ) : null}
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {joining ? messages.join.joining : messages.join.joinAction}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
