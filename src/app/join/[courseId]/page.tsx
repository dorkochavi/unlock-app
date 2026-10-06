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
    <main className="page-container flex flex-1 items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-6 text-title font-semibold">{messages.join.heading}</h1>

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
          <Card as="section" className="flex flex-col gap-5">
            <p className="text-section font-semibold break-words">{state.title}</p>
            {state.joinError ? (
              <Notice tone="error" className="text-start">
                {messages.join.joinErrorTitle}
              </Notice>
            ) : null}
            <Button onClick={handleJoin} disabled={joining} fullWidth>
              {joining ? messages.join.joining : messages.join.joinAction}
            </Button>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
