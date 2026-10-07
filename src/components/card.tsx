/**
 * A card is a real content unit only (docs/UX_SPEC.md §6 item 38) — one
 * Course, one Course's Topic list, the Today summary. Never put a Card inside a Card;
 * use `Row` dividers (or spacing) inside a card instead.
 * Variants: default = white + hairline; `raised` (or `variant="raised"`) adds the
 * soft 2-layer shadow for a summary card; `hero` is THE deep-indigo surface (one
 * per screen, white text, carries the primary action); `tint` is the LIGHT tinted header surface for non-hero screens (Progress, Join, Instructor); `quiet` is a tinted,
 * borderless panel for secondary grouping.
 */
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type CardVariant = "default" | "raised" | "hero" | "tint" | "quiet";

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: "rounded-card border border-border bg-surface",
  raised: "rounded-card surface-raised",
  hero: "rounded-surface surface-hero",
  tint: "rounded-surface surface-tint",
  quiet: "rounded-card bg-surface-muted",
};

type CardProps = {
  as?: "section" | "div" | "article" | "li";
  className?: string;
  raised?: boolean;
  variant?: CardVariant;
  children: ReactNode;
} & Pick<ComponentPropsWithoutRef<"section">, "aria-labelledby" | "aria-label" | "id">;

/** True when a caller's className already sets padding (`p-*`, any breakpoint), so the default `p-5` must not fight it. */
export function setsPadding(className?: string): boolean {
  return /(^|s)(?:[w-]+:)*p-/.test(className ?? "");
}

export function Card({ as: Tag = "section", className, raised, variant, children, ...rest }: CardProps) {
  const resolved: CardVariant = variant ?? (raised ? "raised" : "default");
  return (
    <Tag className={`${CARD_VARIANTS[resolved]} ${setsPadding(className) ? "" : "p-5"} ${className ?? ""}`} {...rest}>
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
