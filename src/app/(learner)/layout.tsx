/**
 * Shared shell for the authenticated learner surfaces (Run 004 Slice 2):
 * Today and Courses. Deliberately excludes `/`, `/login`, and
 * `/join/[courseId]` — those are pre-product entry points, not part of the
 * learner's ongoing navigation, and keep using the plain root layout
 * unchanged.
 *
 * A Next.js route group (`(learner)`) — this file changes no URL, only
 * which pages share this layout. `/today` and `/courses` keep their exact
 * existing paths.
 */
import { LearnerNav } from "./learner-nav";

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <LearnerNav />
    </div>
  );
}
