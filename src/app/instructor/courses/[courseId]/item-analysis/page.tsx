"use client";

/**
 * Instructor "ניתוח תשובות" page (Run 009 S3) — ONE surface with two
 * read-only sections: Topic-level Insights and Question-level Item Analysis.
 * Both follow the F-02 privacy contract: the APIs return only a coarse
 * descriptive first-answer band (or an explicit insufficient-data state) —
 * no counts, percentages, learner identity, or per-option data — and this
 * page renders only that. Manual refresh and a visible last-updated time
 * only (no polling/realtime); intended to be refreshed after a group
 * answering window, not after each individual response. No interpretation
 * wording (no "weak"/"struggling"/"needs reinforcement").
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { LoadingState, StateBlock } from "@/components/state-block";
import { getMessages } from "@/messages";

type Band = "MOSTLY_CORRECT" | "MIXED" | "MOSTLY_INCORRECT";
type Disclosure = "ELIGIBLE" | "INSUFFICIENT_DATA";

interface ItemDto {
  questionId: string;
  questionVersionId: string;
  prompt: string;
  disclosure: Disclosure;
  band: Band | null;
}

interface TopicDto {
  topicId: string | null;
  name: string | null;
  archived: boolean;
  disclosure: Disclosure;
  band: Band | null;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "notFound" }
  | { kind: "notAuthorized" }
  | { kind: "notActive" }
  | { kind: "error" }
  | { kind: "ready"; generatedAt: string; items: ItemDto[]; topics: TopicDto[] };

type FetchResult =
  | { outcome: "READY"; generatedAt: string; items: ItemDto[]; topics: TopicDto[] }
  | { outcome: "UNAUTHENTICATED" | "NOT_FOUND" | "NOT_AUTHORIZED" | "NOT_ACTIVE" | "ERROR" };

type Endpoint = "item-analysis" | "topic-insights";

async function fetchEndpoint<T>(
  courseId: string,
  endpoint: Endpoint,
): Promise<{ outcome: "OK"; body: T } | { outcome: Exclude<FetchResult["outcome"], "READY"> }> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/${endpoint}`, { cache: "no-store" });
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) return { outcome: "UNAUTHENTICATED" };
  if (response.status === 404) return { outcome: "NOT_FOUND" };
  if (response.status === 403) return { outcome: "NOT_AUTHORIZED" };
  if (response.status === 409) return { outcome: "NOT_ACTIVE" };
  if (!response.ok) return { outcome: "ERROR" };
  try {
    return { outcome: "OK", body: (await response.json()) as T };
  } catch {
    return { outcome: "ERROR" };
  }
}

async function fetchAnalysis(courseId: string): Promise<FetchResult> {
  const [items, topics] = await Promise.all([
    fetchEndpoint<{ generatedAt: string; items: ItemDto[] }>(courseId, "item-analysis"),
    fetchEndpoint<{ generatedAt: string; topics: TopicDto[] }>(courseId, "topic-insights"),
  ]);
  if (items.outcome !== "OK") return { outcome: items.outcome };
  if (topics.outcome !== "OK") return { outcome: topics.outcome };
  return {
    outcome: "READY",
    generatedAt: items.body.generatedAt,
    items: items.body.items,
    topics: topics.body.topics,
  };
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}

function BandLine({ disclosure, band }: { disclosure: Disclosure; band: Band | null }) {
  const messages = getMessages().itemAnalysis;
  return (
    <p className="text-sm text-muted">
      {disclosure === "ELIGIBLE" && band !== null ? messages.band[band] : messages.insufficientData}
    </p>
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
    const result = await fetchAnalysis(courseId);
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
        return {
          kind: "ready",
          generatedAt: result.generatedAt,
          items: result.items,
          topics: result.topics,
        };
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
      {state.kind === "loading" ? <LoadingState label={loadingMessage} /> : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={messages.signedOutTitle}
          action={<ButtonLink href="/login">{messages.signedOutAction}</ButtonLink>}
        />
      ) : null}

      {state.kind === "notFound" ? (
        <StateBlock title={messages.notFoundTitle} body={messages.notFoundBody} />
      ) : null}

      {state.kind === "notAuthorized" ? (
        <StateBlock title={messages.notAuthorizedTitle} body={messages.notAuthorizedBody} />
      ) : null}

      {state.kind === "notActive" ? (
        <StateBlock
          title={messages.courseNotActiveTitle}
          action={
            <Link
              href={`/instructor/courses/${courseId}`}
              className="text-sm text-subtle underline-offset-4 hover:text-foreground hover:underline"
            >
              {messages.backToCourse}
            </Link>
          }
        />
      ) : null}

      {state.kind === "error" ? (
        <StateBlock
          tone="error"
          title={messages.genericErrorTitle}
          action={
            <Button variant="secondary" onClick={retry}>
              {messages.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" ? (
        <div className="flex flex-col gap-4">
          <Link
            href={`/instructor/courses/${courseId}`}
            className="text-sm text-subtle underline-offset-4 hover:text-foreground hover:underline"
          >
            {messages.backToCourse}
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{messages.heading}</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">
                {interpolate(messages.lastUpdated, {
                  time: new Date(state.generatedAt).toLocaleTimeString("he-IL"),
                })}
              </span>
              {/* A manual-refresh utility action, not a page-level create/publish
                  action — secondary, not primary (UX_SPEC §11 item 3). */}
              <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? messages.refreshing : messages.refreshAction}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted">{messages.subheading}</p>

          <Card as="section" aria-labelledby="topic-insights-heading">
            <h2 id="topic-insights-heading" className="mb-3 text-lg font-semibold">
              {messages.topicsHeading}
            </h2>
            {state.topics.length === 0 ? (
              <p className="text-muted">{messages.noTopicsTitle}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {state.topics.map((topic) => (
                  <li key={topic.topicId ?? "no-topic"} className="rounded-lg border border-border p-4">
                    <p className="mb-2 text-base font-medium">
                      {topic.topicId === null ? messages.noTopicLabel : topic.name}
                      {topic.archived ? (
                        <span className="ms-2 text-sm font-normal text-subtle">{messages.archivedTopicLabel}</span>
                      ) : null}
                    </p>
                    <BandLine disclosure={topic.disclosure} band={topic.band} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card as="section" aria-labelledby="item-analysis-heading">
            <h2 id="item-analysis-heading" className="mb-3 text-lg font-semibold">
              {messages.questionsHeading}
            </h2>
            {state.items.length === 0 ? (
              <p className="text-muted">{messages.emptyTitle}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {state.items.map((item) => (
                  <li key={item.questionId} className="rounded-lg border border-border p-4">
                    <p className="mb-3 text-base font-medium">{item.prompt}</p>
                    <BandLine disclosure={item.disclosure} band={item.band} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </main>
  );
}
