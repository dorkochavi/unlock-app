/**
 * A card is a real content unit only (docs/UX_SPEC.md §6 item 38) — one
 * Course, one Course's Topic list, the Today summary. Do not nest cards;
 * use `Row` dividers inside a card instead.
 */
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CardProps = {
  as?: "section" | "div" | "article" | "li";
  className?: string;
  children: ReactNode;
} & Pick<ComponentPropsWithoutRef<"section">, "aria-labelledby" | "aria-label" | "id">;

export function Card({ as: Tag = "section", className, children, ...rest }: CardProps) {
  return (
    <Tag className={`rounded-xl border border-border bg-surface p-5 ${className ?? ""}`} {...rest}>
      {children}
    </Tag>
  );
}

/** A lightweight list row inside a Card: text block on the start side, trailing slot on the end. */
export function Row({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </div>
  );
}
