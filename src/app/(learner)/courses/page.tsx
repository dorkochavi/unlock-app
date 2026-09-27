"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button, ButtonLink, buttonClasses } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { LoadingState, StateBlock } from "@/components/state-block";
import { buildSignInHref } from "@/lib/safe-redirect";
import { getMessages } from "@/messages";
import type { CourseRole } from "@/domain/course/types";

interface MyCourseDto {
  id: string;
  title: string;
  role: CourseRole;
}

const MANAGEMENT_ROLES: readonly CourseRole[] = ["OWNER", "INSTRUCTOR"];

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
    state.kind === "ready" && state.courses.some((course) => MANAGEMENT_ROLES.includes(course.role));

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

      {state.kind === "loading" ? <LoadingState label={messages.myCourses.loading} /> : null}

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
          of Topic states that no accepted policy defines yet. */}
      {state.kind === "ready" && state.courses.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {state.courses.map((course) => {
            const roleLabel = messages.myCourses.roleLabel[course.role];
            return (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5 transition hover:border-border-strong active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0 break-words font-medium">{course.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
                    {roleLabel ? <span>{roleLabel}</span> : null}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-5 rtl:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {state.kind === "ready" && !hasManagementRole ? (
        <footer className="mt-10 text-center">
          <Link
            href="/instructor/courses"
            className={buttonClasses("tertiary", { className: "text-sm" })}
          >
            {messages.myCourses.instructorLink}
          </Link>
        </footer>
      ) : null}
    </>
  );
}
