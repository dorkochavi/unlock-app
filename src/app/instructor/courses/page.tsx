"use client";

/**
 * Instructor Courses list (Run 005 S3). Reuses `GET /api/courses/mine`
 * exactly as My Courses does — that route already returns every active
 * membership with its role, unfiltered and undowngraded
 * (`list-my-courses.ts`'s own doc comment) — and filters to OWNER/INSTRUCTOR
 * client-side rather than adding a second, near-duplicate listing route.
 * Course `status` is not part of that DTO, so this list shows title + role
 * only; the per-Course status/lifecycle lives on the manage page
 * (`[courseId]/page.tsx`), matching the Plan's "narrowest coherent instructor
 * surface" principle rather than pre-fetching authoring data for every row.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { Button, ButtonLink } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { LoadingState, StateBlock } from "@/components/state-block";
import { getMessages } from "@/messages";
import type { CourseRole } from "@/domain/course/types";

interface MyCourseDto {
  id: string;
  title: string;
  role: CourseRole;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; courses: MyCourseDto[] };

const MANAGEMENT_ROLES: readonly CourseRole[] = ["OWNER", "INSTRUCTOR"];

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

export default function InstructorCoursesPage() {
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
        setState({
          kind: "ready",
          courses: result.courses.filter((course) => MANAGEMENT_ROLES.includes(course.role)),
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:max-w-3xl">
      <PageHeader
        title={messages.instructor.courses.heading}
        trailing={
          // Suppressed when the list is empty: the empty StateBlock below carries
          // its own "Create Course" primary action, and two equal-weight primaries
          // on one screen would violate UX_SPEC §11 item 3.
          state.kind === "ready" && state.courses.length > 0 ? (
            <ButtonLink href="/instructor/courses/new">{messages.instructor.courses.createAction}</ButtonLink>
          ) : undefined
        }
      />

      {state.kind === "loading" ? <LoadingState label={messages.instructor.courses.loading} /> : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={messages.instructor.courses.signedOutTitle}
          action={<ButtonLink href="/login">{messages.instructor.courses.signedOutAction}</ButtonLink>}
        />
      ) : null}

      {state.kind === "error" ? (
        <StateBlock
          tone="error"
          title={messages.instructor.courses.genericErrorTitle}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
            >
              {messages.instructor.courses.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" && state.courses.length === 0 ? (
        <StateBlock
          title={messages.instructor.courses.emptyTitle}
          body={messages.instructor.courses.emptyBody}
          action={<ButtonLink href="/instructor/courses/new">{messages.instructor.courses.createAction}</ButtonLink>}
        />
      ) : null}

      {state.kind === "ready" && state.courses.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {state.courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/instructor/courses/${course.id}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5 transition hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="min-w-0 truncate font-medium" title={course.title}>
                  {course.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
