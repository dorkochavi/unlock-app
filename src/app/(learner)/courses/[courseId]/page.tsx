"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { LoadingState, StateBlock } from "@/components/state-block";
import { getMessages } from "@/messages";
import type { CourseRole } from "@/domain/course/types";

import { TopicList } from "../../topic-list";
import { loadCourseProgress, type TopicProgressDto } from "../../progress/load-progress";

interface CourseContextDto {
  course: { id: string; title: string };
  membership: { role: CourseRole; joinedAt: string };
}

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "notFound" }
  | { kind: "notAuthorized" }
  | { kind: "accessRevoked" }
  | { kind: "error" }
  | { kind: "ready"; data: CourseContextDto };

async function fetchCourseContext(
  courseId: string,
): Promise<
  | { outcome: "READY"; data: CourseContextDto }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "NOT_FOUND" }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "ACCESS_REVOKED" }
  | { outcome: "ERROR" }
> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/context`);
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
  try {
    const data = (await response.json()) as CourseContextDto;
    return { outcome: "READY", data };
  } catch {
    return { outcome: "ERROR" };
  }
}

export default function CourseViewPage() {
  const messages = getMessages();
  const params = useParams<{ courseId: string }>();
  const courseId = String(params.courseId);
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await fetchCourseContext(courseId);
      if (cancelled) return;
      switch (result.outcome) {
        case "UNAUTHENTICATED":
          setState({ kind: "signed-out" });
          return;
        case "NOT_FOUND":
          setState({ kind: "notFound" });
          return;
        case "NOT_AUTHORIZED":
          setState({ kind: "notAuthorized" });
          return;
        case "ACCESS_REVOKED":
          setState({ kind: "accessRevoked" });
          return;
        case "ERROR":
          setState({ kind: "error" });
          return;
        case "READY":
          setState({ kind: "ready", data: result.data });
          return;
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, retryCount]);

  return (
    <>
      {state.kind === "loading" ? <LoadingState label={messages.courseView.loading} /> : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={messages.courseView.signedOutTitle}
          action={<ButtonLink href="/login">{messages.courseView.signedOutAction}</ButtonLink>}
        />
      ) : null}

      {state.kind === "notFound" ? (
        <StateBlock
          title={messages.courseView.notFoundTitle}
          body={messages.courseView.notFoundBody}
          action={
            <ButtonLink href="/courses" variant="secondary">
              {messages.courseView.backToCourses}
            </ButtonLink>
          }
        />
      ) : null}

      {state.kind === "notAuthorized" ? (
        <StateBlock
          title={messages.courseView.notAuthorizedTitle}
          body={messages.courseView.notAuthorizedBody}
        />
      ) : null}

      {state.kind === "accessRevoked" ? (
        <StateBlock
          title={messages.courseView.accessRevokedTitle}
          body={messages.courseView.accessRevokedBody}
        />
      ) : null}

      {state.kind === "error" ? (
        <StateBlock
          tone="error"
          title={messages.courseView.genericErrorTitle}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
            >
              {messages.courseView.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" ? <CourseReady courseId={courseId} data={state.data} /> : null}
    </>
  );
}

/**
 * Ready Course view (Run UX-01 UX-1). Only existing valid destinations
 * (docs/UX_SPEC.md §3, §9 — no fake Course Practice):
 * - LEARNER → a SECONDARY navigation link to Today (`/today`), deliberately
 *   not a primary "continue learning" promise: Today may already be complete,
 *   and no Course-scoped learning action exists until UX-3. No replacement
 *   primary action is invented. Plus this Course's Topic rows from the
 *   existing `topic-progress` endpoint (informational; no per-Topic action).
 * - OWNER / INSTRUCTOR → the existing instructor management page (primary).
 *   The learner-only Topic endpoint is not called for them.
 */
function CourseReady({ courseId, data }: { courseId: string; data: CourseContextDto }) {
  const messages = getMessages().courseView;
  const isLearner = data.membership.role === "LEARNER";

  return (
    <>
      <PageHeader title={data.course.title} subtitle={messages.roleLabel[data.membership.role]} />

      {isLearner ? (
        <>
          <div className="mb-8 flex flex-col gap-2">
            <ButtonLink href="/today" variant="secondary" fullWidth>
              {messages.goToToday}
            </ButtonLink>
            <p className="text-center text-sm text-muted">{messages.continueInTodayHint}</p>
          </div>
          <CourseTopics courseId={courseId} />
        </>
      ) : (
        <ButtonLink href={`/instructor/courses/${courseId}`} fullWidth>
          {messages.manageCourse}
        </ButtonLink>
      )}
    </>
  );
}

type TopicsState =
  | { kind: "loading" }
  | { kind: "ready"; topics: TopicProgressDto[] }
  | { kind: "unavailable" }
  | { kind: "error" };

function CourseTopics({ courseId }: { courseId: string }) {
  const messages = getMessages().courseView;
  const [topics, setTopics] = useState<TopicsState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await loadCourseProgress((url, init) => fetch(url, init), courseId);
      if (cancelled) return;
      // A 401 here (session expired between the two requests) degrades to the
      // Topic-level error line; the page-level context already loaded.
      setTopics(result.kind === "unauthenticated" ? { kind: "error" } : result);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">{messages.topicsHeading}</h2>
      {topics.kind === "loading" ? (
        <p role="status" className="pt-2 text-sm text-muted">
          {messages.topicsLoading}
        </p>
      ) : null}
      {topics.kind === "error" ? (
        <p className="pt-2 text-sm text-muted">{messages.topicsError}</p>
      ) : null}
      {topics.kind === "unavailable" ? (
        <p className="pt-2 text-sm text-muted">{messages.topicsUnavailable}</p>
      ) : null}
      {topics.kind === "ready" && topics.topics.length === 0 ? (
        <p className="pt-2 text-sm text-muted">{messages.topicsEmpty}</p>
      ) : null}
      {topics.kind === "ready" && topics.topics.length > 0 ? (
        <TopicList topics={topics.topics} />
      ) : null}
    </Card>
  );
}
