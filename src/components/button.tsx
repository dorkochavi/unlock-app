/**
 * Button hierarchy (docs/UX_SPEC.md §6 item 39): primary / secondary /
 * tertiary. One visually dominant primary action per screen/state is a
 * page-level rule; this file only provides the three visual weights.
 *
 * `buttonClasses` is exported so a Next.js `<Link>` can carry the same visual
 * weight as a `<button>` without a wrapper (`ButtonLink`).
 */
import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-center font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-contrast hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  tertiary: "text-muted underline-offset-4 hover:text-foreground hover:underline",
};

export function buttonClasses(
  variant: ButtonVariant,
  options: { fullWidth?: boolean; className?: string } = {},
): string {
  return [BASE, VARIANTS[variant], options.fullWidth ? "w-full" : "", options.className ?? ""]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; fullWidth?: boolean };

export function Button({
  variant = "primary",
  fullWidth,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, { fullWidth, className })} {...rest} />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export function ButtonLink({ variant = "primary", fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, { fullWidth, className })} {...rest} />;
}
