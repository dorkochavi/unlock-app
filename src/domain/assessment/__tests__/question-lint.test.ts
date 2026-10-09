/**
 * Tests for the pure question linter prototype
 * (Run 2026-10-08-ASSESSMENT-ENGINE-NIGHT-001, Slice H). Hand-written fixtures only.
 */
import { describe, expect, it } from "vitest";

import {
  KEY_POSITION_RUN_LENGTH,
  MAX_LINT_BATCH_ITEMS,
  MAX_LINT_CORRECT_IDS,
  MAX_LINT_ID_CHARS,
  MAX_LINT_OPTIONS,
  MAX_LINT_TEXT_CHARS,
  MAX_NEAR_DUP_COMPARISONS,
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
    expect(lint({ prompt: "Hash tables" })).toContain("STEM_TOO_SHORT");
    expect(lint({ prompt: "Define hashing" })).not.toContain("STEM_TOO_SHORT"); // interrogative/imperative start exempt (FUB-066)
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
  it("OPTION_ABSOLUTE_TERM: strong term in a distractor; English, Hebrew, prefixed Hebrew, whole-word only", () => {
    expect(lint({ answerOptions: opts(["Hash table", "It always works", "Binary heap", "Sorted array"]) })).toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({ answerOptions: opts(["נשימה תאית", "תמיד נכון", "חלוקת תאים", "העברה פעילה"]) }, HE_CLEAN)).toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({ answerOptions: opts(["נשימה תאית", "ותמיד נכון", "חלוקת תאים", "העברה פעילה"]) }, HE_CLEAN)).toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({ answerOptions: opts(["נשימה תאית", "אף פעם לא", "חלוקת תאים", "העברה פעילה"]) }, HE_CLEAN)).toContain("OPTION_ABSOLUTE_TERM");
    // strong term in the key only: not flagged (FUB-066)
    expect(lint({ answerOptions: opts(["It always works", "Linked list", "Binary heap", "Sorted array"]) })).not.toContain("OPTION_ABSOLUTE_TERM");
    expect(lint({ answerOptions: opts(["Hash table", "Allocation", "Binary heap", "Sorted array"]) })).not.toContain("OPTION_ABSOLUTE_TERM");
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
  it("KEY_STEM_LEXICAL_OVERLAP is no longer emitted (FUB-066): former English and Hebrew positive shapes", () => {
    const en = item({
      prompt: "Which structure uses hashing to provide constant lookup time?",
      answerOptions: opts(["Hashing constant lookup", "Stack", "Queue", "Graph"]),
    });
    expect(codes(lintQuestionItem(en))).not.toContain("KEY_STEM_LEXICAL_OVERLAP");
    const he = item(
      {
        prompt: "מהי ההגדרה של התהליך הנשימה התאית בגוף?",
        answerOptions: opts(["נשימה תאית", "פוטוסינתזה", "חלוקה", "העברה"]),
      },
      HE_CLEAN,
    );
    expect(codes(lintQuestionItem(he))).not.toContain("KEY_STEM_LEXICAL_OVERLAP");
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
    "QUESTION_TYPE_UNSUPPORTED", "CORRECT_IDS_TOO_MANY",
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
  it("duplicate key folds bounded Latin/Cyrillic/Greek lookalikes only", () => {
    expect(duplicateKey("pаypal")).toBe(duplicateKey("paypal"));
    expect(duplicateKey("АPPLE")).toBe(duplicateKey("apple"));
    expect(duplicateKey("οpen")).toBe(duplicateKey("open"));
    expect(duplicateKey("мама")).not.toBe(duplicateKey("мала")); // distinct Russian words stay distinct
    expect(duplicateKey("שלום")).toBe("שלומ"); // Hebrew untouched
    expect(comparisonKey("pаypal")).not.toBe(comparisonKey("paypal")); // comparison key unchanged
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

describe("B4 hardening: Hebrew negation is whole-token", () => {
  const neg = (prompt: string): boolean => lint({ prompt }, HE_CLEAN).includes("STEM_NEGATIVE_WORDING");
  it("does not fire for words that merely end in or contain lamed-alef", () => {
    expect(neg("איזה כלי הוא מלא במים בתוך המעבדה?")).toBe(false); // מלא (full)
    expect(neg("איזו כוס מלאה במים בתוך המעבדה?")).toBe(false); // מלאה
    expect(neg("איזו מלאכה נדרשת בתוך המעבדה הזאת?")).toBe(false); // מלאכה
    expect(neg("איזה מבנה חשוב אלא שהוא נדיר בתוך הגוף?")).toBe(false); // אלא
    expect(neg("הלא זו הגדרה נכונה של התהליך בגוף?")).toBe(false); // הלא
    expect(neg("איזה חלק נמצא מחוץ לתא בגוף האדם?")).toBe(false); // מחוץ (prefix mem)
  });
  it("still fires for true negation tokens, incl. conjunction/relativizer prefixes", () => {
    for (const p of [
      "איזה מבנה לא נמצא בתא החי בגוף?",
      "איזה מבנה ולא נמצא בתא החי בגוף?",
      "בחרו מבנה שלא נמצא בתא החי בגוף",
      "איזה מבנה אינו נמצא בתא החי בגוף?",
      "איזו מערכת אינה קיימת בתא החי בגוף?",
      "איזה חלק בלתי נחוץ בתא החי בגוף?",
      "איזה מבנה אין לו תפקיד בתוך התא החי?",
      "כל המבנים מלבד אחד נמצאים בתא החי?",
      "איזה מבנה ללא ממברנה נמצא בתא החי?",
    ]) expect(neg(p)).toBe(true);
  });
  it("English negation terms are whole tokens (notable does not fire)", () => {
    expect(lint({ prompt: "Which notable structure provides constant lookup time?" })).not.toContain("STEM_NEGATIVE_WORDING");
    expect(lint({ prompt: "Which structure is not stored contiguously in memory?" })).toContain("STEM_NEGATIVE_WORDING");
  });
});

describe("B4 hardening: all/none-of-the-above use token boundaries", () => {
  const withLast = (last: string): string[] => lint({ answerOptions: opts(["Hash table", "Linked list", "Binary heap", last]) });
  const withLastHe = (last: string): string[] =>
    lint({ answerOptions: opts(["נשימה תאית", "פוטוסינתזה", "חלוקת תאים", last]) }, HE_CLEAN);

  it("English true positives", () => {
    expect(withLast("All of the above")).toContain("OPTION_ALL_OF_ABOVE");
    expect(withLast("all of the above.")).toContain("OPTION_ALL_OF_ABOVE");
    expect(withLast("Both are true, all of these")).toContain("OPTION_ALL_OF_ABOVE");
    expect(withLast("None of the above")).toContain("OPTION_NONE_OF_ABOVE");
    expect(withLast("None of these")).toContain("OPTION_NONE_OF_ABOVE");
  });
  it("English false-positive substrings do not match", () => {
    for (const t of ["Nonexistent of the above kind", "Overall of these", "Tall of these", "none of the aboves", "Nonexistent of the above", "Overall of the above"]) {
      const c = withLast(t);
      expect(c).not.toContain("OPTION_ALL_OF_ABOVE");
      expect(c).not.toContain("OPTION_NONE_OF_ABOVE");
    }
  });
  it("Hebrew true positives (incl. prefix on first token)", () => {
    for (const t of ["כל התשובות נכונות", "כולן נכונות", "כל האמור לעיל", 'כל הנ"ל', "וכל התשובות נכונות"]) {
      expect(withLastHe(t)).toContain("OPTION_ALL_OF_ABOVE");
    }
    for (const t of ["אף אחת מהתשובות", "אף תשובה", "אף אחד מהאמור", "אף אחת מהן", "אין תשובה נכונה", "אין אף תשובה"]) {
      expect(withLastHe(t)).toContain("OPTION_NONE_OF_ABOVE");
    }
  });
  it("Hebrew false-positive substrings do not match", () => {
    for (const t of ["כל התשובותיהם שונות", "אף תשובתי", "כולנו נכונות", "כולן", "אף תשובות", "דאף תשובה"]) {
      const c = withLastHe(t);
      expect(c).not.toContain("OPTION_NONE_OF_ABOVE");
      expect(c).not.toContain("OPTION_ALL_OF_ABOVE");
    }
  });
});

describe("B4 hardening: questionType contract (secondary linter, defensive totality)", () => {
  it("QUESTION_TYPE_UNSUPPORTED for unknown, missing, wrong-case and non-string types (content-blind)", () => {
    for (const t of ["TRUE_FALSE", "", "single_choice", "SINGLE_CHOICE ", undefined, null, 7, {}]) {
      const r = lintQuestionItem({ ...EN_CLEAN, questionType: t });
      const hit = r.find((i) => i.code === "QUESTION_TYPE_UNSUPPORTED");
      expect(hit).toMatchObject({ severity: "ERROR", scope: "ITEM" });
      expect(hit?.metrics).toBeUndefined();
    }
    expect(JSON.stringify(lintQuestionItem({ ...EN_CLEAN, questionType: "SECRETTYPE" }))).not.toContain("SECRETTYPE");
    expect(lint({})).not.toContain("QUESTION_TYPE_UNSUPPORTED");
    expect(lint({ questionType: "MULTIPLE_CHOICE", correctOptionIds: ["A", "B"] })).not.toContain("QUESTION_TYPE_UNSUPPORTED");
  });
  it("unsupported type still gets type-independent checks but no type-dependent ones", () => {
    const c = lint({
      questionType: "TRUE_FALSE",
      prompt: " ",
      correctOptionIds: ["A", "B", "Z"],
      answerOptions: opts(["Hash table", "Hash table", "x", "y"]),
    });
    expect(c).toContain("STEM_EMPTY");
    expect(c).toContain("OPTION_DUPLICATE_EXACT");
    expect(c).toContain("CORRECT_ID_UNKNOWN");
    expect(c).not.toContain("CORRECT_COUNT_INVALID");
    const keyed = lint({
      questionType: "TRUE_FALSE",
      answerOptions: opts(["A hash table, giving constant time lookup", "Linked list", "Binary heap", "Sorted array"]),
    });
    expect(keyed).toContain("QUESTION_TYPE_UNSUPPORTED");
    expect(keyed).not.toContain("KEY_LONGEST_OPTION"); // no key-based check for an unsupported type
  });
  it("unsupported-type items never feed set key analysis", () => {
    const s = Array.from({ length: 8 }, (_, i) => setItem(i, 0, { questionType: "TRUE_FALSE" }));
    const c = codes(lintQuestionSet(s));
    expect(c).not.toContain("KEY_POSITION_IMBALANCE");
    expect(c).not.toContain("KEY_POSITION_RUN");
  });
  it("defensive structural ERRORs are diagnostics, a clean result is not proof of validity", () => {
    expect(summarizeLintIssues(lintQuestionItem({ ...EN_CLEAN, correctOptionIds: ["Z"] })).hasErrors).toBe(true);
  });
});

describe("B4 hardening: correctOptionIds cap", () => {
  it("exactly MAX_LINT_CORRECT_IDS is analysed normally", () => {
    const ids = Array.from({ length: MAX_LINT_CORRECT_IDS }, (_, i) => `k${i}`);
    const atCap = lint({ questionType: "MULTIPLE_CHOICE", correctOptionIds: ids });
    expect(atCap).not.toContain("CORRECT_IDS_TOO_MANY");
    expect(atCap).toContain("CORRECT_ID_UNKNOWN");
  });
  it("more than the cap raises CORRECT_IDS_TOO_MANY with the true count and skips misleading checks", () => {
    const many = Array.from({ length: 200000 }, (_, i) => `k${i}`);
    const t0 = performance.now();
    const r = lintQuestionItem({ ...EN_CLEAN, correctOptionIds: many });
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.find((i) => i.code === "CORRECT_IDS_TOO_MANY")).toMatchObject({
      severity: "ERROR",
      scope: "ITEM",
      metrics: { correctIdCount: 200000, maximum: MAX_LINT_CORRECT_IDS },
    });
    expect(codes(r)).not.toContain("CORRECT_COUNT_INVALID");
    expect(codes(r)).not.toContain("CORRECT_ID_UNKNOWN");
    expect(lint({ correctOptionIds: Array.from({ length: MAX_LINT_CORRECT_IDS + 1 }, () => "A") })).toContain("CORRECT_IDS_TOO_MANY");
    const longKey = lint({
      answerOptions: opts(["A hash table, giving constant time lookup", "Linked list", "Binary heap", "Sorted array"]),
      correctOptionIds: Array.from({ length: MAX_LINT_CORRECT_IDS + 1 }, () => "A"),
    });
    expect(longKey).not.toContain("KEY_LONGEST_OPTION"); // no key resolved from a partial read
  });
});

describe("B4 hardening: text and id truncation is explicit", () => {
  it("long prompt / option / id each raise TEXT_TRUNCATED (content-blind, bounded)", () => {
    const longText = "word ".repeat(MAX_LINT_TEXT_CHARS);
    const t0 = performance.now();
    const r = lintQuestionItem(item({ prompt: longText, answerOptions: opts([longText, "Linked list", "Binary heap", "Sorted array"]) }));
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.find((i) => i.code === "TEXT_TRUNCATED")).toMatchObject({
      severity: "WARNING",
      scope: "ITEM",
      optionIds: ["A"],
      optionPositions: [0],
      metrics: { promptTruncated: 1, optionTruncatedCount: 1, idTruncatedCount: 0, maxTextChars: MAX_LINT_TEXT_CHARS },
    });
    const idHit = lintQuestionItem(
      item({ answerOptions: [{ id: "x".repeat(MAX_LINT_ID_CHARS + 1), content: "Hash table" }, { id: "B", content: "Linked list" }], correctOptionIds: ["B"] }),
    ).find((i) => i.code === "TEXT_TRUNCATED");
    expect(idHit?.metrics).toMatchObject({ promptTruncated: 0, optionTruncatedCount: 0, idTruncatedCount: 1 });
    expect(JSON.stringify(r)).not.toContain("word");
  });
  it("text exactly at the cap is not truncated; clean items never raise it", () => {
    expect(lint({ prompt: `Which ${"x".repeat(MAX_LINT_TEXT_CHARS - 6)}` })).not.toContain("TEXT_TRUNCATED");
    expect(lint({})).not.toContain("TEXT_TRUNCATED");
  });
  it("10 MB strings stay bounded and total", () => {
    const huge = "ab ".repeat(3_500_000);
    const t0 = performance.now();
    const r = lintQuestionBatch([item({ prompt: huge, answerOptions: opts([huge, huge, "x one", "y two"]), explanation: huge })]);
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(codes(r)).toContain("TEXT_TRUNCATED");
  });
});

describe("B4 hardening: set caps are explicit", () => {
  const distinctStems = (n: number): Item[] =>
    Array.from({ length: n }, (_, i) => setItem(i, i % 4, { prompt: `unique stem token${i} alpha${i} beta${i} gamma${i}` }));

  it("constants are bounded", () => {
    expect(MAX_NEAR_DUP_COMPARISONS).toBe(20000);
    expect(MAX_LINT_BATCH_ITEMS).toBe(2000);
  });
  it("near-duplicate scan within budget is complete: no SET_ANALYSIS_TRUNCATED", () => {
    expect(codes(lintQuestionSet(distinctStems(200)))).not.toContain("SET_ANALYSIS_TRUNCATED"); // 19900 pairs
    expect(codes(lintQuestionSet(setOf(BALANCED)))).not.toContain("SET_ANALYSIS_TRUNCATED");
  });
  it("near-duplicate scan over budget stops and says so (content-blind metrics)", () => {
    const t0 = performance.now();
    const r = lintQuestionSet(distinctStems(300)); // 44850 pairs > 20000
    expect(performance.now() - t0).toBeLessThan(3000);
    const hit = r.find((i) => i.code === "SET_ANALYSIS_TRUNCATED");
    expect(hit).toMatchObject({
      severity: "WARNING",
      scope: "SET",
      metrics: { eligibleItems: 300, pairsPlanned: 44850, pairsCompared: MAX_NEAR_DUP_COMPARISONS, maximumPairs: MAX_NEAR_DUP_COMPARISONS },
    });
    expect(JSON.stringify(hit)).not.toContain("unique");
  });
  it("near-duplicates inside the budget are still found when the scan is truncated", () => {
    const s = distinctStems(300);
    s[0] = { ...s[0], prompt: "Which structure gives constant lookup time in practice today" };
    s[1] = { ...s[1], prompt: "Which structure gives constant lookup time in practice now" };
    const r = lintQuestionSet(s);
    expect(r.find((i) => i.code === "NEAR_DUPLICATE_STEM")?.itemIndexes).toEqual([0, 1]);
    expect(codes(r)).toContain("SET_ANALYSIS_TRUNCATED");
  });
  it("more than MAX_LINT_BATCH_ITEMS: only the first are read, SET_ITEMS_TRUNCATED reports the true count", () => {
    const big = distinctStems(MAX_LINT_BATCH_ITEMS + 500);
    const t0 = performance.now();
    const r = lintQuestionBatch(big);
    expect(performance.now() - t0).toBeLessThan(15000);
    expect(r.find((i) => i.code === "SET_ITEMS_TRUNCATED")).toMatchObject({
      severity: "WARNING",
      scope: "SET",
      metrics: { itemCount: MAX_LINT_BATCH_ITEMS + 500, analyzedCount: MAX_LINT_BATCH_ITEMS, maximum: MAX_LINT_BATCH_ITEMS },
    });
    expect(Math.max(...r.map((i) => i.itemIndex ?? -1))).toBeLessThan(MAX_LINT_BATCH_ITEMS);
    expect(codes(r)).toContain("SET_ANALYSIS_TRUNCATED");
    expect(codes(lintQuestionSet(big))).toContain("SET_ITEMS_TRUNCATED");
  });
  it("exactly MAX_LINT_BATCH_ITEMS items is not item-truncated", () => {
    expect(codes(lintQuestionSet(distinctStems(MAX_LINT_BATCH_ITEMS)))).not.toContain("SET_ITEMS_TRUNCATED");
  });
  it("hostile arrays: sparse and huge-length arrays are bounded and total", () => {
    const t0 = performance.now();
    const r = lintQuestionSet(new Array(1_000_000));
    expect(performance.now() - t0).toBeLessThan(5000);
    expect(codes(r)).toContain("SET_ITEMS_TRUNCATED");
    expect(() => lintQuestionBatch(new Array(50000))).not.toThrow();
  });
});

describe("B4 hardening: OPTIONS_TOO_MANY remains the explicit marker for skipped option analysis", () => {
  it("reports the true count", () => {
    const many = Array.from({ length: MAX_LINT_OPTIONS + 1 }, (_, i) => ({ id: `o${i}`, content: `option ${i}` }));
    const r = lintQuestionItem(item({ answerOptions: many, correctOptionIds: ["o1"] }));
    expect(r.find((i) => i.code === "OPTIONS_TOO_MANY")?.metrics).toEqual({ optionCount: MAX_LINT_OPTIONS + 1, maximum: MAX_LINT_OPTIONS });
  });
});

describe("Slice B2: linter false-positive rule fixes (and counter-examples that must still fire)", () => {
  const abs = (first: string, base: Item = HE_CLEAN): boolean =>
    lint({ answerOptions: opts(["נשימה תאית", first, "חלוקת תאים", "העברה פעילה"]) }, base).includes("OPTION_ABSOLUTE_TERM");
  const neg = (prompt: string, base: Item = HE_CLEAN): boolean => lint({ prompt }, base).includes("STEM_NEGATIVE_WORDING");

  it("short Hebrew absolute terms no longer match root-initial prefix letters (מרק, ברק, שכל, משכל, כל-words)", () => {
    for (const w of ["מרק", "ברק", "שכל", "משכל", "הרק", "לרק"]) expect(abs(w)).toBe(false);
  });
  it("strong Hebrew absolute terms still fire in a distractor; weak-tier terms (רק, כל, בלבד) no longer do (FUB-066)", () => {
    for (const w of ["בהכרח", "לעולם", "אף פעם", "ואף פעם"]) expect(abs(w)).toBe(true);
    for (const w of ["רק", "ורק", "רק זה נכון", "כל", "וכל", "כל התאים", "וכל התאים", "בלבד"]) expect(abs(w)).toBe(false);
  });
  it("PINS: weak-tier terms (ב/ל/מ/כ + כל, ורק, וכל) never fire (FUB-066 weak tier leaves deterministic ownership)", () => {
    // Weak-tier terms (כל/רק/בלבד and prefixed forms) are routed to HUMAN_REVIEW / AI_OPTIONAL (FUB-066), so a prefixed
    // 'לכל התאים' is intentionally not emitted deterministically. If the tiering is revisited, update deliberately.
    for (const w of ["בכל התאים", "לכל התאים", "מכל התאים", "ככל התאים", "בכל", "לכל", "מכל", "ככל"]) expect(abs(w)).toBe(false);
    for (const w of ["ורק", "וכל", "וכל התאים", "ורק זה נכון"]) expect(abs(w)).toBe(false);
  });
  it("3+ letter strong Hebrew absolute terms keep prefix tolerance (תמיד, ותמיד, שתמיד); ובלבד is weak tier", () => {
    for (const w of ["תמיד", "ותמיד", "שתמיד", "לעולם", "ולעולם", "שבהכרח"]) expect(abs(w)).toBe(true);
    expect(abs("ובלבד")).toBe(false);
  });
  it("English strong absolute terms still fire in a distractor; weak-tier \"only\" does not", () => {
    for (const w of ["always", "never"]) {
      expect(lint({ answerOptions: opts(["Hash table", `It is ${w} true`, "Binary heap", "Sorted array"]) })).toContain("OPTION_ABSOLUTE_TERM");
    }
    expect(lint({ answerOptions: opts(["Hash table", "It is only true", "Binary heap", "Sorted array"]) })).not.toContain("OPTION_ABSOLUTE_TERM");
  });

  it("Hebrew 'חוץ' is negative only as the exception 'חוץ מ…'", () => {
    expect(neg("איזה גוף מנהל את הקשרים בנושא מדיניות חוץ של המדינה?")).toBe(false); // noun
    expect(neg("איזה גוף נמצא במשרד החוץ של המדינה הזאת?")).toBe(false);
    expect(neg("איזה חלק נמצא מחוץ לתא בגוף האדם?")).toBe(false);
    expect(neg("איזה חלק נמצא בחוץ בגוף האדם הזה?")).toBe(false);
    expect(neg("כל המבנים נמצאים בתא חוץ מאחד מהם?")).toBe(true);
    expect(neg("כל המבנים נמצאים בתא וחוץ מאחד מהם?")).toBe(true);
    expect(neg("כל המבנים נמצאים בתא חוץ מ-X אחד?")).toBe(true);
    expect(neg("כל המבנים נמצאים בתא שחוץ מהמעבדה אין?")).toBe(true);
  });
  it("English 'least' is not negative in 'at least' / 'at the least', but 'the LEAST likely' fires", () => {
    const en = (prompt: string): boolean => lint({ prompt }).includes("STEM_NEGATIVE_WORDING");
    expect(en("A polygon needs at least how many straight sides?")).toBe(false);
    expect(en("A polygon needs at the least how many straight sides?")).toBe(false);
    expect(en("Which structure is the LEAST likely to be stored contiguously?")).toBe(true);
    expect(en("Which of these is least likely to be stored contiguously?")).toBe(true);
    expect(en("It needs at least two sides, but which is the least likely shape?")).toBe(true);
  });
  it("true negation cues still fire (Hebrew and English)", () => {
    for (const p of [
      "איזה מבנה לא נמצא בתא החי בגוף?", "איזה מבנה ולא נמצא בתא החי בגוף?", "בחרו מבנה שלא נמצא בתא החי בגוף",
      "בחרו מבנה ושלא נמצא בתא החי בגוף", "איזה מבנה אינו נמצא בתא החי בגוף?", "איזה מבנה שאינו נמצא בתא החי בגוף?",
      "איזה מבנה אין לו תפקיד בתוך התא החי?", "איזה חלק בלתי נחוץ בתא החי בגוף?", "איזה מבנה ללא ממברנה נמצא בתא החי?",
      "איזה מבנה בלא ממברנה נמצא בתא החי?", "כל המבנים מלבד אחד נמצאים בתא החי?", "כל המבנים ומלבד אחד נמצאים בתא החי?",
      "כל המבנים שמלבד אחד נמצאים בתא החי?",
    ]) expect(neg(p)).toBe(true);
    expect(lint({ prompt: "Which structure is not stored contiguously in memory?" })).toContain("STEM_NEGATIVE_WORDING");
    expect(lint({ prompt: "All of these are stored contiguously EXCEPT which one?" })).toContain("STEM_NEGATIVE_WORDING");
    expect(lint({ prompt: "Which structure is never stored contiguously in memory?" })).toContain("STEM_NEGATIVE_WORDING");
  });
  it("silent guards stay silent (מלא, מלאה, מלאכה, אלא, הלא, מחוץ)", () => {
    for (const p of [
      "איזה כלי הוא מלא במים בתוך המעבדה?", "איזו כוס מלאה במים בתוך המעבדה?", "איזו מלאכה נדרשת בתוך המעבדה הזאת?",
      "איזה מבנה חשוב אלא שהוא נדיר בתוך הגוף?", "הלא זו הגדרה נכונה של התהליך בגוף?", "איזה חלק נמצא מחוץ לתא בגוף האדם?",
    ]) expect(neg(p)).toBe(false);
  });
});
