/**
 * Tests for the pure question linter prototype
 * (Run 2026-10-08-ASSESSMENT-ENGINE-NIGHT-001, Slice H). Hand-written fixtures only.
 */
import { describe, expect, it } from "vitest";

import {
  KEY_POSITION_RUN_LENGTH,
  MAX_LINT_OPTIONS,

  MIN_SET_SIZE,
  lintQuestionBatch,
  lintQuestionItem,
  lintQuestionSet,
  summarizeLintIssues,
  type QuestionLintIssue,
} from "../question-lint";

import { comparisonKey, duplicateKey, stripHebrewPrefixes } from "../text-normalize";

type Opt = { id: string; content: string };
type Item = {
  questionType: string;
  prompt: string;
  answerOptions: Opt[];
  correctOptionIds: string[];
  explanation: string | null;
};

const IDS = ["A", "B", "C", "D"];
function opts(contents: string[]): Opt[] {
  return contents.map((content, i) => ({ id: IDS[i] ?? `X${i}`, content }));
}

const EN_CLEAN: Item = {
  questionType: "SINGLE_CHOICE",
  prompt: "Which data structure provides constant time lookup by key?",
  answerOptions: opts(["Hash table", "Linked list", "Binary heap", "Sorted array"]),
  correctOptionIds: ["A"],
  explanation: "Hash tables map keys to buckets.",
};

const HE_CLEAN: Item = {
  questionType: "SINGLE_CHOICE",
  prompt: "מהו התהליך שבו תאים מפרקים גלוקוז לשם הפקת אנרגיה?",
  answerOptions: opts(["נשימה תאית", "פוטוסינתזה", "חלוקת תאים", "העברה פעילה"]),
  correctOptionIds: ["A"],
  explanation: "בנשימה תאית מופקת אנרגיה מגלוקוז.",
};

function item(over: Partial<Item>, base: Item = EN_CLEAN): Item {
  return { ...base, ...over };
}
function codes(issues: QuestionLintIssue[]): string[] {
  return issues.map((i) => i.code);
}
function lint(over: Partial<Item>, base: Item = EN_CLEAN): string[] {
  return codes(lintQuestionItem(item(over, base)));
}

describe("clean items", () => {
  it("English clean item raises nothing", () => {
    expect(lintQuestionItem(EN_CLEAN)).toEqual([]);
  });
  it("Hebrew clean item raises nothing", () => {
    expect(lintQuestionItem(HE_CLEAN)).toEqual([]);
  });
  it("accepts CanonicalQuestionRow-shaped input with extra fields", () => {
    expect(lintQuestionItem({ ...EN_CLEAN, sourceRowNumber: 3, topicName: "Data" })).toEqual([]);
  });
});

describe("item ERRORS", () => {
  it("STEM_EMPTY", () => {
    expect(lint({ prompt: "   " })).toContain("STEM_EMPTY");
    expect(lint({})).not.toContain("STEM_EMPTY");
  });
  it("OPTIONS_TOO_FEW", () => {
    expect(lint({ answerOptions: opts(["Only one"]) })).toContain("OPTIONS_TOO_FEW");
    expect(lint({})).not.toContain("OPTIONS_TOO_FEW");
  });
  it("OPTION_EMPTY lists ids", () => {
    const r = lintQuestionItem(item({ answerOptions: opts(["Hash table", " ", "Binary heap", "Sorted array"]) }));
    expect(r.find((i) => i.code === "OPTION_EMPTY")?.optionIds).toEqual(["B"]);
    expect(lint({})).not.toContain("OPTION_EMPTY");
  });
  it("OPTION_ID_DUPLICATE", () => {
    const r = lintQuestionItem(
      item({ answerOptions: [{ id: "A", content: "One" }, { id: "A", content: "Two" }, { id: "B", content: "Three" }] }),
    );
    expect(r.find((i) => i.code === "OPTION_ID_DUPLICATE")?.optionIds).toEqual(["A", "A"]);
    expect(lint({})).not.toContain("OPTION_ID_DUPLICATE");
  });
  it("OPTION_DUPLICATE_EXACT (identical after trim) is not also NORMALIZED", () => {
    const c = lint({ answerOptions: opts(["Hash table ", "Hash table", "Binary heap", "Sorted array"]) });
    expect(c).toContain("OPTION_DUPLICATE_EXACT");
    expect(c).not.toContain("OPTION_DUPLICATE_NORMALIZED");
    expect(lint({})).not.toContain("OPTION_DUPLICATE_EXACT");
  });

  describe("OPTION_DUPLICATE_NORMALIZED (named acceptance)", () => {
    it("fires for options differing only by case and whitespace", () => {
      const c = lint({ answerOptions: opts(["Hash Table", "hash   table", "Binary heap", "Sorted array"]) });
      expect(c).toContain("OPTION_DUPLICATE_NORMALIZED");
      expect(c).not.toContain("OPTION_DUPLICATE_EXACT");
    });
    it("fires for options differing only by niqqud", () => {
      const c = lint({ answerOptions: opts(["שָׁלוֹם", "שלום", "תודה", "בבקשה"]) }, HE_CLEAN);
      expect(c).toContain("OPTION_DUPLICATE_NORMALIZED");
    });
    it("fires for final-letter, quote and RTL-mark differences", () => {
      expect(lint({ answerOptions: opts(["מלכ", "מלך", "שולחן", "כיסא"]) }, HE_CLEAN)).toContain("OPTION_DUPLICATE_NORMALIZED");
      expect(lint({ answerOptions: opts(['מנכ"ל', "מנכ״ל", "שולחן", "כיסא"]) }, HE_CLEAN)).toContain("OPTION_DUPLICATE_NORMALIZED");
      expect(lint({ answerOptions: opts(["שלום‏", "שלום", "שולחן", "כיסא"]) }, HE_CLEAN)).toContain("OPTION_DUPLICATE_NORMALIZED");
    });
    it("fires for terminal punctuation difference; stays quiet for different text", () => {
      expect(lint({ answerOptions: opts(["Hash table.", "Hash table", "Binary heap", "Sorted array"]) })).toContain("OPTION_DUPLICATE_NORMALIZED");
      expect(lint({ answerOptions: opts(["Hash table", "Hash tables", "Binary heap", "Sorted array"]) })).not.toContain("OPTION_DUPLICATE_NORMALIZED");
    });
  });

  it("CORRECT_COUNT_INVALID per type", () => {
    expect(lint({ correctOptionIds: ["A", "B"] })).toContain("CORRECT_COUNT_INVALID");
    expect(lint({ correctOptionIds: [] })).toContain("CORRECT_COUNT_INVALID");
    expect(lint({ questionType: "MULTIPLE_CHOICE", correctOptionIds: [] })).toContain("CORRECT_COUNT_INVALID");
    expect(lint({ questionType: "MULTIPLE_CHOICE", correctOptionIds: ["A", "B"] })).not.toContain("CORRECT_COUNT_INVALID");
    expect(lint({})).not.toContain("CORRECT_COUNT_INVALID");
  });
  it("CORRECT_ID_UNKNOWN", () => {
    expect(lint({ correctOptionIds: ["Z"] })).toContain("CORRECT_ID_UNKNOWN");
    expect(lint({})).not.toContain("CORRECT_ID_UNKNOWN");
  });
});

describe("item WARNINGS", () => {
  it("STEM_TOO_SHORT", () => {
    expect(lint({ prompt: "Define hashing" })).toContain("STEM_TOO_SHORT");
    expect(lint({ prompt: "" })).not.toContain("STEM_TOO_SHORT"); // empty is STEM_EMPTY instead
    expect(lint({})).not.toContain("STEM_TOO_SHORT");
  });
  it("STEM_NEGATIVE_WORDING English and Hebrew incl. attached prefix", () => {
    expect(lint({ prompt: "Which of these is NOT a sorting algorithm?" })).toContain("STEM_NEGATIVE_WORDING");
    expect(lint({ prompt: "Which of these is correct EXCEPT one?" })).toContain("STEM_NEGATIVE_WORDING");
    expect(lint({ prompt: "איזה מהבאים אינו אלגוריתם מיון?" }, HE_CLEAN)).toContain("STEM_NEGATIVE_WORDING");
    expect(lint({ prompt: "כל האלגוריתמים מלבד אחד הם מיון?" }, HE_CLEAN)).toContain("STEM_NEGATIVE_WORDING");
    expect(lint({ prompt: "בחרו מבנה נתונים שלא משתמש בהשוואות" }, HE_CLEAN)).toContain("STEM_NEGATIVE_WORDING");
    expect(lint({})).not.toContain("STEM_NEGATIVE_WORDING");
    expect(lint({}, HE_CLEAN)).not.toContain("STEM_NEGATIVE_WORDING");
  });
  it("OPTION_ALL_OF_ABOVE / OPTION_NONE_OF_ABOVE (not also absolute)", () => {
    const a = lintQuestionItem(item({ answerOptions: opts(["Hash table", "Linked list", "Binary heap", "All of the above"]) }));
    expect(a.find((i) => i.code === "OPTION_ALL_OF_ABOVE")?.optionIds).toEqual(["D"]);
    expect(codes(a)).not.toContain("OPTION_ABSOLUTE_TERM");
    const n = lintQuestionItem(item({ answerOptions: opts(["Hash table", "Linked list", "Binary heap", "None of the above"]) }));
    expect(n.find((i) => i.code === "OPTION_NONE_OF_ABOVE")?.optionIds).toEqual(["D"]);
    expect(lint({ answerOptions: opts(["נשימה תאית", "פוטוסינתזה", "חלוקת תאים", "כל התשובות נכונות"]) }, HE_CLEAN)).toContain("OPTION_ALL_OF_ABOVE");
    expect(lint({ answerOptions: opts(["נשימה תאית", "פוטוסינתזה", "חלוקת תאים", "אף אחת מהתשובות"]) }, HE_CLEAN)).toContain("OPTION_NONE_OF_ABOVE");
    expect(lint({})).not.toContain("OPTION_ALL_OF_ABOVE");
    expect(lint({})).not.toContain("OPTION_NONE_OF_ABOVE");
  });
  it("OPTION_ABSOLUTE_TERM English, Hebrew, prefixed Hebrew, whole-word only", () => {
    expect(lint({ answerOptions: opts(["It always works", "Linked list", "Binary heap", "Sorted array"]) })).toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({ answerOptions: opts(["תמיד נכון", "פוטוסינתזה", "חלוקת תאים", "העברה פעילה"]) }, HE_CLEAN)).toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({ answerOptions: opts(["ותמיד נכון", "פוטוסינתזה", "חלוקת תאים", "העברה פעילה"]) }, HE_CLEAN)).toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({ answerOptions: opts(["אף פעם לא", "פוטוסינתזה", "חלוקת תאים", "העברה פעילה"]) }, HE_CLEAN)).toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({ answerOptions: opts(["Allocation", "Linked list", "Binary heap", "Sorted array"]) })).not.toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({})).not.toContain("OPTION_ABSOLUTE_TERM");
  });
  it("KEY_LONGEST_OPTION", () => {
    const c = lint({
      answerOptions: opts(["A hash table, giving constant time lookup", "Linked list", "Binary heap", "Sorted array"]),
    });
    expect(c).toContain("KEY_LONGEST_OPTION");
    // not for multiple choice, not when margin is small
    expect(lint({ questionType: "MULTIPLE_CHOICE", answerOptions: opts(["A hash table, giving constant time lookup", "Linked list", "Binary heap", "Sorted array"]) })).not.toContain("KEY_LONGEST_OPTION");
    expect(lint({})).not.toContain("KEY_LONGEST_OPTION");
  });
  it("OPTION_LENGTH_IMBALANCE", () => {
    expect(lint({ answerOptions: opts(["Heap", "Linked list", "Binary heap", "A sorted array kept in memory order"]) })).toContain("OPTION_LENGTH_IMBALANCE");
    expect(lint({})).not.toContain("OPTION_LENGTH_IMBALANCE");
  });
  it("KEY_STEM_LEXICAL_OVERLAP English and Hebrew prefix heuristic", () => {
    const en = item({
      prompt: "Which structure uses hashing to provide constant lookup time?",
      answerOptions: opts(["Hashing constant lookup", "Stack", "Queue", "Graph"]),
    });
    expect(codes(lintQuestionItem(en))).toContain("KEY_STEM_LEXICAL_OVERLAP");
    // Hebrew: stem has attached article, option does not
    const he = item(
      {
        prompt: "מהי ההגדרה של התהליך הנשימה התאית בגוף?",
        answerOptions: opts(["נשימה תאית", "פוטוסינתזה", "חלוקה", "העברה"]),
      },
      HE_CLEAN,
    );
    expect(codes(lintQuestionItem(he))).toContain("KEY_STEM_LEXICAL_OVERLAP");
    expect(lint({})).not.toContain("KEY_STEM_LEXICAL_OVERLAP");
  });
  it("OPTION_OVERLAP_HIGH", () => {
    const c = lint({
      answerOptions: opts(["alpha beta gamma delta epsilon zeta", "alpha beta gamma delta epsilon zeta eta", "Binary heap", "Sorted array"]),
    });
    expect(c).toContain("OPTION_OVERLAP_HIGH");
    expect(lint({})).not.toContain("OPTION_OVERLAP_HIGH");
  });
  it("OPTION_WHITESPACE_ANOMALY (leading, double, control, bidi)", () => {
    for (const bad of [" Hash table", "Hash  table", "Hash\ttable", "Hash table‏", "Hash table "]) {
      expect(lint({ answerOptions: opts([bad, "Linked list", "Binary heap", "Sorted array"]) })).toContain("OPTION_WHITESPACE_ANOMALY");
    }
    expect(lint({})).not.toContain("OPTION_WHITESPACE_ANOMALY");
  });
  it("EXPLANATION_MISSING", () => {
    expect(lint({ explanation: null })).toContain("EXPLANATION_MISSING");
    expect(lint({ explanation: "   " })).toContain("EXPLANATION_MISSING");
    expect(lint({ explanation: undefined as unknown as null })).toContain("EXPLANATION_MISSING");
    expect(lint({})).not.toContain("EXPLANATION_MISSING");
  });
});

// ---- Set fixtures ----
const STEMS = [
  "Which structure gives constant lookup time",
  "Explain why recursion needs a base case",
  "Name the protocol used for secure web traffic",
  "What does the compiler produce from source code",
  "Describe how a queue differs from a stack",
  "Identify the layer that routes packets between networks",
  "Select the sorting method with guaranteed n log n",
  "Define the purpose of an index in databases",
  "Choose the cache policy that evicts oldest entries",
  "Decide which join keeps unmatched left rows",
  "Locate the component that schedules processes",
  "Recall the property that makes hashing deterministic",
];
function setItem(i: number, keyPos: number, over: Partial<Item> = {}): Item {
  return {
    questionType: "SINGLE_CHOICE",
    prompt: STEMS[i % STEMS.length],
    answerOptions: opts(["alpha", "bravo", "charlie", "delta"]),
    correctOptionIds: [IDS[keyPos]],
    explanation: "x",
    ...over,
  };
}
function setOf(positions: number[]): Item[] {
  return positions.map((p, i) => setItem(i, p));
}
const BALANCED = [0, 1, 2, 3, 0, 1, 2, 3];

describe("set linter", () => {
  describe("SET_TOO_SMALL (named acceptance)", () => {
    it("fires once for fewer than MIN_SET_SIZE and skips distribution checks", () => {
      expect(MIN_SET_SIZE).toBe(8);
      const r = lintQuestionSet(setOf([0, 0, 0, 0, 0, 0, 0]));
      expect(codes(r).filter((c) => c === "SET_TOO_SMALL")).toHaveLength(1);
      expect(codes(r)).not.toContain("KEY_POSITION_IMBALANCE");
      expect(codes(r)).not.toContain("KEY_POSITION_RUN");
    });
    it("does not fire for >= 8", () => {
      expect(codes(lintQuestionSet(setOf(BALANCED)))).not.toContain("SET_TOO_SMALL");
      expect(lintQuestionSet(setOf(BALANCED))).toEqual([]);
      expect(codes(lintQuestionSet(setOf([...BALANCED, 0, 1, 2, 3])))).not.toContain("SET_TOO_SMALL");
    });
  });

  it("KEY_POSITION_IMBALANCE over a set of >= 8 (named acceptance)", () => {
    const r = lintQuestionSet(setOf([0, 1, 0, 2, 0, 3, 0, 1]));
    const imb = r.find((i) => i.code === "KEY_POSITION_IMBALANCE");
    expect(imb?.itemIndexes).toEqual([0, 2, 4, 6]);
    expect(imb?.metrics).toEqual({ position: 1, optionCount: 4, count: 4, total: 8 });
    expect(codes(r)).not.toContain("KEY_POSITION_RUN");
    expect(codes(lintQuestionSet(setOf(BALANCED)))).not.toContain("KEY_POSITION_IMBALANCE");
  });

  it("KEY_POSITION_RUN for run >= 4 (named acceptance)", () => {
    expect(KEY_POSITION_RUN_LENGTH).toBe(4);
    const positions = [2, 2, 2, 2, 0, 1, 3, 0, 1, 3, 0, 1];
    const r = lintQuestionSet(setOf(positions));
    const run = r.find((i) => i.code === "KEY_POSITION_RUN");
    expect(run?.itemIndexes).toEqual([0, 1, 2, 3]);
    expect(run?.metrics).toEqual({ position: 3, runLength: 4 });
    expect(codes(r)).not.toContain("KEY_POSITION_IMBALANCE");
    // run of 3 is fine
    expect(codes(lintQuestionSet(setOf([2, 2, 2, 0, 1, 3, 0, 1, 3, 0, 1, 2])))).not.toContain("KEY_POSITION_RUN");
  });

  it("SET_KEY_LENGTH_BIAS", () => {
    const biased = Array.from({ length: 8 }, (_, i) =>
      setItem(i, 2, { answerOptions: opts(["short", "tiny", "a much longer option here", "mini"]) }),
    );
    expect(codes(lintQuestionSet(biased))).toContain("SET_KEY_LENGTH_BIAS");
    expect(codes(lintQuestionSet(setOf(BALANCED)))).not.toContain("SET_KEY_LENGTH_BIAS");
  });

  it("DUPLICATE_STEM_EXACT and DUPLICATE_STEM_NORMALIZED", () => {
    const base = setOf(BALANCED);
    base[5] = { ...base[5], prompt: `${STEMS[0]} ` };
    const exact = lintQuestionSet(base);
    expect(exact.find((i) => i.code === "DUPLICATE_STEM_EXACT")?.itemIndexes).toEqual([0, 5]);
    const norm = setOf(BALANCED);
    norm[5] = { ...norm[5], prompt: `${STEMS[0].toUpperCase()}?` };
    const r = lintQuestionSet(norm);
    expect(r.find((i) => i.code === "DUPLICATE_STEM_NORMALIZED")?.itemIndexes).toEqual([0, 5]);
    expect(codes(r)).not.toContain("DUPLICATE_STEM_EXACT");
    expect(codes(lintQuestionSet(setOf(BALANCED)))).not.toContain("DUPLICATE_STEM_NORMALIZED");
  });

  it("DUPLICATE_STEM_NORMALIZED sees Hebrew niqqud differences", () => {
    const a = { ...setItem(0, 0), prompt: "מָהוּ הַתַּהֲלִיךְ" };
    const b = { ...setItem(1, 1), prompt: "מהו התהליך" };
    expect(codes(lintQuestionSet([a, b]))).toContain("DUPLICATE_STEM_NORMALIZED");
  });

  it("NEAR_DUPLICATE_STEM", () => {
    const base = setOf(BALANCED);
    base[0] = { ...base[0], prompt: "Which structure gives constant lookup time in practice today" };
    base[1] = { ...base[1], prompt: "Which structure gives constant lookup time in practice now" };
    const r = lintQuestionSet(base);
    expect(r.find((i) => i.code === "NEAR_DUPLICATE_STEM")?.itemIndexes).toEqual([0, 1]);
    expect(codes(lintQuestionSet(setOf(BALANCED)))).not.toContain("NEAR_DUPLICATE_STEM");
  });

  it("STEM_TEMPLATE_REPEATED", () => {
    const tpl = setOf(BALANCED).map((it, i) =>
      i < 4 ? { ...it, prompt: `What is the topic number ${["one", "two", "three", "four"][i]}` } : it,
    );
    const r = lintQuestionSet(tpl);
    expect(r.find((i) => i.code === "STEM_TEMPLATE_REPEATED")?.itemIndexes).toEqual([0, 1, 2, 3]);
    expect(codes(lintQuestionSet(setOf(BALANCED)))).not.toContain("STEM_TEMPLATE_REPEATED");
  });
});

describe("determinism, purity, totality", () => {
  it("same output twice and input not mutated", () => {
    const items = setOf([0, 0, 0, 0, 1, 2, 3, 0]).map((it) => JSON.parse(JSON.stringify(it)) as Item);
    items[0].explanation = null;
    const before = JSON.stringify(items);
    const a = lintQuestionBatch(items);
    const b = lintQuestionBatch(items);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(items)).toBe(before);
  });
  it("works on deeply frozen input", () => {
    const frozen = Object.freeze({
      ...EN_CLEAN,
      answerOptions: Object.freeze(EN_CLEAN.answerOptions.map((o) => Object.freeze({ ...o }))),
      correctOptionIds: Object.freeze([...EN_CLEAN.correctOptionIds]),
    });
    expect(lintQuestionItem(frozen)).toEqual([]);
  });
  it("never throws on garbage and returns arrays", () => {
    const garbage: unknown[] = [
      null, undefined, 5, "x", [], {}, true,
      { answerOptions: "no", correctOptionIds: 7, prompt: 3, questionType: {} },
      { answerOptions: [null, 3, "s", { id: null, content: {} }], correctOptionIds: [null, {}, 1] },
      { prompt: "p", answerOptions: [{ id: "A" }], correctOptionIds: ["A"], explanation: 12 },
    ];
    for (const g of garbage) {
      expect(() => lintQuestionItem(g)).not.toThrow();
      expect(Array.isArray(lintQuestionItem(g))).toBe(true);
    }
    expect(() => lintQuestionSet(garbage)).not.toThrow();
    expect(() => lintQuestionBatch(garbage)).not.toThrow();
    for (const g of garbage) {
      expect(() => lintQuestionSet(g)).not.toThrow();
      expect(() => lintQuestionBatch(g)).not.toThrow();
    }
    expect(codes(lintQuestionItem(null))).toContain("STEM_EMPTY");
  });
  it("issues are content-blind (numbers and ids only)", () => {
    const secret = "ZEBRAQUOKKA";
    const it = item({
      prompt: `${secret} is NOT always`,
      answerOptions: opts([`${secret} always`, `${secret} always`, `${secret}  x`, ` ${secret}`]),
    });
    const r = lintQuestionBatch([it]);
    expect(r.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toContain(secret);
    for (const i of r) for (const v of Object.values(i.metrics ?? {})) expect(typeof v).toBe("number");
  });
});

describe("severity separation and summary", () => {
  const ERRORS = [
    "STEM_EMPTY", "OPTIONS_TOO_FEW", "OPTION_EMPTY", "OPTION_ID_DUPLICATE", "OPTION_DUPLICATE_EXACT",
    "OPTION_DUPLICATE_NORMALIZED", "CORRECT_COUNT_INVALID", "CORRECT_ID_UNKNOWN",
  ];
  it("only structural codes are ERROR; ERRORs come before WARNINGs", () => {
    const r = lintQuestionItem({ questionType: "SINGLE_CHOICE", prompt: " ", answerOptions: [{ id: "A", content: "x" }], correctOptionIds: ["Q"], explanation: null });
    for (const i of r) expect(i.severity).toBe(ERRORS.includes(i.code) ? "ERROR" : "WARNING");
    const firstWarn = r.findIndex((i) => i.severity === "WARNING");
    expect(r.slice(firstWarn).every((i) => i.severity === "WARNING")).toBe(true);
    expect(r.every((i) => i.scope === "ITEM")).toBe(true);
  });
  it("set issues are WARNING with SET scope", () => {
    const r = lintQuestionSet(setOf([0, 0, 0, 0, 0, 0, 0, 0]));
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((i) => i.severity === "WARNING" && i.scope === "SET")).toBe(true);
  });
  it("summarizeLintIssues counts and flags errors", () => {
    const warnOnly = summarizeLintIssues(lintQuestionItem(item({ explanation: null })));
    expect(warnOnly).toMatchObject({ errorCount: 0, warningCount: 1, totalCount: 1, hasErrors: false });
    const withErr = summarizeLintIssues(lintQuestionItem(item({ prompt: "", explanation: null })));
    expect(withErr.hasErrors).toBe(true);
    expect(withErr.byCode).toEqual({ EXPLANATION_MISSING: 1, STEM_EMPTY: 1 });
  });
  it("lintQuestionBatch tags item issues with itemIndex then appends set issues", () => {
    const r = lintQuestionBatch([EN_CLEAN, item({ prompt: "" })]);
    expect(r[0]).toMatchObject({ code: "STEM_EMPTY", itemIndex: 1 });
    expect(r[r.length - 1].code).toBe("SET_TOO_SMALL");
  });
});

describe("normalization helpers", () => {
  it("comparison key folds niqqud, finals, quotes, dashes, digits, case, bidi", () => {
    expect(comparisonKey("שָׁלוֹם")).toBe(comparisonKey("שלום"));
    expect(comparisonKey("מלך")).toBe(comparisonKey("מלכ"));
    expect(comparisonKey("מנכ״ל")).toBe(comparisonKey('מנכ"ל'));
    expect(comparisonKey("a–b")).toBe(comparisonKey("a-b"));
    expect(comparisonKey("שנת ٢٠٢٥")).toBe("שנת 2025");
    expect(comparisonKey("HeLLo‏")).toBe("hello");
    expect(comparisonKey("a־b")).toBe("a-b"); // maqaf kept as hyphen, not stripped as niqqud
    expect(comparisonKey("v2 גרסה")).toContain("v2");
  });
  it("duplicate key strips terminal punctuation only", () => {
    expect(duplicateKey("Hello world?!")).toBe("hello world");
    expect(duplicateKey("מנכ\"ל")).toContain('"');
  });
  it("prefix stripping respects minimum remainder", () => {
    expect(stripHebrewPrefixes("התאית")).toBe("תאית");
    expect(stripHebrewPrefixes("שלא")).toBe("שלא");
    expect(stripHebrewPrefixes("hello")).toBe("hello");
  });
});

describe("hardening after review", () => {
  it("1. ReDoS: long punctuation / quote runs complete quickly", () => {
    for (const bad of ["!".repeat(40000) + "a", "a" + "'".repeat(40000) + "b", "-".repeat(40000) + "x" + "\"".repeat(40000)]) {
      const t0 = performance.now();
      lintQuestionItem(item({ prompt: bad, answerOptions: opts([bad, "other", "third", "fourth"]) }));
      expect(performance.now() - t0).toBeLessThan(1000);
    }
  });

  it("2. 200000 options: no throw, OPTIONS_TOO_MANY, bounded time; cap boundary", () => {
    const many = Array.from({ length: 200000 }, (_, i) => ({ id: `o${i}`, content: `option ${i}` }));
    const t0 = performance.now();
    const r = lintQuestionItem(item({ answerOptions: many, correctOptionIds: ["o1"] }));
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.find((i) => i.code === "OPTIONS_TOO_MANY")?.severity).toBe("ERROR");
    expect(() => lintQuestionBatch([item({ answerOptions: many })])).not.toThrow();
    const atCap = Array.from({ length: MAX_LINT_OPTIONS }, (_, i) => ({ id: `o${i}`, content: `option ${i}` }));
    expect(codes(lintQuestionItem(item({ answerOptions: atCap, correctOptionIds: ["o1"] })))).not.toContain("OPTIONS_TOO_MANY");
    const over = [...atCap, { id: "extra", content: "option extra" }];
    expect(lint({ answerOptions: over, correctOptionIds: ["o1"] })).toContain("OPTIONS_TOO_MANY");
  });

  it("3. totality: throwing getter, throwing Proxy, cyclic object", () => {
    const getter = {
      get prompt(): string {
        throw new Error("boom");
      },
    };
    const proxy = new Proxy({}, { get() { throw new Error("boom"); }, has() { throw new Error("boom"); } });
    const cyc: Record<string, unknown> = { questionType: "SINGLE_CHOICE", prompt: "Cyclic item prompt here ok?" };
    cyc.self = cyc;
    cyc.answerOptions = [cyc, cyc];
    cyc.correctOptionIds = [cyc];
    expect(codes(lintQuestionItem(getter))).toEqual(["INPUT_UNREADABLE"]);
    expect(codes(lintQuestionItem(proxy))).toEqual(["INPUT_UNREADABLE"]);
    expect(() => lintQuestionItem(cyc)).not.toThrow();
    const throwingElementList = new Proxy([EN_CLEAN, EN_CLEAN], {
      get(t, k, r) {
        if (k === "1") throw new Error("boom");
        return Reflect.get(t, k, r);
      },
    });
    const batch = lintQuestionBatch([EN_CLEAN, getter, proxy, EN_CLEAN]);
    const unreadable = batch.filter((i) => i.code === "INPUT_UNREADABLE").map((i) => i.itemIndex);
    expect(unreadable).toEqual([1, 2]);
    expect(() => lintQuestionSet([EN_CLEAN, getter, proxy])).not.toThrow();
    expect(() => lintQuestionBatch(throwingElementList)).not.toThrow();
    expect(lintQuestionBatch(throwingElementList).filter((i) => i.code === "INPUT_UNREADABLE").map((i) => i.itemIndex)).toEqual([1]);
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    expect(() => lintQuestionBatch(revoked.proxy)).not.toThrow();
    expect(() => lintQuestionSet(revoked.proxy)).not.toThrow();
    // unreadable elements are skipped by set checks (no stem duplicate between two unreadable items)
    const setIssues = lintQuestionSet([getter, getter, ...setOf(BALANCED)]);
    expect(codes(setIssues)).not.toContain("DUPLICATE_STEM_EXACT");
  });

  it("4. MULTIPLE_CHOICE with every option correct is CORRECT_COUNT_INVALID", () => {
    const mc = { questionType: "MULTIPLE_CHOICE" };
    expect(lint({ ...mc, answerOptions: opts(["One option", "Two option"]), correctOptionIds: ["A", "B"] })).toContain("CORRECT_COUNT_INVALID");
    expect(lint({ ...mc, correctOptionIds: ["A", "B"] })).not.toContain("CORRECT_COUNT_INVALID");
    expect(lint({ ...mc, correctOptionIds: ["A", "B", "C", "D"] })).toContain("CORRECT_COUNT_INVALID");
  });

  it("5. punctuation-only options and stems never become normalized duplicates", () => {
    expect(lint({ answerOptions: opts(["?", "!", "Binary heap", "Sorted array"]) })).not.toContain("OPTION_DUPLICATE_NORMALIZED");
    expect(lint({ answerOptions: opts(["?", "!", "Binary heap", "Sorted array"]) })).not.toContain("OPTION_EMPTY");
    const s = setOf(BALANCED);
    s[0] = { ...s[0], prompt: "?" };
    s[1] = { ...s[1], prompt: "!" };
    const c = codes(lintQuestionSet(s));
    expect(c).not.toContain("DUPLICATE_STEM_NORMALIZED");
    expect(c).not.toContain("NEAR_DUPLICATE_STEM");
  });

  it("6. SET_KEY_LENGTH_BIAS needs >= MIN_SET_SIZE eligible items", () => {
    const biased = (i: number): Item => setItem(i, 2, { answerOptions: opts(["short", "tiny", "a much longer option here", "mini"]) });
    const seven = Array.from({ length: 8 }, (_, i) => (i === 7 ? setItem(i, 2, { questionType: "MULTIPLE_CHOICE", correctOptionIds: ["A", "B"] }) : biased(i)));
    expect(codes(lintQuestionSet(seven))).not.toContain("SET_KEY_LENGTH_BIAS");
    const eight = Array.from({ length: 8 }, (_, i) => biased(i));
    expect(codes(lintQuestionSet(eight))).toContain("SET_KEY_LENGTH_BIAS");
  });

  it("7. optionIds are content-blind: unsafe ids become positional markers", () => {
    const hostile = "Secret answer text ".repeat(500);
    const r = lintQuestionItem(
      item({ answerOptions: [{ id: hostile, content: " " }, { id: "B", content: "x option" }, { id: "C", content: "y option" }, { id: "D", content: "z option" }], correctOptionIds: ["B"] }),
    );
    const e = r.find((i) => i.code === "OPTION_EMPTY");
    expect(e?.optionIds).toEqual(["#0"]);
    expect(e?.optionPositions).toEqual([0]);
    expect(JSON.stringify(r)).not.toContain("Secret");
    const ok = lintQuestionItem(item({ answerOptions: opts(["Hash table", " ", "Binary heap", "Sorted array"]) }));
    expect(ok.find((i) => i.code === "OPTION_EMPTY")?.optionPositions).toEqual([1]);
    const long = lintQuestionItem(item({ answerOptions: [{ id: "ABCDEFGHI", content: "" }, { id: "B", content: "x option" }] }));
    expect(long.find((i) => i.code === "OPTION_EMPTY")?.optionIds).toEqual(["#0"]);
  });

  it("8. zero-width / bidi / format-only text counts as empty", () => {
    const invisible = "​‏‪⁠﻿­";
    expect(lint({ prompt: invisible })).toContain("STEM_EMPTY");
    expect(lint({ answerOptions: opts(["Hash table", invisible, "Binary heap", "Sorted array"]) })).toContain("OPTION_EMPTY");
    const s = setOf(BALANCED);
    s[0] = { ...s[0], prompt: invisible };
    s[1] = { ...s[1], prompt: invisible + " " };
    expect(codes(lintQuestionSet(s))).not.toContain("DUPLICATE_STEM_EXACT");
  });
});
