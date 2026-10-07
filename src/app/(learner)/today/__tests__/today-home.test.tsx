/**
 * Server-rendered evidence (this repo's Vitest env is "node") for the Today
 * home states: no question queue/checklist and no prompts on the home, correct
 * remaining counts, recap only from completed evidence, empty sections hidden.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DailyPlanDto, DailyPlanItemDto } from "@/app/api/daily-plan/today/daily-plan-dto";
import type { TodayLearningRecap } from "@/application/dailyPlan/derive-learning-recap";

import { TodayComplete, TodayLanding } from "../today-home";

const PROMPT = "טקסט השאלה הסודי שאסור שיופיע בדף הבית";
const AT = ["REVIEW_DUE", "STRENGTHEN_MEMORY", "NEW_LEARNING", "RELEARN_LAPSE"];

function item(n: number, status: string): DailyPlanItemDto {
  return {
    id: `i${n}`,
    position: n,
    courseId: "c",
    questionId: `q${n}`,
    questionVersionId: `v${n}`,
    actionType: AT[(n - 1) % AT.length],
    tier: "T",
    otherApplicableTypes: [],
    reasons: [],
    status,
    resolvedAt: null,
    completedAt: null,
    questionType: "SINGLE_CHOICE",
    prompt: PROMPT,
    answerOptions: [],
  };
}

const plan = { id: "p", plannedForDate: "2026-10-07" } as DailyPlanDto;

const recap = (over: Partial<TodayLearningRecap> = {}): TodayLearningRecap => ({
  answered: 3,
  skipped: 0,
  correct: 2,
  incorrect: 1,
  sureIncorrect: 0,
  sureCorrect: 0,
  topicsWorked: 0,
  strongTopics: [],
  revisitTopics: [],
  ...over,
});

function landing(items: DailyPlanItemDto[], r?: TodayLearningRecap) {
  return renderToStaticMarkup(
    <TodayLanding plan={plan} items={items} recap={r} focusOnMount={false} onStart={() => {}} />,
  );
}
function complete(items: DailyPlanItemDto[], r?: TodayLearningRecap) {
  return renderToStaticMarkup(<TodayComplete items={items} recap={r} focusOnMount={false} />);
}

describe("Today home has no question queue / checklist", () => {
  const states: [string, string][] = [
    ["landing", landing([1, 2, 3, 4].map((n) => item(n, "pending")))],
    [
      "in progress",
      landing([item(1, "completed"), item(2, "completed"), item(3, "pending"), item(4, "pending")], recap()),
    ],
    ["done", complete([item(1, "completed"), item(2, "completed"), item(3, "skipped")], recap())],
  ];
  it.each(states)("%s: no numbered rows, no 'next' chip, no prompts, no list of questions", (_n, html) => {
    expect(html).not.toContain(PROMPT);
    expect(html).not.toMatch(/שאלה \d/);
    expect(html).not.toContain("הבא בתור");
    expect(html).not.toContain("פריטים להיום");
    expect(html).not.toContain("<ol");
  });
});

describe("landing", () => {
  it("not started: hero + one orientation line from frozen action types (no prompts)", () => {
    const html = landing([item(1, "pending"), item(2, "pending")]);
    expect(html).toContain("התוכנית שלך להיום מוכנה");
    expect(html).toContain("בתוכנית היום: חזרה מתוזמנת אחת וחיזוק זיכרון אחד");
    expect(html).not.toContain("עד עכשיו");
  });

  it("incomplete Today still shows the correct remaining count", () => {
    const html = landing(
      [item(1, "completed"), item(2, "completed"), item(3, "pending"), item(4, "pending")],
      recap({ answered: 2, correct: 1 }),
    );
    expect(html).toContain("נשארו לך 2 מתוך 4 שאלות להיום");
    expect(html).toContain("2 מתוך 4 הושלמו");
    expect(html).toContain("עד עכשיו: 1 מתוך 2 נכונות");
    expect(html).not.toContain("בתוכנית היום:");
  });

  it("in progress with only skips so far: no 'so far' line", () => {
    const html = landing([item(1, "skipped"), item(2, "pending")], undefined);
    expect(html).not.toContain("עד עכשיו");
  });
});

describe("done state", () => {
  const items = [item(1, "completed"), item(2, "completed"), item(3, "completed"), item(4, "skipped")];

  it("renders the recap surface with counts, topic lists and ONE confidence line", () => {
    const html = complete(
      items,
      recap({
        topicsWorked: 3,
        strongTopics: ["מטריצות", "וקטורים"],
        revisitTopics: ["Gauss"],
        sureIncorrect: 1,
        sureCorrect: 4,
      }),
    );
    expect(html).toContain("סיכום הלמידה שלך היום");
    expect(html).toContain("2 מתוך 3 נכונות");
    expect(html).toContain("עבדת על 3 נושאים");
    expect(html).toContain("ענית נכון ב:");
    expect(html).toContain("מטריצות");
    expect(html).toContain("כדאי לחזור על:");
    expect(html).toContain("Gauss");
    expect(html).toContain("בשאלה אחת היית בטוח/ה אבל התשובה הייתה שגויה");
    expect(html).not.toContain("צדקת גם בביטחון גבוה");
    expect(html).toContain("סיימת את התוכנית של היום");
    expect(html).toContain("לצפייה בהתקדמות");
  });

  it("single-answer strong topic: shown under the scoped heading, no 'everything' claim; lists are labelled", () => {
    const html = complete([item(1, "completed"), item(2, "skipped")], recap({ answered: 1, correct: 1, incorrect: 0, strongTopics: ["מטריצות"], topicsWorked: 1 }));
    expect(html).toContain("ענית נכון ב:");
    expect(html).toContain("מטריצות");
    expect(html).not.toContain("הכול");
    expect(html).toContain('aria-labelledby="today-recap-strong"');
    expect(html).toContain('id="today-recap-strong"');
  });

  it("hides every empty section (no empty headings) and omits the surface without answers", () => {
    const only = complete(items, recap({ correct: 3, incorrect: 0 }));
    expect(only).toContain("סיכום הלמידה שלך היום");
    expect(only).not.toContain("ענית נכון ב:");
    expect(only).not.toContain("כדאי לחזור על:");
    expect(only).not.toContain("עבדת על");
    expect(only).not.toContain("בטוח/ה");

    expect(complete(items, undefined)).not.toContain("סיכום הלמידה שלך היום");
    expect(complete([item(1, "skipped")], recap({ answered: 0, correct: 0, incorrect: 0, skipped: 1 }))).not.toContain(
      "סיכום הלמידה שלך היום",
    );
  });

  it("caps topic lists at 3 names + 'ועוד N' and wraps long names", () => {
    const html = complete(
      items,
      recap({ strongTopics: ["א", "ב", "ג", "ד", "ה", "ו"], topicsWorked: 6 }),
    );
    expect(html).toContain("ועוד 3");
    expect(html).not.toContain(">ד<");
    expect(html).toContain("break-words");
  });

  it("does not claim mastery/improvement or system attribution", () => {
    const html = complete(items, recap({ strongTopics: ["א"], revisitTopics: ["ב"], topicsWorked: 2 }));
    for (const forbidden of ["שליטה", "השתפר", "המערכת זיהתה", "האלגוריתם", "חולשה"]) {
      expect(html).not.toContain(forbidden);
    }
  });
});
