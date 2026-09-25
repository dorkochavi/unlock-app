/**
 * The learner bottom-nav destinations, in order. Kept as plain data (no JSX)
 * so it is unit-testable and shared by `learner-nav.tsx`. Run 009 S2 adds
 * Progress as a GLOBAL destination next to Today and Courses.
 */
export const LEARNER_NAV_ITEMS = [
  { href: "/today", labelKey: "today" },
  { href: "/courses", labelKey: "courses" },
  { href: "/progress", labelKey: "progress" },
] as const;

export type LearnerNavLabelKey = (typeof LEARNER_NAV_ITEMS)[number]["labelKey"];
