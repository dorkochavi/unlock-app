/**
 * Shared form-control styling (docs/UX_SPEC.md §6): same radius/height (min-h-control)/focus
 * language as `Button`, so authoring forms stop hand-rolling raw Tailwind
 * borders (Run UX-03 audit: repeated ad hoc `border-zinc-300 dark:bg-zinc-900`
 * strings across the instructor Course-manage page).
 */
import type { ComponentProps, ReactNode } from "react";

const FIELD_BASE =
  "w-full min-h-control rounded-control border border-border-strong bg-surface px-3 py-2 text-body text-foreground placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary state-disabled aria-invalid:border-danger";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={`${FIELD_BASE} ${className ?? ""}`} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={`${FIELD_BASE} ${className ?? ""}`} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={`${FIELD_BASE} ${className ?? ""}`} {...rest} />;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`mb-1 block text-secondary font-medium ${className ?? ""}`}>{children}</span>;
}
