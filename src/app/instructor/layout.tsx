"use client";

/**
 * Shared shell for the instructor Course-authoring surface (Run 005 S3).
 * Deliberately separate from the learner `(learner)` route group/shell:
 * "distinguish learner vs instructor product context without leaking admin
 * controls into learner navigation" (Run 005 CHATGPT_PLAN.md S3). No bottom
 * tab bar here — this is a desktop-oriented authoring workspace, entered
 * from a single small link on My Courses (`(learner)/courses/page.tsx`),
 * not part of the learner's ongoing navigation.
 *
 * UX-03-QA1 Finding 12: sign-out now lives here too — the SAME top-left
 * utility position `(learner)/learner-utility-bar.tsx` uses (a
 * `justify-between` row's trailing/last child renders visually on the left
 * in this RTL-first app, no manual left/right logic needed) — so an
 * instructor never has to leave the authoring surface (e.g. back to
 * `/courses`) just to sign out.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { getMessages } from "@/messages";

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const messages = getMessages();
  const router = useRouter();
  // Presentation only: the course-management page uses a wider desktop canvas; align the top bar to it.
  const pathname = usePathname() ?? "";
  const wideHeader = /^\/instructor\/courses\/(?!new\/?$)[^/]+\/?$/.test(pathname);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className={`mx-auto flex min-h-14 w-full max-w-2xl items-center justify-between gap-3 px-4 pt-1 sm:px-6 ${
          wideHeader ? "lg:max-w-5xl xl:max-w-6xl" : "lg:max-w-4xl"
        }`}>
        <Link
          href="/courses"
          className="inline-flex min-h-control items-center rounded-full px-1 text-secondary font-semibold text-primary-soft-foreground transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {messages.instructor.backToMyCourses}
        </Link>
        <Button variant="tertiary" className="-me-2 rounded-full px-3 text-secondary" onClick={handleSignOut}>
          {messages.shell.signOut}
        </Button>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
