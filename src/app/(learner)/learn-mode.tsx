"use client";

/**
 * Learn Mode flag for the learner shell (Run UX-01 UX-2, docs/UX_SPEC.md §1
 * items 6–7): while a learner is answering, the shell removes its normal
 * navigation chrome. The question flow switches it on with `useLearnMode`;
 * the bottom nav and Browse-mode header read it. Pure client UI state — no
 * route, persistence or learning behavior depends on it.
 */
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

const LearnModeContext = createContext<{
  active: boolean;
  setActive: (active: boolean) => void;
}>({ active: false, setActive: () => {} });

export function LearnModeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  return (
    <LearnModeContext.Provider value={{ active, setActive }}>{children}</LearnModeContext.Provider>
  );
}

export function useIsLearnMode(): boolean {
  return useContext(LearnModeContext).active;
}

/**
 * Turns Learn Mode on while `active` is true; always off again on unmount.
 * A layout effect, so the Browse chrome is gone before the first paint of
 * the question (no one-frame flash of nav/header).
 */
export function useLearnMode(active: boolean): void {
  const { setActive } = useContext(LearnModeContext);
  useLayoutEffect(() => {
    setActive(active);
    return () => setActive(false);
  }, [active, setActive]);
}
