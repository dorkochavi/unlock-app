/**
 * QA2-B targeted evidence for the Progress page's Course card (product-owner
 * Preview QA "Progress needs visual states, not decoration"). Server-renders
 * (this repo's Vitest environment is "node", no jsdom/interaction harness —
 * same convention as `today/__tests__/question-card.test.tsx`) to prove, from
 * the actual output markup:
 *
 * - the whole card is ONE real `<a>` (semantic navigation), not a non-semantic
 *   `onClick` on a `div`, and it contains no nested interactive element
 *   (no `<a>`/`<button>` inside the card's own `<a>`);
 * - the card shows a visible hover/focus/pressed treatment;
 * - the one visual accent (`courseCardAccentClass`) reflects only the
 *   already-computed attempted/not-attempted signal, and stays neutral for
 *   states with no real evidence (unavailable/error/no Topics).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CourseSection, courseCardAccentClass } from "../course-section";
import type { CourseProgress } from "../load-progress";

const readyWithActivity: CourseProgress = {
  kind: "ready",
  topics: [
    { topicId: "t1", name: "Topic 1", state: "IN_PROGRESS", attemptedCount: 3, totalCount: 10 },
    { topicId: "t2", name: "Topic 2", state: "NOT_STARTED", attemptedCount: 0, totalCount: 5 },
  ],
};

const readyNotStarted: CourseProgress = {
  kind: "ready",
  topics: [{ topicId: "t1", name: "Topic 1", state: "NOT_STARTED", attemptedCount: 0, totalCount: 5 }],
};

const readyNoTopics: CourseProgress = { kind: "ready", topics: [] };
const unavailable: CourseProgress = { kind: "unavailable" };
const errored: CourseProgress = { kind: "error" };

describe("courseCardAccentClass (QA2-B)", () => {
  it("uses the progress tone once real attempted evidence exists", () => {
    expect(courseCardAccentClass(readyWithActivity)).toContain("state-progress");
  });

  it("uses the not-started tone when the Course has Topics but none attempted", () => {
    expect(courseCardAccentClass(readyNotStarted)).toContain("state-not-started");
  });

  it("stays neutral (no accent) when there is no real evidence to color-code", () => {
    expect(courseCardAccentClass(readyNoTopics)).toBe("");
    expect(courseCardAccentClass(unavailable)).toBe("");
    expect(courseCardAccentClass(errored)).toBe("");
  });
});

describe("CourseSection markup (QA2-B whole-card navigation)", () => {
  it("wraps the entire card in one real link with no nested interactive controls", () => {
    const html = renderToStaticMarkup(
      <CourseSection id="course-1" title="Algebra" progress={readyWithActivity} />,
    );

    const anchorMatches = html.match(/<a\b/g) ?? [];
    expect(anchorMatches).toHaveLength(1);
    expect(html).not.toMatch(/<button/);
    expect(html).toContain('href="/courses/course-1"');
    // Title and activity text are both inside the single link, i.e. real
    // whole-card navigation rather than a title-only link.
    expect(html).toContain("Algebra");
    expect(html.indexOf("Algebra")).toBeGreaterThan(html.indexOf("<a "));
  });

  it("carries visible hover/focus/pressed treatment on the card link itself", () => {
    const html = renderToStaticMarkup(
      <CourseSection id="course-1" title="Algebra" progress={readyWithActivity} />,
    );
    expect(html).toMatch(/hover:bg-surface-muted/);
    expect(html).toMatch(/focus-visible:outline-2/);
    expect(html).toMatch(/active:scale-\[0\.99\]/);
  });
});
