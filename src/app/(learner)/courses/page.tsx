"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button, ButtonLink, buttonClasses } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { SkeletonRows } from "@/components/skeleton";
import { StateBlock } from "@/components/state-block";
import { buildSignInHref } from "@/lib/safe-redirect";
import { getMessages } from "@/messages";

import { CourseRow, type MyCourseDto } from "./course-row";

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; courses: MyCourseDto[] };

async function fetchMyCourses(): Promise<
  { outcome: "READY"; courses: MyCourseDto[] } | { outcome: "UNAUTHENTICATED" } | { outcome: "ERROR" }
> {
  let response: Response;
  try {
    response = await fetch("/api/courses/mine");
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) {
    return { outcome: "UNAUTHENTICATED" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  try {
    const body = (await response.json()) as { courses: MyCourseDto[] };
    return { outcome: "READY", courses: body.courses };
  } catch {
    return { outcome: "ERROR" };
  }
}

export default function MyCoursesPage() {
  const messages = getMessages();
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await fetchMyCourses();
      if (cancelled) return;
      if (result.outcome === "UNAUTHENTICATED") {
        setState({ kind: "signed-out" });
      } else if (result.outcome === "ERROR") {
        setState({ kind: "error" });
      } else {
        setState({ kind: "ready", courses: result.courses });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const hasManagementRole =
    state.kind === "ready" && state.courses.some((course) => course.isAuthor);

  return (
    <>
      <PageHeader
        title={messages.myCourses.heading}
        trailing={
          hasManagementRole ? (
            <ButtonLink href="/instructor/courses" variant="secondary">
              {messages.myCourses.instructorLink}
            </ButtonLink>
          ) : undefined
        }
      />

      {state.kind === "loading" ? <SkeletonRows count={3} label={messages.myCourses.loading} rowClassName="h-20 w-full rounded-card" /> : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={messages.myCourses.signedOutTitle}
          action={<ButtonLink href={buildSignInHref("/courses")}>{messages.myCourses.signedOutAction}</ButtonLink>}
        />
      ) : null}

      {state.kind === "error" ? (
        <StateBlock
          tone="error"
          title={messages.myCourses.genericErrorTitle}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
            >
              {messages.myCourses.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" && state.courses.length === 0 ? (
        <StateBlock title={messages.myCourses.emptyTitle} body={messages.myCourses.emptyBody} />
      ) : null}

      {/* Each Course is one card and the whole card is the link (no competing
          primary button per card). A per-Course learning-state summary is
          deferred (docs/UX_SPEC.md §9): it would need a Course-level rollup
          of Topic states that no accepted policy defines yet. See `CourseRow`
          above for the QA2-B visual-accent rationale. */}
      {state.kind === "ready" && state.courses.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {state.courses.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              roleLabel={course.role ? messages.myCourses.roleLabel[course.role] : ""}
            />
          ))}
        </ul>
      ) : null}

      {state.kind === "ready" && !hasManagementRole ? (
        <footer className="mt-10 text-center">
          <Link
            href="/instructor/courses"
            className={buttonClasses("tertiary", { className: "text-secondary" })}
          >
            {messages.myCourses.instructorLink}
          </Link>
        </footer>
      ) : null}
    </>
  );
}
