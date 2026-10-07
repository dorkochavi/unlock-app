import { describe, expect, it } from "vitest";

import type { TodayLearningRecap } from "@/application/dailyPlan/derive-learning-recap";

import {
  capTopics,
  confidenceInsight,
  hasRecapContent,
  orientationLine,
  recapOverview,
  soFarLine,
} from "../recap-presentation";

const recap = (over: Partial<TodayLearningRecap> = {}): TodayLearningRecap => ({
  answered: 4,
  skipped: 0,
  correct: 3,
  incorrect: 1,
  sureIncorrect: 0,
  sureCorrect: 0,
  topicsWorked: 0,
  strongTopics: [],
  revisitTopics: [],
  ...over,
});

describe("orientationLine (before starting)", () => {
  it("one scheduled review + one strengthening reads as natural Hebrew", () => {
    expect(
      orientationLine([{ actionType: "REVIEW_DUE" }, { actionType: "STRENGTHEN_MEMORY" }]),
    ).toBe("בתוכנית היום: חזרה מתוזמנת אחת וחיזוק זיכרון אחד");
  });

  it("single family, plural and numeric join use the maqaf", () => {
    expect(orientationLine([{ actionType: "REVIEW_DUE" }, { actionType: "REVIEW_DUE" }])).toBe(
      "בתוכנית היום: 2 חזרות מתוזמנות",
    );
    expect(
      orientationLine([
        { actionType: "REVIEW_DUE" },
        { actionType: "NEW_LEARNING" },
        { actionType: "NEW_LEARNING" },
      ]),
    ).toBe("בתוכנית היום: חזרה מתוזמנת אחת ו־2 שאלות בחומר חדש");
  });

  it("omits the line for unknown / no action types", () => {
    expect(orientationLine([])).toBeNull();
    expect(orientationLine([{ actionType: "SOMETHING_NEW" }])).toBeNull();
  });

  it("never leaks a raw internal code", () => {
    const line = orientationLine([{ actionType: "REVIEW_DUE" }, { actionType: "X_UNKNOWN" }]) ?? "";
    expect(line).not.toMatch(/[A-Z_]{4,}/);
  });
});

describe("soFarLine (in progress)", () => {
  it("X of Y correct", () => {
    expect(soFarLine(recap({ answered: 2, correct: 1 }))).toBe("עד עכשיו: 1 מתוך 2 נכונות");
  });
  it("omitted when nothing was answered (only skipped) or no recap", () => {
    expect(soFarLine(recap({ answered: 0, correct: 0, skipped: 2 }))).toBeNull();
    expect(soFarLine(undefined)).toBeNull();
  });
});

describe("confidenceInsight (at most one line)", () => {
  it("sure-incorrect singular / plural", () => {
    expect(confidenceInsight(recap({ sureIncorrect: 1 }))).toBe(
      "בשאלה אחת היית בטוח/ה אבל התשובה הייתה שגויה",
    );
    expect(confidenceInsight(recap({ sureIncorrect: 3 }))).toBe(
      "ב־3 שאלות היית בטוח/ה אבל התשובה הייתה שגויה",
    );
  });
  it("sure-incorrect has priority over sure-correct", () => {
    expect(confidenceInsight(recap({ sureIncorrect: 1, sureCorrect: 5 }))).toContain("שגויה");
  });
  it("sure-correct needs at least 2", () => {
    expect(confidenceInsight(recap({ sureCorrect: 1 }))).toBeNull();
    expect(confidenceInsight(recap({ sureCorrect: 2 }))).toBe("ב־2 שאלות צדקת גם בביטחון גבוה");
  });
  it("none when no confidence given", () => {
    expect(confidenceInsight(recap())).toBeNull();
  });
});

describe("capTopics", () => {
  it("shows up to 3 names and 'ועוד N' for the rest", () => {
    expect(capTopics(["a", "b", "c"])).toEqual({ shown: ["a", "b", "c"], moreLabel: null });
    expect(capTopics(["a", "b", "c", "d", "e"])).toEqual({
      shown: ["a", "b", "c"],
      moreLabel: "ועוד 2",
    });
  });
});

describe("recapOverview / hasRecapContent", () => {
  it("correct of answered and topic count (singular/plural/none)", () => {
    expect(recapOverview(recap({ topicsWorked: 1 }))).toEqual({
      correctOfAnswered: "3 מתוך 4 נכונות",
      topicsWorked: "עבדת על נושא אחד",
    });
    expect(recapOverview(recap({ topicsWorked: 3 })).topicsWorked).toBe("עבדת על 3 נושאים");
    expect(recapOverview(recap({ topicsWorked: 0 })).topicsWorked).toBeNull();
  });
  it("no recap surface without answers", () => {
    expect(hasRecapContent(undefined)).toBe(false);
    expect(hasRecapContent(recap({ answered: 0, correct: 0 }))).toBe(false);
    expect(hasRecapContent(recap())).toBe(true);
  });
});
