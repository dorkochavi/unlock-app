"use client";

/**
 * The shared learner `<main>` landmark, split out of `layout.tsx` only
 * because its max-width must react to Learn Mode (client state):
 * Learn Mode keeps the existing constrained reading width (UX_SPEC §5 item
 * 24 — unchanged), while Browse Mode widens modestly on desktop (UX_SPEC
 * §11 item 4 — "mobile-first does not mean mobile-stretched-to-desktop";
 * restrained on purpose, since instructor/authoring surfaces may
 * appropriately be wider than learner learning surfaces, not learner ones).
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
      className={`mx-auto flex w-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10 ${
        learnMode ? "max-w-2xl" : "max-w-2xl lg:max-w-3xl"
      }`}
    >
      {children}
    </main>
  );
}
