"use client";

/**
 * Practice batch-complete summary (extracted from page.tsx, same copy/actions).
 * Slice F: hero surface + stat chips + CTA hierarchy (primary continue, quieter back link).
 * Slice E: "עוד 10" no longer swaps the screen for a full-screen loader — the
 * summary stays visible while the next batch loads (inline pending on the
 * button) and a failed load shows an inline retry on the same button.
 */
import Link from "next/link";
import { useEffect, useRef } from "react";

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
  const stats = [
    answered === 1
      ? messages.today.completionAnsweredOne
      : answered > 1
        ? interpolate(messages.today.completionAnswered, { count: answered })
        : null,
    answered > 0
      ? interpolate(messages.practice.batchCorrectSummary, { correct: correctCount, answered })
      : null,
    skipped > 0 ? interpolate(messages.today.completionSkipped, { count: skipped }) : null,
    topicsTouched > 1
      ? interpolate(messages.practice.batchTopicsTouched, { count: topicsTouched })
      : null,
  ].filter((part): part is string => Boolean(part));
  const pending = moreStatus === "pending";

  const primaryClass =
    "inline-flex min-h-control-lg w-full items-center justify-center rounded-control bg-white px-6 text-body font-bold text-hero shadow-[0_6px_16px_-8px_rgb(0_0_0/0.5)] transition duration-150 hover:bg-hero-muted active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-75 disabled:hover:bg-white disabled:active:scale-100";
  const quietClass =
    "inline-flex min-h-control w-full items-center justify-center rounded-control px-5 font-semibold text-hero-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <Card variant="hero" className="flex flex-col items-center gap-5 p-7 text-center sm:p-10">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-hero-soft text-hero-foreground"
      >
        <ToneIcon tone="success" className="size-7" />
      </span>
      <div role="status">
        <p
          ref={titleRef}
          tabIndex={-1}
          className="text-[1.625rem] font-extrabold leading-tight focus:outline-none sm:text-[1.875rem]"
        >
          {messages.practice.batchCompleteTitle}
        </p>
        {answered > 0 ? (
          <p className="mt-2 text-body text-hero-muted">{messages.practice.batchEncouragement}</p>
        ) : null}
      </div>
      {stats.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-2">
          {stats.map((part) => (
            <li key={part} className="chip bg-hero-soft py-1.5 text-hero-foreground">
              {part}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-1 flex w-full flex-col gap-2 sm:max-w-xs">
        {hasMore ? (
          <button
            type="button"
            onClick={onMore}
            disabled={pending}
            aria-busy={pending}
            className={primaryClass}
          >
            {pending
              ? messages.practice.loading
              : moreStatus === "error"
                ? messages.practice.retry
                : messages.practice.more}
          </button>
        ) : null}
        <Link href={originHref} className={hasMore ? quietClass : primaryClass}>
          {backLabelText}
        </Link>
        {/* Below the CTAs: the retry notice appears without moving them. */}
        {hasMore && moreStatus === "error" ? (
          <Notice tone="error" role="alert" className="justify-center">
            {messages.practice.genericErrorTitle}
          </Notice>
        ) : null}
      </div>
    </Card>
  );
}
