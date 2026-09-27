/**
 * QA2-A targeted evidence for the shared Learn Mode `QuestionCard` (Today +
 * Practice). Server-renders (no jsdom/interaction — this repo's Vitest
 * environment is "node" and has no component-interaction harness) to prove,
 * from the actual output markup, the acceptance criteria that matter for
 * this Slice:
 *
 * - post-submit structural order: feedback/explanation appears BEFORE the
 *   answer options in document order, in normal flow (never a
 *   floating/translucent overlay on top of them);
 * - the sticky Continue action is present and is the only action once
 *   feedback exists (no competing primary action);
 * - correctness is never color-only: every post-submit option state pairs a
 *   text label (and, for selected states, an icon) with its color/border;
 * - selectedIncorrect uses the calm `state-reinforce` (amber) tokens, never
 *   `danger`/red;
 * - the "missed correct answer" case is rendered distinctly with an explicit
 *   correct-answer text label.
 *
 * `QuestionOption` selection state (selected+correct / selected+incorrect)
 * lives in `QuestionCard`'s internal `useState`, reachable only through real
 * click interaction; since `QuestionOption` itself is a pure/presentational
 * component driven entirely by props, it is rendered directly here (per
 * state) to prove each visual treatment without adding a jsdom/interaction
 * harness for a single presentation-layer Slice.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  optionFeedbackState,
  QuestionCard,
  QuestionOption,
  type QuestionCardItem,
} from "../question-card";
import type { AnswerFeedback } from "../select-displayed-item";

describe("optionFeedbackState (QA2-A)", () => {
  it("classifies all four states from selection + correctness", () => {
    const feedback: AnswerFeedback = {
      itemId: "item-1",
      isCorrect: false,
      correctOptionIds: ["opt-correct"],
      explanation: null,
    };
    expect(optionFeedbackState("opt-correct", true, feedback)).toBe("selectedCorrect");
    expect(optionFeedbackState("opt-wrong", true, feedback)).toBe("selectedIncorrect");
    expect(optionFeedbackState("opt-correct", false, feedback)).toBe("missedCorrect");
    expect(optionFeedbackState("opt-other", false, feedback)).toBe(null);
    expect(optionFeedbackState("opt-correct", false, null)).toBe(null);
  });
});

describe("QuestionOption visual states (QA2-A: no color-only correctness, no punitive red)", () => {
  it("selectedCorrect: positive color + icon + text label", () => {
    const html = renderToStaticMarkup(
      <QuestionOption
        content="4"
        multiple={false}
        selected
        locked
        dimmed={false}
        state="selectedCorrect"
        onToggle={() => {}}
      />,
    );
    expect(html).toContain("state-solid");
    expect(html).toContain("בחרת נכון");
    expect(html).toContain("<svg"); // check icon
    expect(html).not.toMatch(/text-danger|bg-danger|border-danger/);
  });

  it("selectedIncorrect: calm amber (state-reinforce), never danger/red, + icon + text label", () => {
    const html = renderToStaticMarkup(
      <QuestionOption
        content="5"
        multiple={false}
        selected
        locked
        dimmed={false}
        state="selectedIncorrect"
        onToggle={() => {}}
      />,
    );
    expect(html).toContain("state-reinforce");
    expect(html).toContain("בחרת — לא נכון");
    expect(html).toContain("<svg"); // x icon
    expect(html).not.toMatch(/text-danger|bg-danger|border-danger/);
  });

  it("missedCorrect: explicit positive/correct text label + color, distinct from selected states", () => {
    const html = renderToStaticMarkup(
      <QuestionOption
        content="4"
        multiple={false}
        selected={false}
        locked
        dimmed={false}
        state="missedCorrect"
        onToggle={() => {}}
      />,
    );
    expect(html).toContain("state-solid");
    expect(html).toContain("התשובה הנכונה");
  });

  it("unselected/incorrect (dimmed) option: muted, no state label", () => {
    const html = renderToStaticMarkup(
      <QuestionOption
        content="3"
        multiple={false}
        selected={false}
        locked
        dimmed
        state={null}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain("opacity-60");
    expect(html).not.toContain("בחרת");
    expect(html).not.toContain("התשובה הנכונה");
  });
});

const item: QuestionCardItem = {
  questionType: "SINGLE_CHOICE",
  prompt: "What is 2 + 2?",
  answerOptions: [
    { id: "opt-3", content: "3" },
    { id: "opt-4", content: "4" },
    { id: "opt-5", content: "5" },
  ],
};

function renderCard(feedback: AnswerFeedback | null) {
  return renderToStaticMarkup(
    <QuestionCard
      item={item}
      feedback={feedback}
      submitError={null}
      onSubmit={async () => {}}
      onContinue={() => {}}
      onSkip={async () => {}}
      onSelectionChange={() => {}}
    />,
  );
}

describe("QuestionCard post-submit structure (QA2-A)", () => {
  it("correct submission: feedback in normal flow BEFORE options, sticky Continue only", () => {
    const feedback: AnswerFeedback = {
      itemId: "item-1",
      isCorrect: true,
      correctOptionIds: ["opt-4"],
      explanation: "2 + 2 equals 4 by definition of addition.",
    };
    const html = renderCard(feedback);

    const feedbackIndex = html.indexOf('role="status"');
    const optionsIndex = html.indexOf("<ul");
    expect(feedbackIndex).toBeGreaterThan(-1);
    expect(optionsIndex).toBeGreaterThan(-1);
    expect(feedbackIndex).toBeLessThan(optionsIndex);

    // Feedback is in normal document flow, not a fixed/absolute overlay.
    const statusRegionMarkup = html.slice(feedbackIndex - 50, optionsIndex);
    expect(statusRegionMarkup).not.toMatch(/class="[^"]*\babsolute\b/);
    expect(statusRegionMarkup).not.toMatch(/class="[^"]*\bfixed\b/);
    expect(html).toContain("2 + 2 equals 4 by definition of addition.");

    // Only Continue is offered post-submit — no competing primary action.
    expect(html).toContain("המשך");
    expect(html).not.toContain("שליחה");
    expect(html).not.toContain("דלג");
  });

  it("incorrect submission (with a missed-correct option): feedback before options, calm tone", () => {
    const feedback: AnswerFeedback = {
      itemId: "item-1",
      isCorrect: false,
      correctOptionIds: ["opt-4"],
      explanation: null,
    };
    const html = renderCard(feedback);

    const feedbackIndex = html.indexOf('role="status"');
    const optionsIndex = html.indexOf("<ul");
    expect(feedbackIndex).toBeLessThan(optionsIndex);

    // Missed-correct option (opt-4, not selected by this render) is marked explicitly.
    expect(html).toContain("התשובה הנכונה");
    expect(html).not.toMatch(/text-danger|bg-danger|border-danger/);
    expect(html).toContain("המשך");
    expect(html).not.toContain("שליחה");
  });

  it("pre-submit: no feedback/correctness markup, Submit + Skip offered", () => {
    const html = renderCard(null);
    expect(html).not.toContain("בחרת נכון");
    expect(html).not.toContain("התשובה הנכונה");
    expect(html).not.toContain("state-reinforce");
    expect(html).toContain("שליחה");
    expect(html).toContain("דלג");
    expect(html).not.toContain("המשך");
  });
});
