/**
 * Learn Mode context bar shared by Today and Practice: a slim top bar with the
 * start-side text block (optional eyebrow, title, and a prominent position
 * line such as "שאלה 1 מתוך 2") and an end-side exit action supplied by the
 * caller (a `Button` or `ButtonLink`; use `tertiary` with
 * `className="-me-3 shrink-0"` and `<ExitIcon />`).
 */
import type { ReactNode } from "react";

export function ExitIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function LearnHeader({
  title,
  eyebrow,
  position,
  action,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  position?: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <p
          className={`break-words ${
            position ? "text-secondary font-medium text-muted" : "text-section font-extrabold leading-tight"
          }`}
        >
          {title}
        </p>
        {position ? <p className="text-section font-extrabold leading-tight">{position}</p> : null}
      </div>
      {action}
    </div>
  );
}
