"use client";

/**
 * UX-03-QA1 Finding 12: a single, shared top-left sign-out affordance for
 * every Browse-mode learner surface (Today Browse, Courses, Progress,
 * Course), so the learner never has to remember which page happens to carry
 * a sign-out button (previously ONLY Today's own `PageHeader` trailing slot
 * did). Rendered once by `layout.tsx`, above every page's own content —
 * pages no longer render their own sign-out button.
 *
 * Anchored utility header (DESIGN-REFRESH-002 D): brand wordmark on the
 * inline-start side, a quiet sign-out control on the trailing side (the
 * visual left in RTL, via `justify-between` — no manual left/right logic).
 *
 * Hidden during Learn Mode (`useIsLearnMode`): Learn Mode already has its
 * own `יציאה` (Exit) control in the same visual position (Today's/Practice's
 * context bar, via `justify-between` + last-child placement) — the two must
 * never compete as simultaneous primary actions on screen, so this bar and
 * Learn Mode's own Exit are structurally mutually exclusive, never both
 * rendered at once, rather than visually de-emphasizing one.
 *
 * Sign-out itself: same `supabase.auth.signOut()` Today's page already used,
 * followed by a client-side navigation to `/login` — this works uniformly
 * from any learner page (Courses/Progress/Course have no own "signed-out"
 * view-state machine to feed into, unlike Today's fetch-triggered 401 path).
 */
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";
import { getMessages } from "@/messages";

import { useIsLearnMode } from "./learn-mode";

export function LearnerUtilityBar() {
  const messages = getMessages();
  const learnMode = useIsLearnMode();
  const router = useRouter();

  if (learnMode) return null;

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="page-container flex min-h-14 items-center justify-between gap-3 pt-1">
      {/* Brand wordmark (text only, product name from messages). Inline-start. */}
      <span className="text-section font-extrabold text-foreground">{messages.shell.heading}</span>
      <Button
        variant="tertiary"
        className="-me-2 gap-1.5 rounded-full px-3 text-secondary font-medium"
        onClick={handleSignOut}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 shrink-0 rtl:-scale-x-100"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 4.5H6.5A2 2 0 0 0 4.5 6.5v11a2 2 0 0 0 2 2H9M15 8l4 4-4 4M19 12H9.5" />
        </svg>
        {messages.shell.signOut}
      </Button>
    </div>
  );
}
