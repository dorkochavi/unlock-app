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
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { getMessages } from "@/messages";

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const messages = getMessages();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <Link href="/courses" className="text-sm font-medium text-subtle transition hover:text-foreground">
          {messages.instructor.backToMyCourses}
        </Link>
        <Button variant="tertiary" className="text-sm" onClick={handleSignOut}>
          {messages.shell.signOut}
        </Button>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
