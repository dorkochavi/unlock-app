"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import Link from "next/link";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { Notice } from "@/components/notice";
import { Skeleton, SkeletonRows } from "@/components/skeleton";
import { StateBlock } from "@/components/state-block";
import { buildSignInHref } from "@/lib/safe-redirect";
import { getMessages } from "@/messages";
import type { CourseRole } from "@/domain/course/types";

import { TopicList } from "../../topic-list";
import { loadCourseProgress, type TopicProgressDto } from "../../progress/load-progress";

interface CourseContextDto {
  course: { id: string; title: string };
  /** `null` only when the actor has no `course_memberships` row (author-only, RUN010-H.2). */
  membership: { role: CourseRole; joinedAt: string } | null;
  /** RUN010-H.2 — independent `course_authors` signal, never derived from `membership.role`. */
  isAuthor?: boolean;
  /** Server-computed (ADR-020): LEARNER + active membership + PUBLISHED Course. */
  practiceAvailable?: boolean;
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
  const [topics, setTopics] = useState<TopicsState>({ kind: "loading" });

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

  // Fires immediately, in parallel with the context fetch above, instead of
  // waiting for it (UX3-6: measured waterfall showed ~300ms lost waiting for
  // context to resolve first). This endpoint is LEARNER-only by convention —
  // firing it before the role is known means an OWNER/INSTRUCTOR previewing
  // their own course wastes one harmless, already-authorized request (their
  // fetched result is simply never rendered, below); the endpoint itself
  // still authorizes independently, so this is not a data-exposure change.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await loadCourseProgress((url, init) => fetch(url, init), courseId);
      if (cancelled) return;
      setTopics(result.kind === "unauthenticated" ? { kind: "error" } : result);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <>
      {state.kind === "loading" ? (
        <div role="status">
          <span className="sr-only">{messages.courseView.loading}</span>
          <div aria-hidden="true" className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-surface bg-surface-muted p-6">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="mt-2 h-13 w-full" />
            </div>
            <div className="flex flex-col gap-3 rounded-card surface-raised p-5">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      ) : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={messages.courseView.signedOutTitle}
          action={<ButtonLink href={buildSignInHref(`/courses/${courseId}`)}>{messages.courseView.signedOutAction}</ButtonLink>}
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

      {state.kind === "ready" ? <CourseReady courseId={courseId} data={state.data} topics={topics} /> : null}
    </>
  );
}

/**
 * Ready Course view (Run UX-01 UX-1). Only existing valid destinations
 * (docs/UX_SPEC.md §3, §9 — no fake Course Practice):
 * - LEARNER → primary "תרגול בקורס" ONLY when the server says
 *   `practiceAvailable` (Run UX-02, UX_SPEC §10; otherwise absent, never
 *   disabled), above the SECONDARY navigation link to Today (`/today`), which
 *   is deliberately not a "continue learning" promise (Today may be complete).
 *   Plus this Course's Topic rows from the existing `topic-progress` endpoint;
 *   each becomes a Topic Practice link when Practice is available.
 * - OWNER / INSTRUCTOR → the existing instructor management page (primary).
 *   The learner-only Topic endpoint IS still called for them (fired
 *   unconditionally on mount, UX3-6, to avoid a sequential waterfall) but its
 *   result is never rendered outside the LEARNER branch below — see the
 *   `topics` effect above `CourseViewPage` for the tradeoff this accepts.
 */
function CourseReady({
  courseId,
  data,
  topics,
}: {
  courseId: string;
  data: CourseContextDto;
  topics: TopicsState;
}) {
  const messages = getMessages().courseView;
  const isLearner = data.membership !== null && data.membership.role === "LEARNER";

  const heroAction =
    "inline-flex min-h-12 w-full sm:flex-1 sm:min-h-control-lg items-center justify-center rounded-control bg-hero-foreground px-5 text-center text-body font-bold text-hero transition duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero-foreground";
  const heroQuiet =
    "inline-flex min-h-control w-full sm:flex-1 sm:min-h-control-lg items-center justify-center rounded-control bg-hero-soft px-5 text-center font-semibold text-hero-foreground transition duration-150 hover:bg-white/25 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero-foreground";

  return (
    <>
      <Card variant="hero" as="section" className="mb-5 px-5 py-4 sm:p-8">
        {data.membership !== null ? (
          <span className="chip bg-hero-soft text-hero-foreground">{messages.roleLabel[data.membership.role]}</span>
        ) : null}
        <h1 className="mt-2 break-words text-[1.625rem] font-extrabold leading-tight sm:mt-3 sm:text-page">{data.course.title}</h1>

        {isLearner ? (
          <div className="mt-3 sm:mt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2.5">
              {data.practiceAvailable === true ? (
                <Link href={`/courses/${courseId}/practice?from=course`} className={heroAction}>
                  {messages.practiceAction}
                </Link>
              ) : null}
              <Link href="/today" className={data.practiceAvailable === true ? heroQuiet : heroAction}>
                {messages.goToToday}
              </Link>
            </div>
            <p className="mt-2 text-center text-meta text-hero-muted sm:mt-3 sm:text-start sm:text-secondary">{messages.continueInTodayHint}</p>
          </div>
        ) : (
          <div className="mt-4 sm:mt-6 sm:max-w-xs">
            <Link href={`/instructor/courses/${courseId}`} className={heroAction}>
              {messages.manageCourse}
            </Link>
          </div>
        )}
      </Card>

      {isLearner ? (
        <CourseTopics courseId={courseId} practiceAvailable={data.practiceAvailable === true} topics={topics} />
      ) : null}
    </>
  );
}

type TopicsState =
  | { kind: "loading" }
  | { kind: "ready"; topics: TopicProgressDto[] }
  | { kind: "unavailable" }
  | { kind: "error" };

function CourseTopics({
  courseId,
  practiceAvailable,
  topics,
}: {
  courseId: string;
  practiceAvailable: boolean;
  topics: TopicsState;
}) {
  const messages = getMessages().courseView;

  return (
    <Card variant="raised" className="p-4 sm:p-5">
      <h2 className="mb-1 px-1 text-section font-bold">{messages.topicsHeading}</h2>
      {topics.kind === "loading" ? (
        <div className="pt-2">
          <SkeletonRows count={3} label={messages.topicsLoading} rowClassName="h-14 w-full" />
        </div>
      ) : null}
      {topics.kind === "error" ? (
        <Notice tone="error" className="pt-2">{messages.topicsError}</Notice>
      ) : null}
      {topics.kind === "unavailable" ? (
        <Notice className="pt-2">{messages.topicsUnavailable}</Notice>
      ) : null}
      {topics.kind === "ready" && topics.topics.length === 0 ? (
        <Notice className="pt-2">{messages.topicsEmpty}</Notice>
      ) : null}
      {topics.kind === "ready" && topics.topics.length > 0 ? (
        <TopicList
          topics={topics.topics}
          practice={practiceAvailable ? { courseId, from: "course" } : undefined}
        />
      ) : null}
    </Card>
  );
}
