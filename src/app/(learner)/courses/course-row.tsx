/**
 * The Courses overview's per-Course card. Split out of `page.tsx` because a
 * Next.js `page.tsx` may only export the framework's own reserved names
 * (`default`, `metadata`, ...) — any other named export fails Next's
 * generated route-type check — and this component needs to be independently
 * importable for QA2-B's targeted markup test.
 *
 * QA2-B (product-owner Preview QA "Progress needs visual states, not
 * decoration"): the only per-Course visual accent here reuses the
 * already-fetched `role` this list already renders as text — a management
 * (OWNER/INSTRUCTOR) row gets a subtle primary-tinted left border plus a
 * colored role label; a LEARNER row (no role label to begin with) stays
 * neutral. No new badge/pill is added (this screen should not become a
 * dashboard); hover uses the same `bg-surface-muted` treatment the Course
 * page's Topic rows use (visually related, not copied) so it never fights
 * the left accent. The whole card is one real `Link` (no nested interactive
 * controls) — the entire card is the navigation target.
 */
import Link from "next/link";

import type { CourseRole } from "@/domain/course/types";

export interface MyCourseDto {
  id: string;
  title: string;
  /** `null` for a Course the actor only authors, with no `course_memberships` row (RUN010-H.2). */
  role: CourseRole | null;
  /** RUN010-H.2 — independent `course_authors` signal, never derived from `role`. Use this for management/authoring UI, not `MANAGEMENT_ROLES.includes(role)`. */
  isAuthor: boolean;
}

export const MANAGEMENT_ROLES: readonly CourseRole[] = ["OWNER", "INSTRUCTOR"];

export function CourseRow({
  course,
  roleLabel,
}: {
  course: MyCourseDto;
  roleLabel: string;
}) {
  const isManaged = course.isAuthor;
  return (
    <li>
      <Link
        href={`/courses/${course.id}`}
        className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5 transition hover:bg-surface-muted active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isManaged ? "border-l-4 border-l-primary" : ""}`}
      >
        <span className="min-w-0 break-words font-medium">{course.title}</span>
        <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
          {roleLabel ? (
            <span className={isManaged ? "font-medium text-primary" : undefined}>{roleLabel}</span>
          ) : null}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </Link>
    </li>
  );
}
