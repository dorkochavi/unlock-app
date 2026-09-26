/**
 * Shared shell for the authenticated learner surfaces (Run 004 Slice 2):
 * Today, Courses, Progress. Deliberately excludes `/`, `/login`, and
 * `/join/[courseId]` — those are pre-product entry points, not part of the
 * learner's ongoing navigation, and keep using the plain root layout
 * unchanged.
 *
 * A Next.js route group (`(learner)`) — this file changes no URL, only
 * which pages share this layout.
 *
 * Browse-mode container (Run UX-01 UX-1, docs/UX_SPEC.md): mobile-first
 * 16px side gutter, a constrained reading width, and the single `<main>`
 * landmark — pages render their content directly inside it.
 */
import { LearnerNav } from "./learner-nav";

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        {children}
      </main>
      <LearnerNav />
    </div>
  );
}
