"use client";

/**
 * Bottom tab bar for the mobile-first learner shell (Run 004 Slice 2).
 * Today + Courses (Run 004) + Progress (Run 009 S2). The destinations live
 * in `nav-items.ts` as plain data, so adding one stays a one-line change —
 * only that much extensibility, per Run 004's "preserve extensibility but
 * do not overbuild."
 *
 * Fixed to the bottom of the viewport: on a phone, a top nav competes with
 * the browser chrome and requires more reach; a bottom bar is the
 * conventional mobile placement and keeps Today's own primary actions
 * (submit/skip/continue) undisturbed above it.
 *
 * `dir="rtl"` on `<html>` already reverses `flex-direction: row`'s visual
 * order — no manual left/right logic needed here, matching how every other
 * page in this app leaves RTL to the browser rather than hand-coding it.
 *
 * Run UX-01 UX-1: one functional icon per tab (UX_SPEC §6 item 41) and an
 * active state carried by more than color alone (weight + indicator bar).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getMessages } from "@/messages";

import { useIsLearnMode } from "./learn-mode";
import { LEARNER_NAV_ITEMS, type LearnerNavLabelKey } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ICON_PATHS: Record<LearnerNavLabelKey, string> = {
  // Sun: today's plan.
  today:
    "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  // Open book: courses.
  courses:
    "M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2m0-13c1.5-1.5 4-2 8-2v13c-4 0-6.5.5-8 2m0-13v13",
  // Rising bars: progress.
  progress: "M5 20v-6m7 6V9m7 11V4",
};

function NavIcon({ labelKey }: { labelKey: LearnerNavLabelKey }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[labelKey]} />
    </svg>
  );
}

export function LearnerNav() {
  const messages = getMessages();
  const pathname = usePathname();
  const learnMode = useIsLearnMode();

  // Learn Mode removes the normal navigation chrome (UX_SPEC §1 item 7).
  if (learnMode) return null;

  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label={messages.shell.navLabel}
    >
      <div className="mx-auto flex max-w-2xl">
        {LEARNER_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                active ? "font-semibold text-primary" : "font-medium text-muted hover:text-foreground"
              }`}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
                />
              ) : null}
              <NavIcon labelKey={item.labelKey} />
              {messages.shell.nav[item.labelKey]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
