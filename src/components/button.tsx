/**
 * Button hierarchy (docs/UX_SPEC.md §11-§12): primary / secondary / tertiary,
 * plus two restrained destructive weights (dangerSecondary / dangerTertiary —
 * same semantic danger family, different stakes; §11 "Destructive-action
 * hierarchy"). One visually dominant primary action per screen/state is a
 * page-level rule, binding on instructor surfaces too (§11 item 3).
 *
 * The danger variants exist as first-class variants (not a `className`
 * override on `secondary`/`tertiary`) precisely so nothing needs to fight
 * this component's own base classes — see §12 item 56.
 *
 * Disabled uses the shared `state-disabled` token treatment (native `disabled`
 * or `aria-disabled="true"`), not bare opacity. A pending state should keep the
 * same label/width and only set `disabled`, so the layout never jumps.
 *
 * `buttonClasses` is exported so a Next.js `<Link>` can carry the same visual
 * weight as a `<button>` without a wrapper (`ButtonLink`).
 */
import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "dangerSecondary" | "dangerTertiary";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control px-5 text-center font-semibold transition duration-150 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:active:scale-100 aria-disabled:active:scale-100";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "state-disabled bg-primary text-primary-contrast font-bold shadow-[0_1px_2px_rgb(30_27_75/0.2),0_6px_14px_-6px_var(--primary)] not-disabled:not-aria-disabled:hover:bg-primary-hover",
  secondary:
    "state-disabled border border-primary-soft-border bg-primary-soft text-primary-soft-foreground not-disabled:not-aria-disabled:hover:border-primary",
  tertiary: "text-muted disabled:cursor-not-allowed disabled:text-subtle aria-disabled:cursor-not-allowed aria-disabled:text-subtle underline-offset-4 font-medium not-disabled:not-aria-disabled:hover:text-foreground not-disabled:not-aria-disabled:hover:underline",
  dangerSecondary: "state-disabled border border-danger/30 bg-danger-soft text-danger not-disabled:not-aria-disabled:hover:border-danger",
  dangerTertiary: "text-danger font-medium disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 underline-offset-4 not-disabled:not-aria-disabled:hover:underline",
};

/** md = 44px tap target (dense/secondary); lg = 52px, the screen's main CTA. */
export type ButtonSize = "md" | "lg";

export function buttonClasses(
  variant: ButtonVariant,
  options: { fullWidth?: boolean; compact?: boolean; size?: ButtonSize; className?: string } = {},
): string {
  return [
    BASE,
    options.compact ? "min-h-control-compact" : options.size === "lg" ? "min-h-control-lg text-body" : "min-h-control",
    VARIANTS[variant],
    options.fullWidth ? "w-full" : "",
    options.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  /** Shorter control height for dense rows; default is the 44px tap target. */
  compact?: boolean;
  /** "lg" = 52px primary CTA. */
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  fullWidth,
  compact,
  size,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, { fullWidth, compact, size, className })} {...rest} />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  compact?: boolean;
  size?: ButtonSize;
};

export function ButtonLink({
  variant = "primary",
  fullWidth,
  compact,
  size,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, { fullWidth, compact, size, className })} {...rest} />;
}
