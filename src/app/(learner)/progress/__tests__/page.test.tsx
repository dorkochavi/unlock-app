/**
 * QA2-B targeted evidence for the Progress page's Course card (product-owner
 * Preview QA "Progress needs visual states, not decoration"). Server-renders
 * (this repo's Vitest environment is "node", no jsdom/interaction harness —
 * same convention as `today/__tests__/question-card.test.tsx`) to prove, from
 * the actual output markup:
 *
 * - the card header is ONE real `<a>` (semantic navigation), not a non-semantic
 *   `onClick` on a `div`, and it contains no nested interactive element
 *   (no `<a>`/`<button>` inside the card's own `<a>`);
 * - the card header shows a visible hover/focus/pressed treatment;
 * - Topic rows render inside the card as informational content (no extra links).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CourseSection } from "../course-section";
import type { CourseProgress } from "../load-progress";

const readyWithActivity: CourseProgress = {
  kind: "ready",
  topics: [
    { topicId: "t1", name: "Topic 1", state: "IN_PROGRESS", attemptedCount: 3, totalCount: 10 },
    { topicId: "t2", name: "Topic 2", state: "NOT_STARTED", attemptedCount: 0, totalCount: 5 },
  ],
};

describe("CourseSection markup (QA2-B whole-card navigation)", () => {
  it("the card header is one real link; no other interactive controls inside the card", () => {
    const html = renderToStaticMarkup(
      <CourseSection id="course-1" title="Algebra" progress={readyWithActivity} />,
    );

    const anchorMatches = html.match(/<a\b/g) ?? [];
    expect(anchorMatches).toHaveLength(1);
    expect(html).not.toMatch(/<button/);
    expect(html).toContain('href="/courses/course-1"');
    // Title is inside the single link; topic rows are informational (no practice link here).
    expect(html).toContain("Algebra");
    expect(html.indexOf("Algebra")).toBeGreaterThan(html.indexOf("<a "));
  });

  it("carries visible hover/focus/pressed treatment on the header link itself", () => {
    const html = renderToStaticMarkup(
      <CourseSection id="course-1" title="Algebra" progress={readyWithActivity} />,
    );
    expect(html).toMatch(/hover:bg-surface-muted/);
    expect(html).toMatch(/focus-visible:outline-2/);
    expect(html).toMatch(/active:bg-surface-muted/);
  });
});
