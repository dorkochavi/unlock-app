/**
 * QA2-A targeted evidence for the shared Learn Mode `QuestionCard` (Today +
 * Practice). Server-renders (no jsdom/interaction — this repo's Vitest
 * environment is "node" and has no component-interaction harness) to prove,
 * from the actual output markup, the acceptance criteria that matter for
 * this Slice:
 *
 * - post-submit structural order: feedback/explanation appears AFTER the
 *   answer options in document order (options stay in place), in normal flow (never a
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
import { getMessages } from "@/messages";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  optionFeedbackState,
  QuestionCard,
  QuestionOption,
  SURE_CONFIDENCE_LEVEL,
  UNSURE_CONFIDENCE_LEVEL,
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
    expect(html).toContain("state-disabled");
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

describe("QuestionCard selection-reason label (RUN010-E / OQ-018)", () => {
  function renderCardWithActionType(actionType: string | undefined) {
    return renderToStaticMarkup(
      <QuestionCard
        item={{ ...item, actionType }}
        feedback={null}
        submitError={null}
        onSubmit={async () => {}}
        onContinue={() => {}}
        onSkip={async () => {}}
        onSelectionChange={() => {}}
      />,
    );
  }

  it("maps each real internal NBA action type to its honest learner-facing label", () => {
    expect(renderCardWithActionType("REVIEW_DUE")).toContain("חזרה מתוזמנת");
    expect(renderCardWithActionType("RELEARN_LAPSE")).toContain("למידה מחדש");
    expect(renderCardWithActionType("REPAIR_MISCONCEPTION")).toContain("תיקון טעות נפוצה");
    expect(renderCardWithActionType("STRENGTHEN_MEMORY")).toContain("חיזוק זיכרון");
  });

  it("labels an ADR-017 New Material / cold-start item honestly as new material — never as a review/urgency reason it doesn't have", () => {
    const html = renderCardWithActionType("NEW_LEARNING");
    expect(html).toContain("חומר חדש");
    // Must never be mislabeled with a reason that implies scheduled review,
    // an unresolved lapse, a misconception, or ongoing strengthening — none
    // of those are true for a Question the learner has never attempted.
    expect(html).not.toContain("חזרה מתוזמנת");
    expect(html).not.toContain("למידה מחדש");
    expect(html).not.toContain("תיקון טעות נפוצה");
    expect(html).not.toContain("חיזוק זיכרון");
  });

  it("never leaks a raw/unmapped internal actionType code to the learner", () => {
    const html = renderCardWithActionType("SOME_FUTURE_ACTION_TYPE");
    expect(html).not.toContain("SOME_FUTURE_ACTION_TYPE");
    // Also re-confirm the historical bug this guards against: the real
    // internal New Material code must never appear verbatim once it IS
    // mapped, either — only its honest label should render.
    expect(renderCardWithActionType("NEW_LEARNING")).not.toContain("NEW_LEARNING");
  });

  it("renders no reason label at all when actionType is absent (Practice has no such label)", () => {
    const html = renderCardWithActionType(undefined);
    expect(html).not.toContain("חומר חדש");
    expect(html).not.toContain("חזרה מתוזמנת");
  });
});

describe("QuestionCard confidence chip-to-domain-value mapping (RUN010-G / OQ-014)", () => {
  it("pins the binary chip mapping against a silent swap — 'sure' MUST be 'high' (the exact value misconception.ts's CONFIDENT_ERROR gate requires) and 'not sure' MUST be 'low', never the reverse", () => {
    // This repo's Vitest env has no jsdom/click-interaction harness (see this
    // file's header), so the actual click wiring cannot be exercised
    // end-to-end here — this test instead pins the single named source of
    // truth both chips' onClick/selected logic reads from (question-card.tsx),
    // so a swap can only happen by editing this one exported pair.
    expect(SURE_CONFIDENCE_LEVEL).toBe("high");
    expect(UNSURE_CONFIDENCE_LEVEL).toBe("low");
    expect(SURE_CONFIDENCE_LEVEL).not.toBe(UNSURE_CONFIDENCE_LEVEL);
  });
});

describe("QuestionCard confidence toggle (RUN010-G / OQ-014)", () => {
  it("renders the optional confidence label + both chips, unselected, pre-submit", () => {
    const html = renderCard(null);
    expect(html).toContain("כמה בטוחים הייתם?");
    expect(html).toContain("בטוח/ה");
    expect(html).toContain("לא בטוח/ה");
    // Neither chip is pre-selected — an unexpressed confidence must never be
    // guessed on the learner's behalf.
    expect(html).toMatch(/aria-pressed="false"[^>]*>\s*בטוח\/ה/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>\s*לא בטוח\/ה/);
  });

  it("does not render the confidence toggle once feedback exists (post-submit)", () => {
    const feedback: AnswerFeedback = {
      itemId: "item-1",
      isCorrect: true,
      correctOptionIds: ["opt-4"],
      explanation: null,
    };
    const html = renderCard(feedback);
    expect(html).not.toContain("כמה בטוחים הייתם?");
    expect(html).not.toContain("בטוח/ה");
  });
});

describe("QuestionCard post-submit structure (QA2-A)", () => {
  it("correct submission: feedback in normal flow AFTER options, sticky Continue only", () => {
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
    expect(feedbackIndex).toBeGreaterThan(optionsIndex);

    // Feedback is in normal document flow, not a fixed/absolute overlay.
    const statusRegionMarkup = html.slice(feedbackIndex - 50);
    expect(statusRegionMarkup).not.toMatch(/class="[^"]*\babsolute\b/);
    expect(statusRegionMarkup).not.toMatch(/class="[^"]*\bfixed\b/);
    expect(html).toContain("2 + 2 equals 4 by definition of addition.");

    // Only Continue is offered post-submit — no competing primary action.
    expect(html).toContain("המשך");
    expect(html).not.toContain("שליחה");
    expect(html).not.toContain("דלג");
  });

  it("incorrect submission (with a missed-correct option): feedback after options, calm tone", () => {
    const feedback: AnswerFeedback = {
      itemId: "item-1",
      isCorrect: false,
      correctOptionIds: ["opt-4"],
      explanation: null,
    };
    const html = renderCard(feedback);

    const feedbackIndex = html.indexOf('role="status"');
    const optionsIndex = html.indexOf("<ul");
    expect(feedbackIndex).toBeGreaterThan(optionsIndex);

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

describe("QuestionCard incorrect feedback block", () => {
  it("pairs an icon with the incorrect label and stays amber, never danger", () => {
    const html = renderCard({
      itemId: "i",
      isCorrect: false,
      correctOptionIds: ["opt-4"],
      explanation: null,
    });
    const status = html.slice(html.indexOf('role="status"'));
    expect(status).toContain("<svg");
    expect(status).toContain(getMessages().today.incorrect);
    expect(status).toContain("state-reinforce");
    expect(status).not.toMatch(/danger/);
  });
});

describe("QuestionCard fresh mount (FUB-044: question shown again after a 401 + re-login)", () => {
  it("renders with no option selected", () => {
    const html = renderCard(null);
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('aria-pressed="true"');
  });
});
