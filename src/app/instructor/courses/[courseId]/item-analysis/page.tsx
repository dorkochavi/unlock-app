"use client";

/**
 * Instructor Item Analysis page (Pre-Pilot S2) — minimal, neutral, raw
 * per-Question evidence for the CURRENT QuestionVersion. Manual refresh and
 * a visible last-updated time only (no polling/realtime).
 *
 * Shows only what the API returns: for a non-ELIGIBLE item the API returns
 * no numbers at all, and this page renders only the insufficient-data
 * message. No interpretation wording (no "weak"/"struggling"), no learner
 * identity, no per-option distribution.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { getMessages } from "@/messages";

type Disclosure = "ELIGIBLE" | "INSUFFICIENT_COURSE_SIZE" | "INSUFFICIENT_RESPONSES";

interface ItemDto {
  questionId: string;
  questionVersionId: string;
  prompt: string;
  disclosure: Disclosure;
  stats: {
    distinctResponderCount: number;
    correctCount: number;
    incorrectCount: number;
    incorrectRatePercent: number;
  } | null;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "notFound" }
  | { kind: "notAuthorized" }
  | { kind: "notActive" }
  | { kind: "error" }
  | { kind: "ready"; generatedAt: string; items: ItemDto[] };

type FetchResult =
  | { outcome: "READY"; generatedAt: string; items: ItemDto[] }
  | { outcome: "UNAUTHENTICATED" | "NOT_FOUND" | "NOT_AUTHORIZED" | "NOT_ACTIVE" | "ERROR" };

async function fetchItemAnalysis(courseId: string): Promise<FetchResult> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/item-analysis`, { cache: "no-store" });
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) return { outcome: "UNAUTHENTICATED" };
  if (response.status === 404) return { outcome: "NOT_FOUND" };
  if (response.status === 403) return { outcome: "NOT_AUTHORIZED" };
  if (response.status === 409) return { outcome: "NOT_ACTIVE" };
  if (!response.ok) return { outcome: "ERROR" };
  try {
    const body = (await response.json()) as { generatedAt: string; items: ItemDto[] };
    return { outcome: "READY", generatedAt: body.generatedAt, items: body.items };
  } catch {
    return { outcome: "ERROR" };
  }
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}

export default function InstructorItemAnalysisPage() {
  const messages = getMessages().itemAnalysis;
  const loadingMessage = getMessages().instructor.manage.loading;
  const params = useParams<{ courseId: string }>();
  const courseId = String(params.courseId);

  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (): Promise<ViewState> => {
    const result = await fetchItemAnalysis(courseId);
    switch (result.outcome) {
      case "UNAUTHENTICATED":
        return { kind: "signed-out" };
      case "NOT_FOUND":
        return { kind: "notFound" };
      case "NOT_AUTHORIZED":
        return { kind: "notAuthorized" };
      case "NOT_ACTIVE":
        return { kind: "notActive" };
      case "ERROR":
        return { kind: "error" };
      case "READY":
        return { kind: "ready", generatedAt: result.generatedAt, items: result.items };
    }
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    load().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    const next = await load();
    setState(next);
    setRefreshing(false);
  }

  function retry() {
    setState({ kind: "loading" });
    load().then(setState);
  }

  return (
    <div className="flex flex-1 flex-col p-6 sm:p-10">
      <main className="flex flex-1 items-start justify-center">
        {state.kind === "loading" ? (
          <p className="text-zinc-600 dark:text-zinc-400">{loadingMessage}</p>
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

        {state.kind === "notFound" ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.notFoundTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.notFoundBody}</p>
          </div>
        ) : null}

        {state.kind === "notAuthorized" ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.notAuthorizedTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.notAuthorizedBody}</p>
          </div>
        ) : null}

        {state.kind === "notActive" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.courseNotActiveTitle}</p>
            <Link
              href={`/instructor/courses/${courseId}`}
              className="text-sm text-zinc-500 underline dark:text-zinc-400"
            >
              {messages.backToCourse}
            </Link>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.genericErrorTitle}</p>
            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
            >
              {messages.retry}
            </button>
          </div>
        ) : null}

        {state.kind === "ready" ? (
          <div className="w-full max-w-4xl">
            <Link
              href={`/instructor/courses/${courseId}`}
              className="mb-4 inline-block text-sm text-zinc-500 underline dark:text-zinc-400"
            >
              {messages.backToCourse}
            </Link>

            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{messages.heading}</h1>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {interpolate(messages.lastUpdated, {
                    time: new Date(state.generatedAt).toLocaleTimeString("he-IL"),
                  })}
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {refreshing ? messages.refreshing : messages.refreshAction}
                </button>
              </div>
            </div>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{messages.subheading}</p>

            {state.items.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">{messages.emptyTitle}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {state.items.map((item) => (
                  <li
                    key={item.questionId}
                    className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <p className="mb-3 text-base font-medium">{item.prompt}</p>
                    {item.disclosure === "ELIGIBLE" && item.stats !== null ? (
                      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <li>
                          {interpolate(messages.respondersCount, {
                            count: String(item.stats.distinctResponderCount),
                          })}
                        </li>
                        <li>
                          {interpolate(messages.correctCount, { count: String(item.stats.correctCount) })}
                        </li>
                        <li>
                          {interpolate(messages.incorrectCount, {
                            count: String(item.stats.incorrectCount),
                          })}
                        </li>
                        <li>
                          {interpolate(messages.incorrectRate, {
                            percent: String(item.stats.incorrectRatePercent),
                          })}
                        </li>
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {item.disclosure === "INSUFFICIENT_COURSE_SIZE"
                          ? messages.courseSizeInsufficient
                          : messages.responsesInsufficient}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
