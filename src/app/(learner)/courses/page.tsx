"use client";

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

  return (
    <div className="flex flex-1 flex-col p-6 sm:p-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{messages.myCourses.heading}</h1>
      </header>

      <main className="flex flex-1 items-start justify-center">
        {state.kind === "loading" ? (
          <p className="text-zinc-600 dark:text-zinc-400">{messages.myCourses.loading}</p>
        ) : null}

        {state.kind === "signed-out" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.myCourses.signedOutTitle}</p>
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {messages.myCourses.signedOutAction}
            </Link>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.myCourses.genericErrorTitle}</p>
            <button
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
            >
              {messages.myCourses.retry}
            </button>
          </div>
        ) : null}

        {state.kind === "ready" && state.courses.length === 0 ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.myCourses.emptyTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.myCourses.emptyBody}</p>
          </div>
        ) : null}

        {state.kind === "ready" && state.courses.length > 0 ? (
          <ul className="flex w-full max-w-2xl flex-col gap-3">
            {state.courses.map((course) => {
              const roleLabel = messages.myCourses.roleLabel[course.role];
              return (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                  >
                    <span className="min-w-0 truncate font-medium" title={course.title}>
                      {course.title}
                    </span>
                    {roleLabel ? (
                      <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
                        {roleLabel}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
