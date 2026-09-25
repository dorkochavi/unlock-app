"use client";

/**
 * Learner Progress (Run 009 S2) — a simple, read-only, DESCRIPTIVE view of
 * the learner's own Topic states, grouped by their active Courses. Composed
 * from existing read models (see `load-progress.ts`); no percentages, scores,
 * readiness, streaks, ranking, or Topic practice controls. Today stays the
 * only system that decides what to do next, and this page links back to it.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { getMessages } from "@/messages";

import { loadProgress, type CourseProgress, type ProgressLoadResult } from "./load-progress";

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; courses: Extract<ProgressLoadResult, { outcome: "READY" }>["courses"] };

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}

function CourseSection({ title, progress }: { title: string; progress: CourseProgress }) {
  const messages = getMessages().progress;
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 break-words text-lg font-medium">{title}</h2>

      {progress.kind === "unavailable" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{messages.courseUnavailable}</p>
      ) : null}

      {progress.kind === "error" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{messages.courseError}</p>
      ) : null}

      {progress.kind === "ready" && progress.topics.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{messages.courseNoTopics}</p>
      ) : null}

      {progress.kind === "ready" && progress.topics.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {progress.topics.map((topic) => (
            <li key={topic.topicId} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-medium">{topic.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {interpolate(messages.coverage, {
                    attempted: String(topic.attemptedCount),
                    total: String(topic.totalCount),
                  })}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
                {messages.state[topic.state]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function LearnerProgressPage() {
  const messages = getMessages().progress;
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await loadProgress((url, init) => fetch(url, init));
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
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{messages.heading}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{messages.subheading}</p>
      </header>

      <main className="flex flex-1 items-start justify-center">
        {state.kind === "loading" ? (
          <p className="text-zinc-600 dark:text-zinc-400">{messages.loading}</p>
        ) : null}

        {state.kind === "signed-out" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.signedOutTitle}</p>
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {messages.signedOutAction}
            </Link>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.genericErrorTitle}</p>
            <button
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
            >
              {messages.retry}
            </button>
          </div>
        ) : null}

        {state.kind === "ready" && state.courses.length === 0 ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.emptyTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.emptyBody}</p>
          </div>
        ) : null}

        {state.kind === "ready" && state.courses.length > 0 ? (
          <div className="flex w-full max-w-2xl flex-col gap-4">
            {state.courses.map((course) => (
              <CourseSection key={course.id} title={course.title} progress={course.progress} />
            ))}
          </div>
        ) : null}
      </main>

      {state.kind !== "loading" && state.kind !== "signed-out" ? (
        <footer className="mt-8 text-center">
          <Link
            href="/today"
            className="inline-block px-4 py-3 text-sm text-zinc-500 underline dark:text-zinc-400"
          >
            {messages.backToToday}
          </Link>
        </footer>
      ) : null}
    </div>
  );
}
