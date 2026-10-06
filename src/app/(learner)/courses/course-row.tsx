/**
 * The Courses overview's per-Course card. Split out of `page.tsx` because a
 * Next.js `page.tsx` may only export the framework's own reserved names
 * (`default`, `metadata`, ...) — any other named export fails Next's
 * generated route-type check — and this component needs to be independently
 * importable for its targeted markup test.
 *
 * The whole card is one real `Link` (no nested interactive controls) — the
 * entire card is the navigation target (QA2-B). Composition (DESIGN-REFRESH-002
 * Slice D): a leading initial tile + bold title + role chip, built only from
 * fields the DTO already has (`title`, `role`, `isAuthor`). Authored courses
 * (`isAuthor`, RUN010-H.2) get a primary-tinted tile and chip; learning
 * courses a neutral one. The kind is exposed as `data-course-kind`. The
 * author-management entry point stays page-level (`page.tsx`).
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

/** First letter/digit of the title, for the decorative leading tile. */
function titleInitial(title: string): string {
  const match = title.trim().match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLocaleUpperCase() : "•";
}

export function CourseRow({
  course,
  roleLabel,
}: {
  course: MyCourseDto;
  roleLabel: string;
}) {
  const isManaged = course.isAuthor;
  return (
    <li className="flex">
      <LinkRow
        href={`/courses/${course.id}`}
        data-course-kind={isManaged ? "authored" : "learning"}
        className="min-h-24 w-full gap-3 p-4"
      >
        <span className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className={`flex size-12 shrink-0 items-center justify-center rounded-control text-section font-extrabold ${
              isManaged ? "bg-primary text-primary-contrast" : "bg-primary-soft text-primary-soft-foreground"
            }`}
          >
            {titleInitial(course.title)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-section font-bold">{course.title}</span>
            {roleLabel ? (
              <span
                className={`chip mt-1.5 ${
                  isManaged ? "bg-primary-soft text-primary-soft-foreground" : ""
                }`}
              >
                {roleLabel}
              </span>
            ) : null}
          </span>
        </span>
      </LinkRow>
    </li>
  );
}
