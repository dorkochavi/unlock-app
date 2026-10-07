"use client";

/**
 * The shared learner `<main>` landmark, split out of `layout.tsx` only
 * because its max-width must react to Learn Mode (client state):
 * Learn Mode keeps the existing constrained reading width (UX_SPEC §5 item
 * 24 — unchanged), and Browse Mode now share the single `page-container`
 * width/gutter token (also used by the nav and utility bar); only the top
 * spacing differs, because the utility bar is hidden in Learn Mode.
 *
 * No-flash guarantee: this depends on `useLearnMode` always flipping the
 * shared context from a `useLayoutEffect` (never a passive effect) — React
 * then flushes this component's width change, `LearnerNav`'s visibility,
 * and Today's own header-hide together, before the browser paints. Moving
 * that flip to a passive effect would reintroduce a one-frame flash here.
 */
import type { ReactNode } from "react";

import { useIsLearnMode } from "./learn-mode";

export function LearnerMain({ children }: { children: ReactNode }) {
  const learnMode = useIsLearnMode();

  return (
    <main
      className={`page-container flex flex-1 flex-col ${
        // Learn Mode on mobile: no bottom padding, so the sticky action bar rests flush at
        // the viewport bottom (padding below it would leave a gap under the bar).
        learnMode ? "pb-0 sm:pb-10" : "pb-10"
      } ${
        // The utility bar above already supplies top spacing in Browse Mode.
        learnMode ? "pt-6 sm:pt-10" : "pt-2 sm:pt-4"
      }`}
    >
      {children}
    </main>
  );
}
