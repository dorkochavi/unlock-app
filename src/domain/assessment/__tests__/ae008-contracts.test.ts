/**
 * AE-008 Slice B: pre-registered contract tests for the approved designs (scratch/ae008-design.md).
 * Written BEFORE the implementation. A1 (FUB-077), A2 (FUB-075 safe part), A3 (FUB-076 narrow subtraction).
 * A4 (FUB-075 whole-utterance classification: `במה`, `שמי הלילה`, `List of birds`, `Name tags`) is DEFERRED:
 * deliberately NO tests here; those residual gaps stay unchanged and are not asserted either way.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GOLDEN_DATASET_V0_1 } from "../golden/golden-dataset-v0-1";
import { lintQuestionItem } from "../question-lint";

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

const HE_CLEAN: Item = {
  questionType: "SINGLE_CHOICE",
  prompt: "מהו התהליך שבו תאים מפרקים גלוקוז לשם הפקת אנרגיה?",
  answerOptions: opts(["נשימה תאית", "פוטוסינתזה", "חלוקת תאים", "העברה פעילה"]),
  correctOptionIds: ["A"],
  explanation: "בנשימה תאית מופקת אנרגיה מגלוקוז.",
};
function stemCodes(prompt: string, base: Item = HE_CLEAN): string[] {
  return lintQuestionItem({ ...base, prompt }).map((i) => i.code);
}
function optionCodes(lastOption: string): string[] {
  return lintQuestionItem({
    ...HE_CLEAN,
    answerOptions: opts(["נשימה תאית", "פוטוסינתזה", "חלוקת תאים", lastOption]),
  }).map((i) => i.code);
}

// ---- corpus loaders (read-only) ----
const HERE = __dirname;
type CorpusCase = { caseId: string; item: Item };
function loadCorpus(dir: string): CorpusCase[] {
  const raw = readFileSync(join(HERE, "..", "golden", dir, "corpus.json"), "utf8");
  return (JSON.parse(raw) as { cases: CorpusCase[] }).cases;
}
const V02 = loadCorpus("heldout-v0-2");
const V03 = loadCorpus("heldout-v0-3");
function corpusItem(cases: CorpusCase[], id: string): Item {
  const c = cases.find((x) => x.caseId === id);
  if (!c) throw new Error(`missing case ${id}`);
  return c.item;
}
function goldenInput(id: string): Item {
  const c = GOLDEN_DATASET_V0_1.cases.find((x) => x.id === id);
  if (!c || c.scope !== "ITEM") throw new Error(`missing golden item ${id}`);
  return c.input as Item;
}
function itemCodes(it: Item): string[] {
  return lintQuestionItem(it).map((i) => i.code);
}

describe("A1 FUB-077: OPTION_ALL_OF_ABOVE for `כל האפשרויות הנ\"ל`", () => {
  const positives = [
    'כל האפשרויות הנ"ל',
    "כל האפשרויות הנ״ל",
    "כל האפשרויות הנ”ל",
    "כל האפשרויות הנ“ל",
    "כל האפשרויות הנל",
    'כל האפשרויות הנ"ל.',
    'וכל האפשרויות הנ"ל',
    'כל האפשרויות הנ"ל נכונות',
  ];
  for (const p of positives) {
    it(`emits for ${JSON.stringify(p)}`, () => {
      expect(optionCodes(p)).toContain("OPTION_ALL_OF_ABOVE");
    });
  }
  it("HO3-071 option emits (human-approved EXPECTED)", () => {
    expect(itemCodes(corpusItem(V03, "HO3-071"))).toContain("OPTION_ALL_OF_ABOVE");
  });

  const negatives = [
    "כל האפשרויות",
    'האפשרויות הנ"ל',
    "כל האפשרויות השונות",
    "כל האפשרויות במשוואה הן נכונות",
    "all options are valid in this case",
    'הנתון הנ"ל גבוה',
  ];
  for (const n of negatives) {
    it(`silent for ${JSON.stringify(n)}`, () => {
      expect(optionCodes(n)).not.toContain("OPTION_ALL_OF_ABOVE");
    });
  }
  for (const e of ["כל התשובות", 'כל הנ"ל']) {
    it(`existing phrase still caught: ${JSON.stringify(e)}`, () => {
      expect(optionCodes(e)).toContain("OPTION_ALL_OF_ABOVE");
    });
  }
});

describe("A2 FUB-075 safe part: מהם/מהן lead words", () => {
  // Deferred residual (FUB-075, A4): `במה`, `שמי הלילה`, `List of birds`, `Name tags` are NOT asserted here.
  for (const s of ["מהם גזי חממה?", "מהן הפלנטות?", "ומהם גזי חממה?"]) {
    it(`no STEM_TOO_SHORT for ${JSON.stringify(s)}`, () => {
      expect(stemCodes(s)).not.toContain("STEM_TOO_SHORT");
    });
  }
  it("HO3-071 stem is exempt (human-approved FORBIDDEN)", () => {
    expect(itemCodes(corpusItem(V03, "HO3-071"))).not.toContain("STEM_TOO_SHORT");
  });
  for (const s of ["מה צבע?", "מהו שורש 81?", "ומהו שורש 81?"]) {
    it(`retained exemption for ${JSON.stringify(s)}`, () => {
      expect(stemCodes(s)).not.toContain("STEM_TOO_SHORT");
    });
  }
  it("HO3-037 `ומהו שורש 81?` stays exempt", () => {
    expect(itemCodes(corpusItem(V03, "HO3-037"))).not.toContain("STEM_TOO_SHORT");
  });
  for (const s of ["מהמם גדול", "מהנה מאוד", "מהות החיים", "מהירות האור", "מהלך הזמן"]) {
    it(`lookalike still flagged: ${JSON.stringify(s)}`, () => {
      expect(stemCodes(s)).toContain("STEM_TOO_SHORT");
    });
  }
});

describe("A3 FUB-076: STEM_NEGATIVE_WORDING narrow subtraction", () => {
  const SEL = "STEM_NEGATIVE_WORDING";
  describe("must become silent", () => {
    it("HO3-005 (relative שלא, no selection cue; human FORBIDDEN)", () => {
      expect(itemCodes(corpusItem(V03, "HO3-005"))).not.toContain(SEL);
    });
    it("HO3-058 (contrast ולא לכלי; human FORBIDDEN)", () => {
      expect(itemCodes(corpusItem(V03, "HO3-058"))).not.toContain(SEL);
    });
    it("relative שלא without selection cue", () => {
      expect(stemCodes("מה קורה לגוף במנוחה שלא פועל עליו שום כוח?")).not.toContain(SEL);
    });
    it("relative ושלא without selection cue", () => {
      expect(stemCodes("מה קורה לגוף במנוחה ושלא פועל עליו שום כוח?")).not.toContain(SEL);
    });
    it("contrast `ולא לכלי`-style", () => {
      expect(stemCodes("אילו מהבאים נחשבים לכלי נגינה, ולא לכלי כתיבה?")).not.toContain(SEL);
    });
    it("contrast `ולא לתרכובת`-style", () => {
      expect(stemCodes("איזה חומר נחשב ליסוד, ולא לתרכובת?")).not.toContain(SEL);
    });
  });

  describe("must still emit", () => {
    for (const s of [
      "Which statement is NOT correct?",
      "Which of the following does NOT belong to the group?",
      "מה אינו נכון?",
      "איזה מהבאים אינו יסוד כימי?",
      "איזו מהטענות אינה נכונה לגבי תאים?",
      "בחרו את החומרים שלא מתמוססים במים?",
      "איזה מבנה ולא נמצא בתא החי?",
    ]) {
      it(`emits for ${JSON.stringify(s)}`, () => {
        expect(stemCodes(s)).toContain(SEL);
      });
    }
    for (const id of ["WEAK-NEGATION-HE-01", "WEAK-NEGATION-HE-PREFIX-01", "WEAK-NEGATION-EN-01"]) {
      it(`golden v0.1 ${id} still emits`, () => {
        expect(itemCodes(goldenInput(id))).toContain(SEL);
      });
    }
    for (const id of ["HO-018", "HO-021", "HO-022", "HO-048", "HO-054"]) {
      it(`held-out v0.2 ${id} still emits`, () => {
        expect(itemCodes(corpusItem(V02, id))).toContain(SEL);
      });
    }
    it("held-out v0.3 HO3-072 still emits", () => {
      expect(itemCodes(corpusItem(V03, "HO3-072"))).toContain(SEL);
    });
  });
});
