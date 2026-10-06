/**
 * QA2-B targeted evidence for the Courses overview's Course card
 * (product-owner Preview QA "Progress needs visual states, not decoration").
 * Server-renders (this repo's Vitest environment is "node", no jsdom —
 * same convention as `today/__tests__/question-card.test.tsx` and
 * `progress/__tests__/page.test.tsx`) to prove, from the actual output
 * markup:
 *
 * - the whole card is ONE real `<a>` (semantic navigation) with no nested
 *   interactive element inside it;
 * - the card shows a visible hover/focus/pressed treatment;
 * - the authored-vs-learning distinction is driven by the independent
 *   `isAuthor` signal (exposed as `data-course-kind`), never by `role`;
 *   the role label renders as a chip only when one is supplied.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CourseRow } from "../course-row";

describe("CourseRow markup (QA2-B whole-card navigation)", () => {
  it("wraps the entire card in one real link with no nested interactive controls", () => {
    const html = renderToStaticMarkup(
      <CourseRow course={{ id: "course-1", title: "Algebra", role: "LEARNER", isAuthor: false }} roleLabel="" />,
    );

    const anchorMatches = html.match(/<a\b/g) ?? [];
    expect(anchorMatches).toHaveLength(1);
    expect(html).not.toMatch(/<button/);
    expect(html).toContain('href="/courses/course-1"');
  });

  it("carries visible hover/focus/pressed treatment on the card link itself", () => {
    const html = renderToStaticMarkup(
      <CourseRow course={{ id: "course-1", title: "Algebra", role: "LEARNER", isAuthor: false }} roleLabel="" />,
    );
    // Shared LinkRow primitive: neutral hover/pressed surface + focus outline.
    expect(html).toMatch(/hover:bg-surface-muted/);
    expect(html).toMatch(/active:bg-surface-muted/);
    expect(html).toMatch(/focus-visible:outline-2/);
  });

  // RUN010-H.2: the kind is driven by the independent `isAuthor`
  // course_authors signal, not `MANAGEMENT_ROLES.includes(role)` — proven
  // here with an author-only fixture (role: null) being authored too.
  it("marks a course authored only when isAuthor is true, never for a plain LEARNER", () => {
    const render = (role: "OWNER" | "INSTRUCTOR" | "LEARNER" | null, isAuthor: boolean) =>
      renderToStaticMarkup(
        <CourseRow course={{ id: "c1", title: "Algebra", role, isAuthor }} roleLabel="" />,
      );

    expect(render("OWNER", true)).toContain('data-course-kind="authored"');
    expect(render("INSTRUCTOR", true)).toContain('data-course-kind="authored"');
    expect(render(null, true)).toContain('data-course-kind="authored"');
    expect(render("LEARNER", false)).toContain('data-course-kind="learning"');
  });

  it("renders the role label as text when supplied and omits it when empty", () => {
    const withLabel = renderToStaticMarkup(
      <CourseRow course={{ id: "c1", title: "Algebra", role: "OWNER", isAuthor: true }} roleLabel="בעלים" />,
    );
    const without = renderToStaticMarkup(
      <CourseRow course={{ id: "c4", title: "Algebra", role: null, isAuthor: true }} roleLabel="" />,
    );
    expect(withLabel).toContain("בעלים");
    expect(without).not.toContain("בעלים");
  });
});
