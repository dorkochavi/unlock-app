/**
 * Inline notice for form/action feedback (replaces ad-hoc
 * `<p className="text-sm text-danger|text-state-solid">`). Tone is conveyed by
 * icon + text, not color alone. Semantics: `error` is `role="alert"`
 * (assertive); `success`/`info` are `role="status"` (polite). Pass `role` to
 * override (`"none"` when a surrounding live region already announces it).
 */
import type { ReactNode } from "react";

import { ToneIcon, type NoticeTone } from "./icons";

const TONES: Record<NoticeTone, string> = {
  error: "text-danger",
  success: "text-state-solid",
  info: "text-muted",
};

export function Notice({
  tone = "info",
  role,
  className,
  children,
}: {
  tone?: NoticeTone;
  role?: "alert" | "status" | "none";
  className?: string;
  children: ReactNode;
}) {
  const resolvedRole = role ?? (tone === "error" ? "alert" : "status");
  return (
    <p
      role={resolvedRole === "none" ? undefined : resolvedRole}
      className={`flex items-start gap-2 text-secondary ${TONES[tone]} ${className ?? ""}`}
    >
      <ToneIcon tone={tone} className="mt-1 size-4 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
