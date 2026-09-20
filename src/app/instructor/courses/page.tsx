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
    <div className="flex flex-1 flex-col p-6 sm:p-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{messages.instructor.courses.heading}</h1>
        {state.kind === "ready" ? (
          <Link
            href="/instructor/courses/new"
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {messages.instructor.courses.createAction}
          </Link>
        ) : null}
      </header>

      <main className="flex flex-1 items-start justify-center">
        {state.kind === "loading" ? (
          <p className="text-zinc-600 dark:text-zinc-400">{messages.instructor.courses.loading}</p>
        ) : null}

        {state.kind === "signed-out" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.instructor.courses.signedOutTitle}</p>
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {messages.instructor.courses.signedOutAction}
            </Link>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.instructor.courses.genericErrorTitle}</p>
            <button
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
            >
              {messages.instructor.courses.retry}
            </button>
          </div>
        ) : null}

        {state.kind === "ready" && state.courses.length === 0 ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.instructor.courses.emptyTitle}</p>
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">{messages.instructor.courses.emptyBody}</p>
            <Link
              href="/instructor/courses/new"
              className="inline-block rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {messages.instructor.courses.createAction}
            </Link>
          </div>
        ) : null}

        {state.kind === "ready" && state.courses.length > 0 ? (
          <ul className="flex w-full max-w-2xl flex-col gap-3">
            {state.courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/instructor/courses/${course.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
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
    </div>
  );
}
