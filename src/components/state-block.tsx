/**
 * Shared non-content states for learner pages: loading, signed-out, error,
 * empty. A real error uses `tone="error"` (role="alert"); empty and signed-out
 * are neutral. Each tone carries a decorative icon so state is never conveyed
 * by color alone. An optional single action keeps "one primary CTA per state"
 * (UX_SPEC §1.8). Callers pass client-safe copy only; this component adds no
 * technical detail.
 */
import type { ReactNode } from "react";

import { ToneIcon } from "./icons";

export function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="py-12 text-center text-secondary text-muted">
      {label}
    </p>
  );
}

export function StateBlock({
  title,
  body,
  action,
  tone = "neutral",
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "neutral" | "error";
}) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : undefined}
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center"
    >
      <span
        aria-hidden="true"
        className={`flex size-14 items-center justify-center rounded-full ${
          isError ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-soft-foreground"
        }`}
      >
        <ToneIcon tone={isError ? "error" : "info"} className="size-6" />
      </span>
      <p className={`text-title font-bold ${isError ? "text-danger" : ""}`}>{title}</p>
      {body ? <p className="text-body text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
