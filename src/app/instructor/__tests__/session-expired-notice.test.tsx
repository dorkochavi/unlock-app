/**
 * FUB-044 Instructor 401 recovery: the shared inline notice. Server-rendered
 * (this repo's Vitest env is "node"). The notice must keep the page mounted, so
 * its only action is a link that opens sign-in in a NEW tab — no navigation,
 * no storage, no retry.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildSignInHref } from "@/lib/safe-redirect";

import { InstructorSessionExpiredNotice } from "../session-expired-notice";

const COURSE = "3f5b1c2a-3d9e-4b7a-9c1e-2a8f7b6d5e4f";

describe("InstructorSessionExpiredNotice", () => {
  const href = buildSignInHref(`/instructor/courses/${COURSE}`);
  const html = renderToStaticMarkup(<InstructorSessionExpiredNotice signInHref={href} />);

  it("shows the accepted Hebrew copy", () => {
    expect(html).toContain("החיבור שלך פג");
    expect(html).toContain("השינויים האחרונים עדיין לא נשמרו. התחבר מחדש ואז חזור לכאן ונסה שוב.");
    expect(html).toContain("התחברות מחדש");
  });

  it("opens the allowlisted sign-in href in a new tab, safely", () => {
    expect(html).toContain(`href="/login?next=%2Finstructor%2Fcourses%2F${COURSE}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("is announced as an alert and has no button/form that could retry a mutation", () => {
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
  });

  it("falls back to plain /login for a non-allowlisted page", () => {
    const plain = renderToStaticMarkup(
      <InstructorSessionExpiredNotice signInHref={buildSignInHref("/instructor/other")} />,
    );
    expect(plain).toContain('href="/login"');
  });
});
