/**
 * PRE-REGISTERED CONTRACT TESTS for OPTION_COMBINATION_REFERENCE (FUB-064).
 * Run 2026-10-09-ASSESSMENT-ENGINE-005, Slice B. Written from the Plan contract (docs/CHATGPT_PLAN.md section 4)
 * BEFORE any implementation; synthetic content only. They encode the contract, not the implementation, and are
 * not to be edited after seeing implementation results except for a demonstrated test defect (documented in the Run report).
 * Evidence class: CONTRACT_TEST.
 */
import { describe, expect, it } from "vitest";

import { lintQuestionItem } from "../question-lint";

const CODE = "OPTION_COMBINATION_REFERENCE";
const IDS = ["a", "b", "c", "d", "e"];

function item(prompt: string, contents: string[], correct: number[] = [0], type = "SINGLE_CHOICE", ids: string[] = IDS) {
  return {
    questionType: type,
    prompt,
    answerOptions: contents.map((content, i) => ({ id: ids[i] ?? `x${i}`, content })),
    correctOptionIds: correct.map((i) => ids[i] ?? `x${i}`),
    explanation: "Explanation text for the synthetic item.",
  };
}
const issuesOf = (it: ReturnType<typeof item>) => lintQuestionItem(it).filter((i) => i.code === CODE);
const fires = (contents: string[], opts: { prompt?: string; type?: string; correct?: number[]; ids?: string[] } = {}): boolean =>
  issuesOf(item(opts.prompt ?? "Which of the following is a prime number?", contents, opts.correct ?? [0], opts.type ?? "SINGLE_CHOICE", opts.ids)).length > 0;

const EN4 = (d: string): string[] => ["Two", "Four", "Seven", d];
const HE4 = (d: string): string[] => ["אדום", "כחול", "ירוק", d];

describe("OPTION_COMBINATION_REFERENCE: positive shapes (contract)", () => {
  it("English cue + two references to other options", () => {
    expect(fires(EN4("Both a and c"))).toBe(true);
    expect(fires(EN4("Both A and C"))).toBe(true);
    expect(fires(EN4("Both a and b"), { type: "MULTIPLE_CHOICE", correct: [0, 1, 3] })).toBe(true);
    expect(fires(EN4("Options a and c"))).toBe(true);
    expect(fires(EN4("Answers b and c are correct"))).toBe(true);
    expect(fires(EN4("Both a, b and c"))).toBe(true);
    expect(fires(EN4("both a or b"))).toBe(true);
  });

  it("Hebrew cue + two references (letters, with and without geresh / vav prefix / hyphen)", () => {
    expect(fires(HE4("תשובות א ו-ג נכונות"))).toBe(true);
    expect(fires(HE4("תשובות א' וב' נכונות"))).toBe(true);
    expect(fires(HE4("התשובות א ו-ב"))).toBe(true);
    expect(fires(HE4("אפשרויות ב ו-ג בלבד"))).toBe(true);
    expect(fires(HE4("תשובות א, ב"))).toBe(true);
  });

  it("references may resolve by option id rather than ordinal letter", () => {
    expect(fires(["Two", "Four", "Seven", "Both p and q"], { ids: ["q", "p", "r", "s"] })).toBe(true);
  });

  it("reports content-blind WARNING on the referencing option only", () => {
    const [i] = issuesOf(item("Which of the following is a prime number?", EN4("Both a and c")));
    expect(i.severity).toBe("WARNING");
    expect(i.scope).toBe("ITEM");
    expect(i.optionIds).toEqual(["d"]);
    expect(i.optionPositions).toEqual([3]);
  });

  it("applies to SINGLE_CHOICE and MULTIPLE_CHOICE alike, and independently of the key", () => {
    expect(fires(EN4("Both a and c"), { correct: [1] })).toBe(true);
    expect(fires(EN4("Both a and c"), { type: "MULTIPLE_CHOICE", correct: [0, 2] })).toBe(true);
  });

  it("is case-insensitive and tolerant of extra whitespace/punctuation", () => {
    expect(fires(EN4("  BOTH  A   AND  C. "))).toBe(true);
    expect(fires(EN4("(Both) a & c"))).toBe(true);
  });
});

describe("OPTION_COMBINATION_REFERENCE: non-targets (contract)", () => {
  it("ordinary conjunctions are never enough", () => {
    expect(fires(EN4("Erosion by wind and rain"))).toBe(false);
    expect(fires(EN4("Nitrogen or oxygen"))).toBe(false);
    expect(fires(HE4("המים מורכבים ממימן וחמצן"))).toBe(false);
    expect(fires(HE4("אדום או כחול"))).toBe(false);
    expect(fires(EN4("Both parents and teachers"))).toBe(false);
  });

  it("absolute-term content and symmetric patterns are not combination references", () => {
    expect(fires(HE4("כל הציפורים עפות"))).toBe(false);
    expect(fires(HE4("אין לו שום משמעות סטטיסטית"))).toBe(false);
    expect(fires(["תמיד חיובי", "תמיד שלילי", "תמיד אפס", "תמיד שווה לאחד"])).toBe(false);
    expect(fires(["Always a prime", "Always an even", "Always an odd", "Always a square"])).toBe(false);
  });

  it("lexical overlap with the stem is not a reference", () => {
    expect(fires(["The prime number two", "The even number four", "The odd number nine", "The square number sixteen"], { prompt: "Which prime number is even?" })).toBe(false);
  });

  it("an option listing two substantive concepts is not a reference", () => {
    expect(fires(["Oxygen and nitrogen", "Helium and neon", "Carbon and lead", "Iron and tin"])).toBe(false);
    expect(fires(HE4("חמצן וחנקן"))).toBe(false);
  });

  it("math / logic with 'and', plus or commas but no cue + option reference", () => {
    expect(fires(["x = 2 and x = 3", "x + y = 5", "a, b and c are collinear", "p and q is false"])).toBe(false);
    expect(fires(["a and b", "a or b", "b and c", "c or d"])).toBe(false);
  });

  it("a letter used as ordinary text, without cue + two references, is not an option id", () => {
    expect(fires(["Vitamin A", "Vitamins A and C", "Vitamin D", "Vitamin K"])).toBe(false);
    expect(fires(HE4("ויטמין A ו-C"))).toBe(false);
    expect(fires(HE4("האות א והאות ב"))).toBe(false);
    expect(fires(EN4("Option a"))).toBe(false);
    expect(fires(EN4("Both a and e"), { ids: ["a", "b", "c", "d"] })).toBe(false);
  });

  it("cue + references followed or preceded by extra content words is not a pure reference phrase", () => {
    expect(fires(EN4("Both A and C vitamins"))).toBe(false);
    expect(fires(EN4("Both A and B blood types are universal donors"))).toBe(false);
  });

  it("all/none of the above keep their own codes and are not double-reported", () => {
    const all = lintQuestionItem(item("Which of the following is a prime number?", EN4("All of the above")));
    expect(all.map((i) => i.code)).toContain("OPTION_ALL_OF_ABOVE");
    expect(all.map((i) => i.code)).not.toContain(CODE);
    const none = lintQuestionItem(item("Which of the following is a prime number?", HE4("אף אחת מהתשובות")));
    expect(none.map((i) => i.code)).toContain("OPTION_NONE_OF_ABOVE");
    expect(none.map((i) => i.code)).not.toContain(CODE);
  });

  it("legitimate multi-answer wording with no option reference is not flagged", () => {
    const stem = "Select all that apply: which of the following are fruits in botanical terms?";
    expect(fires(["Tomato", "Cucumber", "Carrot", "Both tomato and cucumber"], { prompt: stem, type: "MULTIPLE_CHOICE", correct: [0, 1, 3] })).toBe(false);
    expect(fires(["Tomato", "Cucumber", "Carrot", "Onion"], { prompt: stem, type: "MULTIPLE_CHOICE", correct: [0, 1] })).toBe(false);
  });

  it("references that do not resolve to another option of the same item are ignored", () => {
    expect(fires(EN4("Both d and d"))).toBe(false);
    expect(fires(EN4("Both a and z"))).toBe(false);
  });

  it("does not throw on hostile input and stays bounded", () => {
    expect(() => lintQuestionItem(null)).not.toThrow();
    expect(() => lintQuestionItem({ answerOptions: [{ id: "a", content: "both ".repeat(5000) + "a and b" }] })).not.toThrow();
  });
});
