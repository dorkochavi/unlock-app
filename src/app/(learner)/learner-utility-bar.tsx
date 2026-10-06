"use client";

/**
 * UX-03-QA1 Finding 12: a single, shared top-left sign-out affordance for
 * every Browse-mode learner surface (Today Browse, Courses, Progress,
 * Course), so the learner never has to remember which page happens to carry
 * a sign-out button (previously ONLY Today's own `PageHeader` trailing slot
 * did). Rendered once by `layout.tsx`, above every page's own content —
 * pages no longer render their own sign-out button.
 *
 * "Top-left," literally: in this RTL-first app, a `justify-between` row's
 * trailing (last) child already renders on the visual left without any
 * manual left/right logic (same convention `learner-nav.tsx`'s own doc
 * comment describes) — this bar just has one child, so `justify-end` places
 * it there directly.
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
    <div className="page-container flex justify-end pt-1">
      <Button variant="tertiary" className="-me-3 text-secondary" onClick={handleSignOut}>
        {messages.shell.signOut}
      </Button>
    </div>
  );
}
