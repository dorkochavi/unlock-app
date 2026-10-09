/**
 * PRE-REGISTERED CONTRACT TESTS for FUB-066 context-sensitive warning hardening.
 * Run 2026-10-09-ASSESSMENT-ENGINE-006, Slice B. Written from the Plan contract (docs/CHATGPT_PLAN.md section 5)
 * BEFORE any implementation; synthetic content only (plus the short human-reviewed patterns named in section 3:
 * HO-015, HO-017, HO-032, HO-063, HO-076 item 1). They encode the contract, not the implementation, and are not to be
 * edited after seeing implementation results except for a demonstrated test defect (documented in the Run report).
 * Evidence class: CONTRACT_TEST.
 *
 * Rules covered: OPTION_ABSOLUTE_TERM (strong adverb in a distractor only), KEY_STEM_LEXICAL_OVERLAP (no longer emitted),
 * STEM_TOO_SHORT (bare noun/fragment only; interrogative/imperative start or trailing ":" exempt).
 */
import { describe, expect, it } from "vitest";

import { lintQuestionItem } from "../question-lint";

const IDS = ["a", "b", "c", "d", "e"];

function item(prompt: string, contents: string[], correct: number[] = [0], type = "SINGLE_CHOICE") {
  return {
    questionType: type,
    prompt,
    answerOptions: contents.map((content, i) => ({ id: IDS[i] ?? `x${i}`, content })),
    correctOptionIds: correct.map((i) => IDS[i] ?? `x${i}`),
    explanation: "Explanation text for the synthetic item.",
  };
}
type Item = ReturnType<typeof item>;
const issuesOf = (it: Item, code: string) => lintQuestionItem(it).filter((i) => i.code === code);

const EN_STEM = "Which of the following is a prime number?";
const HE_STEM = "איזה מהמספרים הבאים הוא מספר ראשוני?";

// ---------------------------------------------------------------------------------------------------------------
// OPTION_ABSOLUTE_TERM
// ---------------------------------------------------------------------------------------------------------------
const ABS = "OPTION_ABSOLUTE_TERM";
const abs = (contents: string[], opts: { prompt?: string; type?: string; correct?: number[] } = {}): boolean =>
  issuesOf(item(opts.prompt ?? EN_STEM, contents, opts.correct ?? [0], opts.type ?? "SINGLE_CHOICE"), ABS).length > 0;
const absHe = (contents: string[], opts: { type?: string; correct?: number[] } = {}): boolean =>
  abs(contents, { prompt: HE_STEM, ...opts });

describe("OPTION_ABSOLUTE_TERM: positive shapes (strong adverb in a distractor only)", () => {
  it("English strong adverb in one distractor, single choice", () => {
    expect(abs(["Seven", "Nine", "It is always prime", "Twelve"])).toBe(true);
    expect(abs(["Seven", "Nine", "Twelve", "It is never prime"])).toBe(true);
    expect(abs(["Seven", "Nine", "Completely unrelated to primes", "Twelve"])).toBe(true);
    expect(abs(["Seven", "Nine", "Twelve", "Entirely determined by parity"])).toBe(true);
  });

  it("Hebrew strong adverb in one distractor, single choice (incl. vav prefix)", () => {
    expect(absHe(["שבע", "תשע", "המספר תמיד ראשוני", "שתים עשרה"])).toBe(true);
    expect(absHe(["שבע", "תשע", "שתים עשרה", "המספר לעולם אינו ראשוני"])).toBe(true);
    expect(absHe(["שבע", "תשע", "אף פעם לא ראשוני", "שתים עשרה"])).toBe(true);
    expect(absHe(["שבע", "תשע", "ותמיד זוגי", "שתים עשרה"])).toBe(true);
    expect(absHe(["שבע", "תשע", "שתים עשרה", "זה נכון בהכרח"])).toBe(true);
  });

  it("multiple choice: strong adverb in a non-correct option while no correct option carries one", () => {
    expect(abs(["Seven", "Eleven", "It is always prime", "Twelve"], { type: "MULTIPLE_CHOICE", correct: [0, 1] })).toBe(true);
    expect(absHe(["שבע", "אחד עשר", "המספר תמיד ראשוני", "שתים עשרה"], { type: "MULTIPLE_CHOICE", correct: [0, 1] })).toBe(true);
  });

  it("reports content-blind WARNING on the flagged distractors only", () => {
    const [i] = issuesOf(item(EN_STEM, ["Seven", "Nine", "It is always prime", "It is never prime"]), ABS);
    expect(i.severity).toBe("WARNING");
    expect(i.scope).toBe("ITEM");
    expect(i.optionIds).toEqual(["c", "d"]);
    expect(i.optionPositions).toEqual([2, 3]);
    const [j] = issuesOf(item(EN_STEM, ["Seven", "Nine", "Twelve", "It is never prime"], [1]), ABS);
    expect(j.optionIds).toEqual(["d"]);
  });
});

describe("OPTION_ABSOLUTE_TERM: non-targets (contract)", () => {
  it("strong adverb in the KEY only is not flagged (single and multiple choice)", () => {
    expect(abs(["It always holds", "Nine", "Twelve", "Fifteen"])).toBe(false);
    expect(absHe(["זה נכון תמיד", "תשע", "שתים עשרה", "חמש עשרה"])).toBe(false);
    expect(abs(["It always holds", "It is true", "Twelve", "Fifteen"], { type: "MULTIPLE_CHOICE", correct: [0, 1] })).toBe(false);
  });

  it("strong adverb in the key AND in a distractor is not flagged", () => {
    expect(abs(["It always holds", "Nine", "It never holds", "Fifteen"])).toBe(false);
    expect(absHe(["זה נכון תמיד", "תשע", "זה לעולם לא נכון", "חמש עשרה"])).toBe(false);
  });

  it("strong adverb in a distractor but also in one of several correct options is not flagged (multiple choice)", () => {
    expect(abs(["It always holds", "Eleven", "It never holds", "Fifteen"], { type: "MULTIPLE_CHOICE", correct: [0, 1] })).toBe(false);
    expect(abs(["Seven", "It is always true", "It never holds", "Fifteen"], { type: "MULTIPLE_CHOICE", correct: [0, 1] })).toBe(false);
  });

  it("all options carrying a strong term (symmetry) is not flagged; HO-017 pattern: every option begins with 'תמיד'", () => {
    expect(absHe(["תמיד חיובי", "תמיד שלילי", "תמיד אפס", "תמיד ראשוני"])).toBe(false);
    expect(abs(["Always positive", "Always negative", "Always zero", "Always prime"])).toBe(false);
  });

  it("weak-tier terms never trigger this code (Hebrew): HO-015 'אין לו שום משמעות סטטיסטית' as a distractor", () => {
    expect(absHe(["יש לו משמעות סטטיסטית", "הוא מעיד על קשר חלש", "אין לו שום משמעות סטטיסטית", "הוא תלוי בגודל המדגם"])).toBe(false);
    expect(absHe(["הקשר מובהק", "הקשר לא מובהק", "שום קשר לא נמצא", "הקשר חלש"])).toBe(false);
  });

  it("weak-tier terms never trigger this code: HO-063 'כל הציפורים עפות' as the key", () => {
    expect(absHe(["כל הציפורים עפות", "חלק מהציפורים עפות", "אף ציפור אינה עפה", "הציפורים הולכות"])).toBe(false);
  });

  it("weak-tier terms never trigger this code: normal Hebrew quantifiers in distractors", () => {
    expect(absHe(["שבע", "כל מספר אי זוגי", "רק מספר זוגי", "מספר שלילי בלבד"])).toBe(false);
    expect(absHe(["שבע", "כל התאים בגוף", "אף אחד מהמספרים", "רק תא אחד"])).toBe(false);
  });

  it("weak-tier terms never trigger this code: mathematical and universal propositions", () => {
    expect(absHe(["כל מספר זוגי מתחלק ב-2", "כל מספר מתחלק ב-3", "רק מספרים ראשוניים מתחלקים ב-2", "אף מספר אינו מתחלק ב-1"])).toBe(false);
    expect(abs(["Every even number is divisible by 2", "Every number is divisible by 3", "Only primes are divisible by 2", "Seven"])).toBe(false);
  });

  it("weak-tier terms never trigger this code: English 'all'/'only'/'every'/'none' in keys and distractors", () => {
    expect(abs(["All mammals breathe air", "Some fish breathe air", "Reptiles", "Amphibians"])).toBe(false);
    expect(abs(["Only water is required", "Light and water", "Sugar", "Oxygen"])).toBe(false);
    expect(abs(["Seven", "Nine", "All of them are even", "Only one of them is even"])).toBe(false);
    expect(abs(["Seven", "Nine", "Every integer qualifies", "None qualify"])).toBe(false);
  });

  it("whole-token matching: words merely containing a strong term are not flagged", () => {
    expect(abs(["Seven", "Nine", "Nevertheless prime", "Twelve"])).toBe(false);
    expect(abs(["Seven", "Nine", "Alwaysville", "Twelve"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// KEY_STEM_LEXICAL_OVERLAP: stops emitting entirely
// ---------------------------------------------------------------------------------------------------------------
const KSO = "KEY_STEM_LEXICAL_OVERLAP";
const kso = (prompt: string, contents: string[], correct: number[] = [0], type = "SINGLE_CHOICE"): boolean =>
  issuesOf(item(prompt, contents, correct, type), KSO).length > 0;

describe("KEY_STEM_LEXICAL_OVERLAP: never emitted (rule leaves deterministic ownership)", () => {
  it("old positive shape (English): key restates the stem, distractors have zero overlap", () => {
    expect(kso("Which structure uses hashing to provide constant lookup time?", ["Hashing constant lookup", "Stack", "Queue", "Graph"])).toBe(false);
  });

  it("old positive shape (Hebrew): key restates the stem with article/prefix variation, distractors have zero overlap", () => {
    expect(kso("מהי ההגדרה של התהליך הנשימה התאית בגוף?", ["נשימה תאית", "פוטוסינתזה", "חלוקה", "העברה"])).toBe(false);
  });

  it("HO-076 item 1 pattern: natural entity repetition between stem and key", () => {
    expect(kso("איזו עיר היא בירת צרפת ומושב הממשלה הצרפתית?", ["פריז, בירת צרפת", "ברלין", "רומא", "מדריד"])).toBe(false);
    expect(kso("Which city is the capital of France and seat of its government?", ["Paris, the capital of France", "Berlin", "Rome", "Madrid"])).toBe(false);
  });

  it("repeated domain term in all options", () => {
    expect(kso("איזה מהבאים מתאר את הפוטוסינתזה בצמחים ירוקים?", ["פוטוסינתזה בצמחים ירוקים באור", "פוטוסינתזה בצמחים בחושך", "פוטוסינתזה בפטריות", "פוטוסינתזה בחיידקים"])).toBe(false);
    expect(kso("What does photosynthesis produce in green plants?", ["Photosynthesis produces glucose in plants", "Photosynthesis produces methane", "Photosynthesis produces iron", "Photosynthesis produces salt"])).toBe(false);
  });

  it("vocabulary shared by several options, including the key", () => {
    expect(kso("Which sorting algorithm has quadratic average time complexity?", ["Bubble sort has quadratic average time", "Merge sort has quadratic time", "Heap sort has quadratic time", "Radix sort"])).toBe(false);
  });

  it("biology and science terminology overlap", () => {
    expect(kso("איזה אברון בתא אחראי לייצור אנרגיה בתהליך הנשימה התאית?", ["המיטוכונדריון, אברון בתא", "הריבוזום", "הגולגי", "הגרעין"])).toBe(false);
    expect(kso("Which organelle in the cell produces energy through cellular respiration?", ["Mitochondrion, the cell organelle for respiration", "Ribosome", "Nucleus", "Vacuole"])).toBe(false);
  });

  it("multiple choice keys with overlap", () => {
    expect(kso("Which of these processes occur in the cell nucleus during cell division?", ["Cell division of the nucleus", "DNA replication in the cell nucleus", "Protein folding", "Lipid transport"], [0, 1], "MULTIPLE_CHOICE")).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// STEM_TOO_SHORT
// ---------------------------------------------------------------------------------------------------------------
const STS = "STEM_TOO_SHORT";
const EN_OPTS = ["Paris", "Berlin", "Rome", "Madrid"];
const HE_OPTS = ["פריז", "ברלין", "רומא", "מדריד"];
const short = (prompt: string, contents: string[] = HE_OPTS): boolean => issuesOf(item(prompt, contents), STS).length > 0;

describe("STEM_TOO_SHORT: positive shapes (bare noun / fragment, < 4 words)", () => {
  it("English bare noun or fragment", () => {
    expect(short("Capital of France", EN_OPTS)).toBe(true);
    expect(short("Photosynthesis", EN_OPTS)).toBe(true);
    expect(short("Cell membrane", EN_OPTS)).toBe(true);
    expect(short("Whale species", EN_OPTS)).toBe(true); // begins with 'wh' but is not an interrogative word
  });

  it("Hebrew bare noun or fragment", () => {
    expect(short("פוטוסינתזה")).toBe(true);
    expect(short("בירת צרפת?")).toBe(true);
    expect(short("קרום התא")).toBe(true);
    expect(short("מהירות האור")).toBe(true); // begins with 'מה' letters but is not an interrogative word
    expect(short("מיתוכונדריון בתא")).toBe(true);
  });

  it("reports the existing content-blind WARNING shape with the unchanged minimum of 4 words", () => {
    const [i] = issuesOf(item("Capital of France", EN_OPTS), STS);
    expect(i.severity).toBe("WARNING");
    expect(i.scope).toBe("ITEM");
    expect(i.metrics).toEqual({ wordCount: 3, minimum: 4 });
  });
});

describe("STEM_TOO_SHORT: non-targets (contract)", () => {
  it("short Hebrew stems that begin with a closed-class interrogative or imperative", () => {
    for (const p of ["מהי בירת צרפת?", "מהו הסלע הקשה?", "מה בירת צרפת", "מי כתב המלט?", "איזה צבע?", "איזו עיר?", "כמה זה שתיים?", "מדוע השמיים כחולים", "למה השמיים כחולים", "היכן נמצאת פריז", "הגדר פוטוסינתזה", "ציין שלוש ערים"]) {
      expect(short(p), p).toBe(false);
    }
  });

  it("Hebrew single-letter prefix (ו ש ה ב ל) before the interrogative or imperative", () => {
    for (const p of ["ומהי בירת צרפת?", "ומי כתב?", "שמהו הסלע", "ולמה זה כך", "והגדר זאת", "וציין שתיים", "וכמה זה"]) {
      expect(short(p), p).toBe(false);
    }
  });

  it("short English stems that begin with an interrogative or imperative", () => {
    for (const p of ["What is hashing?", "Which city?", "Who wrote Hamlet", "How many sides", "Where is Paris", "Why is sky blue", "When did WW2 end", "Define hashing", "Name three planets", "List two primes", "WHAT IS DNA", "what is DNA"]) {
      expect(short(p, EN_OPTS), p).toBe(false);
    }
  });

  it("completion-form stems ending with ':' (HO-032 pattern 'התהליך שבו ... נקרא:')", () => {
    expect(short("התהליך נקרא:")).toBe(false);
    expect(short("תהליך זה נקרא:")).toBe(false);
    expect(short("התהליך שבו תאים מתחלקים נקרא:")).toBe(false);
    expect(short("The process is:", EN_OPTS)).toBe(false);
    expect(short("Capital of France:", EN_OPTS)).toBe(false);
    expect(short("בירת צרפת:  ")).toBe(false); // trailing whitespace after the colon
  });

  it("stems at or above the unchanged 4-word minimum are never flagged", () => {
    expect(short("Capital of France is", EN_OPTS)).toBe(false);
    expect(short("בירת צרפת היא עיר")).toBe(false);
  });

  it("the interrogative exemption is for the first word only", () => {
    expect(short("Paris what", EN_OPTS)).toBe(true);
    expect(short("צרפת מהי")).toBe(true);
  });

  it("empty prompt remains STEM_EMPTY, not STEM_TOO_SHORT", () => {
    expect(short("", EN_OPTS)).toBe(false);
  });
});
