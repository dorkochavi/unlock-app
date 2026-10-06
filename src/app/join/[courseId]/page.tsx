"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Notice } from "@/components/notice";
import { LoadingState, StateBlock } from "@/components/state-block";
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
    <main className="page-container flex flex-1 flex-col items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-sm text-center">
        <p className={`text-title font-extrabold text-primary ${state.kind === "ready" ? "mb-5" : "mb-2"}`}>
          {messages.shell.heading}
        </p>
        {state.kind === "ready" ? null : (
          <h1 className="mb-2 text-section font-semibold">{messages.join.heading}</h1>
        )}

        {state.kind === "loading" ? <LoadingState label={messages.join.loading} /> : null}

        {state.kind === "notFound" ? (
          <StateBlock title={messages.join.notFoundTitle} body={messages.join.notFoundBody} />
        ) : null}

        {state.kind === "error" ? (
          <StateBlock
            tone="error"
            title={messages.join.genericErrorTitle}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setState({ kind: "loading" });
                  setRetryCount((count) => count + 1);
                }}
              >
                {messages.join.retry}
              </Button>
            }
          />
        ) : null}

        {state.kind === "notAuthorized" ? (
          <StateBlock title={messages.join.notAuthorizedTitle} body={messages.join.notAuthorizedBody} />
        ) : null}

        {state.kind === "accessRevoked" ? (
          <StateBlock title={messages.join.accessRevokedTitle} body={messages.join.accessRevokedBody} />
        ) : null}

        {state.kind === "ready" ? (
          <Card variant="hero" as="section" className="flex flex-col gap-5 p-6 text-start sm:p-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-secondary font-semibold text-hero-muted">{messages.join.heading}</h1>
              <p className="text-title font-extrabold break-words">{state.title}</p>
            </div>
            {state.joinError ? (
              <Notice tone="error" className="text-start">
                {messages.join.joinErrorTitle}
              </Notice>
            ) : null}
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="inline-flex min-h-control-lg w-full items-center justify-center rounded-control bg-white px-6 text-body font-bold text-hero shadow-[0_6px_16px_-8px_rgb(0_0_0/0.5)] transition duration-150 hover:bg-hero-muted active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-75 disabled:hover:bg-white disabled:active:scale-100"
            >
              {joining ? messages.join.joining : messages.join.joinAction}
            </button>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
