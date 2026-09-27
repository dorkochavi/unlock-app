/**
 * Shared shell for the instructor Course-authoring surface (Run 005 S3).
 * Deliberately separate from the learner `(learner)` route group/shell:
 * "distinguish learner vs instructor product context without leaking admin
 * controls into learner navigation" (Run 005 CHATGPT_PLAN.md S3). No bottom
 * tab bar here — this is a desktop-oriented authoring workspace, entered
 * from a single small link on My Courses (`(learner)/courses/page.tsx`),
 * not part of the learner's ongoing navigation.
 */
import Link from "next/link";

import { getMessages } from "@/messages";

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const messages = getMessages();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border px-6 py-4">
        <Link href="/courses" className="text-sm font-medium text-subtle transition hover:text-foreground">
          {messages.instructor.backToMyCourses}
        </Link>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
