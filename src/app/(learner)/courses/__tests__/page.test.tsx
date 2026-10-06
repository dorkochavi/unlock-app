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
 * - the subtle course-level accent only appears for a management
 *   (OWNER/INSTRUCTOR) role, reusing data already fetched/rendered — no new
 *   badge is added, and a LEARNER row (no role label) stays neutral.
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

  // RUN010-H.2: the accent is now driven by the independent `isAuthor`
  // course_authors signal, not `MANAGEMENT_ROLES.includes(role)` — proven
  // here with an author-only fixture (role: null) getting the accent too.
  it("adds the subtle management accent only when isAuthor is true, never for a plain LEARNER", () => {
    const owner = renderToStaticMarkup(
      <CourseRow course={{ id: "c1", title: "Algebra", role: "OWNER", isAuthor: true }} roleLabel="בעלים" />,
    );
    const instructor = renderToStaticMarkup(
      <CourseRow course={{ id: "c2", title: "Algebra", role: "INSTRUCTOR", isAuthor: true }} roleLabel="מרצה" />,
    );
    const learner = renderToStaticMarkup(
      <CourseRow course={{ id: "c3", title: "Algebra", role: "LEARNER", isAuthor: false }} roleLabel="" />,
    );
    const authorOnly = renderToStaticMarkup(
      <CourseRow course={{ id: "c4", title: "Algebra", role: null, isAuthor: true }} roleLabel="" />,
    );

    expect(owner).toContain("border-s-4");
    expect(owner).toContain("border-s-primary");
    expect(instructor).toContain("border-s-primary");
    expect(learner).not.toContain("border-s-primary");
    expect(authorOnly).toContain("border-s-primary");
  });

  it("does not add a new badge/pill element — the role label stays a plain span", () => {
    const html = renderToStaticMarkup(
      <CourseRow course={{ id: "c1", title: "Algebra", role: "OWNER", isAuthor: true }} roleLabel="בעלים" />,
    );
    expect(html).toContain("בעלים");
    expect(html).not.toMatch(/rounded-full/);
  });
});
