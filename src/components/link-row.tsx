/**
 * Whole-card navigation link: ONE real `<a>` carrying the shared surface,
 * hover/pressed/focus treatment and an RTL-aware trailing chevron. Consolidates
 * the duplicated linked-card class clusters (Courses row, Progress section,
 * Topic row). Never nest interactive controls inside it. Wrap in `<li>` at the
 * call site when used in a list.
 *
 * `variant="card"` is a bordered card; `variant="inline"` is a borderless row
 * for use inside a Card (dividers, never a card inside a card).
 * `accentClassName` lets a caller add a logical (`border-s-4 border-s-*`)
 * status accent without this primitive owning status semantics.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const BASE =
  "flex items-center justify-between gap-3 transition active:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const VARIANTS = {
  card: "min-h-16 rounded-card border border-border bg-surface p-5 hover:bg-surface-muted",
  inline: "min-h-14 -mx-2 rounded-control px-2 py-3 hover:bg-surface-muted",
} as const;

export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`size-5 shrink-0 rtl:rotate-180 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

type LinkRowProps = Omit<ComponentProps<typeof Link>, "children"> & {
  variant?: keyof typeof VARIANTS;
  /** Text/meta shown before the chevron on the end side. */
  trailing?: ReactNode;
  showChevron?: boolean;
  accentClassName?: string;
  children: ReactNode;
};

export function LinkRow({
  variant = "card",
  trailing,
  showChevron = true,
  accentClassName,
  className,
  children,
  ...rest
}: LinkRowProps) {
  return (
    <Link
      className={`${BASE} ${VARIANTS[variant]} ${accentClassName ?? ""} ${className ?? ""}`}
      {...rest}
    >
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {trailing || showChevron ? (
        <span className="flex shrink-0 items-center gap-2 text-secondary text-muted">
          {trailing}
          {showChevron ? <Chevron /> : null}
        </span>
      ) : null}
    </Link>
  );
}
