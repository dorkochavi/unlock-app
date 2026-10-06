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
  "inline-flex items-center justify-center gap-2 rounded-control px-5 text-center font-medium transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:active:scale-100 aria-disabled:active:scale-100";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "state-disabled bg-primary text-primary-contrast not-disabled:not-aria-disabled:hover:bg-primary-hover",
  secondary: "state-disabled border border-border-strong bg-surface text-foreground not-disabled:not-aria-disabled:hover:bg-surface-muted",
  tertiary: "text-muted disabled:cursor-not-allowed disabled:text-subtle aria-disabled:cursor-not-allowed aria-disabled:text-subtle underline-offset-4 not-disabled:not-aria-disabled:hover:text-foreground not-disabled:not-aria-disabled:hover:underline",
  dangerSecondary: "state-disabled border border-danger/40 bg-surface text-danger not-disabled:not-aria-disabled:hover:bg-danger-soft",
  dangerTertiary: "text-danger disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 underline-offset-4 not-disabled:not-aria-disabled:hover:underline",
};

export function buttonClasses(
  variant: ButtonVariant,
  options: { fullWidth?: boolean; compact?: boolean; className?: string } = {},
): string {
  return [
    BASE,
    options.compact ? "min-h-control-compact" : "min-h-control",
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
};

export function Button({
  variant = "primary",
  fullWidth,
  compact,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, { fullWidth, compact, className })} {...rest} />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  compact?: boolean;
};

export function ButtonLink({
  variant = "primary",
  fullWidth,
  compact,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, { fullWidth, compact, className })} {...rest} />;
}
