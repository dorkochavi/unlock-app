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
 * (OWNER/INSTRUCTOR) row gets a subtle primary-tinted inline-start (logical `border-s-4`) border plus a
 * colored role label; a LEARNER row (no role label to begin with) stays
 * neutral. No new badge/pill is added (this screen should not become a
 * dashboard). The whole card is one real `Link` (no nested interactive
 * controls) — the entire card is the navigation target.
 *
 * VISUAL-SYSTEM-RUN-001 E: the card is the shared `LinkRow` primitive
 * (neutral hover/pressed/focus, replacing the RUN010-I primary-soft hover) and
 * the management accent is the logical `border-s-4 border-s-primary`. The
 * author-management entry point stays page-level (`page.tsx`), not per card.
 */
import { LinkRow } from "@/components/link-row";

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
      <LinkRow
        href={`/courses/${course.id}`}
        accentClassName={isManaged ? "border-s-4 border-s-primary" : undefined}
      >
        <span className="block text-body font-medium">{course.title}</span>
        {roleLabel ? (
          <span className={`mt-1 block text-secondary ${isManaged ? "font-medium text-primary" : "text-muted"}`}>
            {roleLabel}
          </span>
        ) : null}
      </LinkRow>
    </li>
  );
}
