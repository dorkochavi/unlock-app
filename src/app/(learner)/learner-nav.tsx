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
 * page in this app (e.g. `today/page.tsx`'s own layout) leaves RTL to the
 * browser rather than hand-coding it.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getMessages } from "@/messages";

import { LEARNER_NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LearnerNav() {
  const messages = getMessages();
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 flex border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
      aria-label={LEARNER_NAV_ITEMS.map((item) => messages.shell.nav[item.labelKey]).join(" / ")}
    >
      {LEARNER_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 px-2 py-3 text-sm font-medium transition ${
              active
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {messages.shell.nav[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
