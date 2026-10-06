"use client";

/**
 * Practice batch-complete summary (extracted from page.tsx, unchanged look/copy).
 * Slice E: "עוד 10" no longer swaps the screen for a full-screen loader — the
 * summary stays visible while the next batch loads (inline pending on the
 * button) and a failed load shows an inline retry on the same button.
 */
import { useEffect, useRef } from "react";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { ToneIcon } from "@/components/icons";
import { Notice } from "@/components/notice";
import { interpolate } from "@/lib/interpolate";
import { getMessages } from "@/messages";

export type MoreStatus = "idle" | "pending" | "error";

export function BatchComplete({
  answered,
  skipped,
  correctCount,
  topicsTouched,
  hasMore,
  originHref,
  backLabelText,
  moreStatus,
  onMore,
}: {
  answered: number;
  skipped: number;
  correctCount: number;
  topicsTouched: number;
  hasMore: boolean;
  originHref: string;
  backLabelText: string;
  moreStatus: MoreStatus;
  onMore: () => void;
}) {
  const messages = getMessages();
  const titleRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const summary = [
    answered === 1
      ? messages.today.completionAnsweredOne
      : answered > 1
        ? interpolate(messages.today.completionAnswered, { count: answered })
        : null,
    skipped > 0 ? interpolate(messages.today.completionSkipped, { count: skipped }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const correctLine =
    answered > 0
      ? interpolate(messages.practice.batchCorrectSummary, { correct: correctCount, answered })
      : null;
  const topicsLine =
    topicsTouched > 1
      ? interpolate(messages.practice.batchTopicsTouched, { count: topicsTouched })
      : null;
  const pending = moreStatus === "pending";

  return (
    <Card raised className="flex flex-col items-center gap-4 p-6 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-state-solid-soft text-state-solid"
      >
        <ToneIcon tone="success" className="size-6" />
      </span>
      <div role="status">
        <p ref={titleRef} tabIndex={-1} className="text-title font-semibold focus:outline-none">
          {messages.practice.batchCompleteTitle}
        </p>
      </div>
      {summary ? <p className="text-secondary text-muted">{summary}</p> : null}
      {correctLine ? <p className="text-secondary text-muted">{correctLine}</p> : null}
      {topicsLine ? <p className="text-secondary text-muted">{topicsLine}</p> : null}
      {answered > 0 ? (
        <p className="text-secondary font-medium text-foreground">{messages.practice.batchEncouragement}</p>
      ) : null}
      <div className="mt-2 flex w-full flex-col gap-2">
        {hasMore ? (
          <Button fullWidth onClick={onMore} disabled={pending} aria-busy={pending}>
            {pending
              ? messages.practice.loading
              : moreStatus === "error"
                ? messages.practice.retry
                : messages.practice.more}
          </Button>
        ) : null}
        {moreStatus === "error" ? (
          <Notice tone="error" role="alert" className="justify-center">
            {messages.practice.genericErrorTitle}
          </Notice>
        ) : null}
        <ButtonLink href={originHref} variant={hasMore ? "tertiary" : "secondary"} fullWidth>
          {backLabelText}
        </ButtonLink>
      </div>
    </Card>
  );
}
