/**
 * Shared non-content states for learner pages: loading, signed-out, error,
 * empty. A real error uses `tone="error"`; empty and signed-out are neutral.
 * An optional single action keeps "one primary CTA per state" (UX_SPEC §1.8).
 */
import type { ReactNode } from "react";

export function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="py-12 text-center text-muted">
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
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center"
    >
      <p className={`text-lg font-medium ${tone === "error" ? "text-danger" : ""}`}>{title}</p>
      {body ? <p className="text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
