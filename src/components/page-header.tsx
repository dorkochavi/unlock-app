/**
 * Browse-mode page header: one `h1`, optional supporting line, optional
 * trailing tertiary action (e.g. sign-out). Learn Mode does not use it.
 */
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-page font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-body text-muted">{subtitle}</p> : null}
      </div>
      {trailing}
    </header>
  );
}
