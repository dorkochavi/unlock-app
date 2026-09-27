/**
 * QA2-C targeted evidence for the instructor Question Management row
 * (bounded visual polish: status pill instead of plain state text, divider
 * row instead of a boxed border — see `question-row.tsx`).
 *
 * Server-renders (same convention as `(learner)/courses/__tests__/page.test.tsx`
 * and `(learner)/today/__tests__/question-card.test.tsx` — this repo's Vitest
 * environment is "node", no jsdom) to prove, from the actual output markup,
 * that the pre-existing selection/publish/edit wiring this row renders is
 * unchanged by the visual rework:
 *
 * - the selection checkbox only renders when the row is selectable, reflects
 *   the `selected` prop via `checked`, and carries the caller's aria-label —
 *   the exact contract `handleBulkPublish`/`selectAllPublishable` in
 *   `page.tsx` rely on (unchanged in this Slice);
 * - a non-selectable row (already PUBLISHED, or Course archived) renders no
 *   checkbox at all;
 * - the Edit link still points at the same per-Question edit route;
 * - each Question state gets a distinct, non-red status pill (Draft = gray,
 *   Published = green, Published-with-draft-changes = amber) rather than
 *   plain text, and the three states are visually distinguishable from one
 *   another.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { QuestionRow } from "../question-row";

const baseProps = {
  displayPrompt: "מה התוצאה של 2+2?",
  topicLabel: "אלגברה",
  editHref: "/instructor/courses/course-1/questions/q-1",
  editLabel: "עריכה",
};

describe("QuestionRow markup (QA2-C bounded visual polish)", () => {
  it("renders a checked selection checkbox with the caller's aria-label when selectable", () => {
    const html = renderToStaticMarkup(
      <QuestionRow
        {...baseProps}
        state="DRAFT_ONLY"
        stateLabel="טיוטה"
        selectable
        selected
        onToggleSelected={vi.fn()}
        selectAriaLabel="בחירת השאלה: מה התוצאה של 2+2?"
      />,
    );
    expect(html).toMatch(/<input[^>]*type="checkbox"/);
    expect(html).toMatch(/checked=""/);
    expect(html).toContain('aria-label="בחירת השאלה: מה התוצאה של 2+2?"');
  });

  it("renders an unchecked selection checkbox when `selected` is false", () => {
    const html = renderToStaticMarkup(
      <QuestionRow
        {...baseProps}
        state="DRAFT_ONLY"
        stateLabel="טיוטה"
        selectable
        selected={false}
        onToggleSelected={vi.fn()}
        selectAriaLabel="בחירת השאלה"
      />,
    );
    expect(html).toMatch(/<input[^>]*type="checkbox"/);
    expect(html).not.toMatch(/checked=""/);
  });

  it("renders no checkbox at all when not selectable (already PUBLISHED, or Course archived)", () => {
    const html = renderToStaticMarkup(
      <QuestionRow
        {...baseProps}
        state="PUBLISHED"
        stateLabel="פורסם"
        selectable={false}
        selected={false}
        onToggleSelected={vi.fn()}
        selectAriaLabel="בחירת השאלה"
      />,
    );
    expect(html).not.toMatch(/<input/);
  });

  it("keeps the Edit link pointed at the same per-Question edit route", () => {
    const html = renderToStaticMarkup(
      <QuestionRow
        {...baseProps}
        state="PUBLISHED"
        stateLabel="פורסם"
        selectable={false}
        selected={false}
        onToggleSelected={vi.fn()}
        selectAriaLabel="בחירת השאלה"
      />,
    );
    expect(html).toContain('href="/instructor/courses/course-1/questions/q-1"');
    expect(html).toContain("עריכה");
  });

  it("gives each Question state a distinct, non-red status pill instead of plain text", () => {
    const render = (state: "DRAFT_ONLY" | "PUBLISHED" | "PUBLISHED_WITH_DRAFT_CHANGES", stateLabel: string) =>
      renderToStaticMarkup(
        <QuestionRow
          {...baseProps}
          state={state}
          stateLabel={stateLabel}
          selectable={false}
          selected={false}
          onToggleSelected={vi.fn()}
          selectAriaLabel="בחירת השאלה"
        />,
      );

    const draft = render("DRAFT_ONLY", "טיוטה");
    const published = render("PUBLISHED", "פורסם");
    const publishedWithChanges = render("PUBLISHED_WITH_DRAFT_CHANGES", "פורסם • יש שינויים שלא פורסמו");

    // Reuses the shared StatusPill primitive (rounded-full pill), not
    // hand-rolled markup.
    expect(draft).toMatch(/rounded-full/);
    expect(published).toMatch(/rounded-full/);
    expect(publishedWithChanges).toMatch(/rounded-full/);

    // Same tone tokens the learner-side Topic list already uses for
    // qualitative state (never a raw "danger"/red tone for a normal state).
    expect(draft).toContain("state-not-started");
    expect(published).toContain("state-solid");
    expect(publishedWithChanges).toContain("state-reinforce");

    expect(draft).not.toContain("text-danger");
    expect(published).not.toContain("text-danger");
    expect(publishedWithChanges).not.toContain("text-danger");

    // The three tones must actually differ from one another.
    const toneClasses = [draft, published, publishedWithChanges].map(
      (html) => html.match(/class="[^"]*rounded-full[^"]*"/)?.[0],
    );
    expect(new Set(toneClasses).size).toBe(3);
  });
});
