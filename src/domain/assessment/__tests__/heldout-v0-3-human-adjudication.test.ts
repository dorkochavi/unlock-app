/**
 * v0.3 human adjudication overlay + HUMAN_ADJUDICATED_V0_3 evaluation
 * (Run 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001, Slice H1).
 *
 * Reviewer Dor, 2026-10-09, provenance HUMAN_APPROVED_POST_EVALUATION: decisions were made AFTER seeing the question, options,
 * key, frozen model label and frozen linter emissions. POST-EVALUATION, NOT BLIND. The frozen v0.3 files stay untouched; the
 * overlay is applied in code. The linter is FROZEN and was not changed. The EXPECTED_* constants are FIRST OBSERVED values
 * recorded as a regression guard: results, not targets. Nothing here may be used to tune the linter, thresholds or cue lists.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { IMPLEMENTED_ITEM_CODES } from "../golden/calibration";
import {
  KNOWN_NOT_IMPLEMENTED_CODES,
  applyHumanAdjudication,
  compareFrozenAndPostHuman,
  runHeldOutEvaluation,
  type HeldOutCorpus,
  type HeldOutLabel,
  type HeldOutLabels,
  type HumanAdjudicationOverlay,
} from "../golden/heldout-eval";

const DIR = "../golden/heldout-v0-3/";
const readRaw = (name: string): string => readFileSync(fileURLToPath(new URL(DIR + name, import.meta.url)), "utf8");
const sha256Lf = (s: string): string => createHash("sha256").update(s.replace(/\r\n/g, "\n"), "utf8").digest("hex");

const corpus = JSON.parse(readRaw("corpus.json")) as HeldOutCorpus;
const labels = JSON.parse(readRaw("labels.json")) as HeldOutLabels;
const overlay = JSON.parse(readRaw("human-adjudication.json")) as HumanAdjudicationOverlay;

const QUEUED = ["HO3-005", "HO3-058", "HO3-048", "HO3-071", "HO3-042", "HO3-040", "HO3-038", "HO3-044", "HO3-025", "HO3-028", "HO3-021", "HO3-004", "HO3-033"];
const HUMAN = "HUMAN_APPROVED_POST_EVALUATION";
const MODEL = "MODEL_LABELED_NOT_HUMAN_APPROVED";

const frozenSnapshot = JSON.stringify(labels);
const post = applyHumanAdjudication(labels, overlay, QUEUED);
const cmp = compareFrozenAndPostHuman(corpus, labels, overlay, QUEUED);
const postLabel = (id: string): HeldOutLabel => {
  const l = post.labels.find((x) => x.caseId === id);
  if (!l) throw new Error(`no label ${id}`);
  return l;
};
const frozenLabel = (id: string): HeldOutLabel => labels.labels.find((x) => x.caseId === id) as HeldOutLabel;
const decision = (id: string) => overlay.decisions.find((d) => d.caseId === id)!;
const semanticOf = (id: string): string => {
  const sd = decision(id).semanticDecision;
  if (sd === null || sd === undefined) throw new Error(`no semanticDecision for ${id}`);
  return typeof sd === "string" ? sd : sd.decision;
};
const sub = (l: HeldOutLabels) =>
  runHeldOutEvaluation(
    { cases: corpus.cases.filter((c) => QUEUED.includes(c.caseId)) },
    { labels: l.labels.filter((x) => QUEUED.includes(x.caseId)) },
  );

describe("v0.3 freeze invariant (overlay lives outside the frozen files)", () => {
  it("the 4 hashed frozen v0.3 files still match freeze-hashes.json", () => {
    const fh = JSON.parse(readRaw("freeze-hashes.json")) as { sha256: Record<string, string> };
    expect(Object.keys(fh.sha256).sort()).toEqual(["author-intent.json", "corpus.json", "label-review.json", "labels.json"]);
    for (const [name, hash] of Object.entries(fh.sha256)) expect(sha256Lf(readRaw(name)), name).toBe(hash);
  });
  it("applying the overlay does not mutate the frozen labels and returns new objects", () => {
    expect(JSON.stringify(labels)).toBe(frozenSnapshot);
    for (const id of QUEUED) expect(postLabel(id)).not.toBe(frozenLabel(id));
    expect(post.labels.find((l) => l.caseId === "HO3-001")).toBe(frozenLabel("HO3-001"));
  });
});

describe("v0.3 human adjudication overlay structure", () => {
  it("has reviewer / date / provenance / POST_EVALUATION status", () => {
    expect(overlay.version).toBe("v0.3-human-adjudication-1");
    expect(overlay.reviewer).toBe("Dor");
    expect(overlay.reviewDate).toBe("2026-10-09");
    expect(overlay.provenance).toBe(HUMAN);
    expect(overlay.evaluationStatus).toContain("POST_EVALUATION");
    expect(overlay.evaluationStatus).toContain("NOT BLIND");
  });
  it("covers exactly the 13 queued ids, once each", () => {
    expect(overlay.decisions.map((d) => d.caseId).sort()).toEqual([...QUEUED].sort());
  });
  it("only the 13 are HUMAN_APPROVED; every other case stays MODEL_LABELED_NOT_HUMAN_APPROVED", () => {
    for (const l of labels.labels) expect(post.provenanceById[l.caseId], l.caseId).toBe(QUEUED.includes(l.caseId) ? HUMAN : MODEL);
    expect(Object.values(post.provenanceById).filter((p) => p === HUMAN)).toHaveLength(13);
    expect(Object.keys(post.provenanceById)).toHaveLength(72);
  });
  it("every decision has reasoning and a rule, and every named code exists in the vocabulary", () => {
    const vocab = new Set<string>([...IMPLEMENTED_ITEM_CODES, ...KNOWN_NOT_IMPLEMENTED_CODES]);
    for (const d of overlay.decisions) {
      expect(d.humanReasoning.length, d.caseId).toBeGreaterThan(10);
      expect(d.humanRule.length, d.caseId).toBeGreaterThan(10);
      for (const c of [...(d.patch.addExpectedCodes ?? []), ...(d.patch.addForbiddenCodes ?? [])]) expect(vocab.has(c), `${d.caseId} ${c}`).toBe(true);
    }
  });
  it("labels outside the 13 are byte-identical to the frozen labels", () => {
    for (const l of labels.labels) if (!QUEUED.includes(l.caseId)) expect(JSON.stringify(postLabel(l.caseId))).toBe(JSON.stringify(l));
  });
});

describe("Dor's 13 decisions encoded on the post-human label", () => {
  const expectedOf = (id: string) => postLabel(id).expectedCodes ?? [];
  const forbiddenOf = (id: string) => postLabel(id).forbiddenCodes ?? [];

  it("HO3-005: final CLEAN, STEM_NEGATIVE_WORDING FORBIDDEN (relative/content negation is not a negative stem)", () => {
    expect(postLabel("HO3-005").label).toBe("CLEAN");
    expect(forbiddenOf("HO3-005")).toContain("STEM_NEGATIVE_WORDING");
    expect(expectedOf("HO3-005")).toEqual([]);
  });
  it("HO3-058: final CLEAN, STEM_NEGATIVE_WORDING FORBIDDEN, semantic cue concern REJECTED / NOT_A_FLAW", () => {
    const l = postLabel("HO3-058");
    expect(frozenLabel("HO3-058").label).toBe("FLAWED");
    expect(l.label).toBe("CLEAN");
    expect(l.expectedCodes ?? []).toEqual([]);
    expect(l.semanticExpectation).toBeNull();
    expect(forbiddenOf("HO3-058")).toContain("STEM_NEGATIVE_WORDING");
    expect(semanticOf("HO3-058")).toBe("REJECTED / NOT_A_FLAW");
  });
  it("HO3-048: stays FLAWED, STEM_TOO_SHORT and KEY_LONGEST_OPTION both EXPECTED", () => {
    expect(postLabel("HO3-048").label).toBe("FLAWED");
    expect(frozenLabel("HO3-048").expectedCodes).toEqual(["STEM_TOO_SHORT"]);
    expect(expectedOf("HO3-048")).toEqual(["STEM_TOO_SHORT", "KEY_LONGEST_OPTION"]);
  });
  it("HO3-071: stays FLAWED, OPTION_ALL_OF_ABOVE EXPECTED, STEM_TOO_SHORT FORBIDDEN; interrogative family is a design note only", () => {
    expect(postLabel("HO3-071").label).toBe("FLAWED");
    expect(expectedOf("HO3-071")).toEqual(["OPTION_ALL_OF_ABOVE"]);
    expect(forbiddenOf("HO3-071")).toContain("STEM_TOO_SHORT");
    expect(decision("HO3-071").designNote).toContain("NOT implemented");
    expect(decision("HO3-071").humanRule).toContain("same broad interrogative family");
  });
  it.each(["HO3-042", "HO3-040", "HO3-038", "HO3-044"])("%s: stays FLAWED, STEM_TOO_SHORT EXPECTED, no forbidden additions", (id) => {
    expect(postLabel(id).label).toBe("FLAWED");
    expect(expectedOf(id)).toEqual(["STEM_TOO_SHORT"]);
    expect(forbiddenOf(id)).toEqual(frozenLabel(id).forbiddenCodes ?? []);
    expect(JSON.stringify(postLabel(id))).toBe(JSON.stringify(frozenLabel(id)));
  });
  it.each(["HO3-025", "HO3-028"])("%s: final CLEAN, semantic concern REJECTED / NOT_A_FLAW, no deterministic expectation", (id) => {
    const l = postLabel(id);
    expect(frozenLabel(id).label).toBe("FLAWED");
    expect(l.label).toBe("CLEAN");
    expect(l.expectedCodes ?? []).toEqual([]);
    expect(l.semanticExpectation).toBeNull();
    expect(semanticOf(id)).toBe("REJECTED / NOT_A_FLAW");
  });
  it("HO3-021: stays FLAWED, KEY_LONGEST_OPTION EXPECTED, semantic stem-key echo APPROVED / REAL_DEFECT, no KEY_STEM_LEXICAL_OVERLAP", () => {
    const l = postLabel("HO3-021");
    expect(l.label).toBe("FLAWED");
    expect(l.expectedCodes).toEqual(["KEY_LONGEST_OPTION"]);
    expect(l.semanticExpectation).not.toBeNull();
    expect(semanticOf("HO3-021")).toBe("APPROVED / REAL_DEFECT");
    expect(l.expectedCodes).not.toContain("KEY_STEM_LEXICAL_OVERLAP");
    expect(decision("HO3-021").humanNotes).toContain("Does NOT authorize");
  });
  it("HO3-004: stays FLAWED, OPTION_ABSOLUTE_TERM EXPECTED, BORDERLINE_ACCEPTED_TP human note", () => {
    expect(postLabel("HO3-004").label).toBe("FLAWED");
    expect(expectedOf("HO3-004")).toEqual(["OPTION_ABSOLUTE_TERM"]);
    expect(decision("HO3-004").humanNotes).toBe("BORDERLINE_ACCEPTED_TP");
  });
  it("HO3-033: stays FLAWED, NO OPTION_ABSOLUTE_TERM expectation, contextual semantic concern kept", () => {
    const l = postLabel("HO3-033");
    expect(l.label).toBe("FLAWED");
    expect(l.expectedCodes ?? []).toEqual([]);
    expect(l.semanticExpectation).not.toBeNull();
    expect((decision("HO3-033") as unknown as { deterministicDecision: unknown }).deterministicDecision).toEqual({
      OPTION_ABSOLUTE_TERM: "NONE (no deterministic expectation)",
    });
    expect(semanticOf("HO3-033")).toContain("APPROVED / REAL_DEFECT");
  });
  it("final CLEAN / FLAWED split among the 13 is 4 CLEAN (005, 058, 025, 028) / 9 FLAWED", () => {
    const clean = QUEUED.filter((id) => postLabel(id).label === "CLEAN").sort();
    expect(clean).toEqual(["HO3-005", "HO3-025", "HO3-028", "HO3-058"]);
    expect(QUEUED.filter((id) => postLabel(id).label === "FLAWED")).toHaveLength(9);
  });
});

describe("FRESH_HELD_OUT_V0_3 first-observed totals are unchanged (frozen labels)", () => {
  it("TP 28 / FN 9 [5 impl, 4 not impl] / FP 1 / UNLABELED 3 / clean warned 1 of 38", () => {
    const r = cmp.currentLinterOnFrozen;
    expect(r.totals).toMatchObject({
      expectedDetections: 37,
      truePositive: 28,
      falseNegative: 9,
      falseNegativeHeuristicGap: 5,
      falseNegativeNotImplemented: 4,
      falsePositive: 1,
      unlabeledEmissions: 3,
      cleanCases: 38,
      cleanCasesWithWarningOrError: 1,
    });
    expect(runHeldOutEvaluation(corpus, labels).totals).toEqual(r.totals);
  });
});

describe("HUMAN_ADJUDICATED_V0_3 evaluation (first observed values, recorded not tuned; POST_EVALUATION, NOT BLIND)", () => {
  it("whole-corpus POST_HUMAN totals", () => {
    expect(cmp.postHuman.totals).toEqual({
      expectedDetections: 38,
      truePositive: 29,
      falseNegative: 9,
      falseNegativeHeuristicGap: 5,
      falseNegativeNotImplemented: 4,
      falsePositive: 3,
      cleanCases: 41,
      cleanCasesWithWarningOrError: 2,
      unlabeledEmissions: 0,
    });
    expect(cmp.postHuman.caseCounts).toMatchObject({ total: 72, item: 70, set: 2, clean: 41, flawed: 31 });
  });
  it("delta vs FRESH_HELD_OUT_V0_3", () => {
    expect(cmp.delta.totals).toEqual({
      expectedDetections: 1,
      truePositive: 1,
      falseNegative: 0,
      falseNegativeHeuristicGap: 0,
      falseNegativeNotImplemented: 0,
      falsePositive: 2,
      cleanCases: 3,
      cleanCasesWithWarningOrError: 1,
      unlabeledEmissions: -3,
    });
  });
  it("reviewed-13 subset metrics (frozen labels vs post-human labels on the same 13 cases)", () => {
    expect(sub(labels).totals).toMatchObject({
      expectedDetections: 8,
      truePositive: 3,
      falseNegative: 5,
      falsePositive: 1,
      cleanCases: 1,
      cleanCasesWithWarningOrError: 1,
      unlabeledEmissions: 3,
    });
    const r = sub(post);
    expect(r.caseCounts.total).toBe(13);
    expect(r.caseCounts).toMatchObject({ clean: 4, flawed: 9 });
    expect(r.totals).toEqual({
      expectedDetections: 9,
      truePositive: 4,
      falseNegative: 5,
      falseNegativeHeuristicGap: 5,
      falseNegativeNotImplemented: 0,
      falsePositive: 3,
      cleanCases: 4,
      cleanCasesWithWarningOrError: 2,
      unlabeledEmissions: 0,
    });
  });
  it("FN / FP / UNLABELED finding lists", () => {
    const key = (f: { ref: string; code: string }) => `${f.ref}|${f.code}`;
    expect(cmp.postHuman.falseNegatives.map(key)).toEqual(cmp.currentLinterOnFrozen.falseNegatives.map(key));
    expect(cmp.postHuman.falsePositives.map((f) => `${key(f)}|${f.basis}`)).toEqual([
      "HO3-005|STEM_NEGATIVE_WORDING|FORBIDDEN",
      "HO3-058|STEM_NEGATIVE_WORDING|FORBIDDEN",
      "HO3-071|STEM_TOO_SHORT|FORBIDDEN",
    ]);
    expect(cmp.postHuman.unlabeledEmissions).toEqual([]);
  });
  it("per-rule rows (expected, TP, FN, FP, unlabeled): frozen vs post-human", () => {
    const t = (r: typeof cmp.postHuman, code: string) => {
      const c = r.checks.find((x) => x.code === code);
      return c ? [c.expected, c.tp, c.fn, c.fp, c.unlabeled] : "NO_ROW";
    };
    const pair = (code: string) => [t(cmp.currentLinterOnFrozen, code), t(cmp.postHuman, code)];
    // KEY_STEM_LEXICAL_OVERLAP is neither expected nor emitted anywhere: no row, before or after.
    expect(pair("KEY_STEM_LEXICAL_OVERLAP")).toEqual(["NO_ROW", "NO_ROW"]);
    expect(pair("OPTION_ABSOLUTE_TERM")).toEqual([[10, 10, 0, 0, 0], [10, 10, 0, 0, 0]]);
    expect(pair("STEM_TOO_SHORT")).toEqual([[9, 5, 4, 0, 1], [9, 5, 4, 1, 0]]);
    expect(pair("STEM_NEGATIVE_WORDING")).toEqual([[1, 1, 0, 1, 1], [1, 1, 0, 2, 0]]);
    expect(pair("OPTION_ALL_OF_ABOVE")).toEqual([[1, 0, 1, 0, 0], [1, 0, 1, 0, 0]]);
    expect(pair("KEY_LONGEST_OPTION")).toEqual([[5, 5, 0, 0, 1], [6, 6, 0, 0, 0]]);
  });
  it("per-case delta vs frozen (which findings changed class)", () => {
    const rows = Object.fromEntries(cmp.reviewedCases.map((r) => [r.caseId, r]));
    expect(rows["HO3-058"].removed).toEqual(["UNL HO3-058 STEM_NEGATIVE_WORDING"]);
    expect(rows["HO3-058"].added).toEqual(["FP HO3-058 STEM_NEGATIVE_WORDING"]);
    expect(rows["HO3-048"].removed).toEqual(["UNL HO3-048 KEY_LONGEST_OPTION"]);
    expect(rows["HO3-048"].post).toEqual({ tp: 2, fn: 0, fp: 0, unlabeled: 0 });
    expect(rows["HO3-071"].removed).toEqual(["UNL HO3-071 STEM_TOO_SHORT"]);
    expect(rows["HO3-071"].added).toEqual(["FP HO3-071 STEM_TOO_SHORT"]);
    const unchanged = ["HO3-005", "HO3-042", "HO3-040", "HO3-038", "HO3-044", "HO3-025", "HO3-028", "HO3-021", "HO3-004", "HO3-033"];
    for (const id of unchanged) {
      expect(rows[id].removed, id).toEqual([]);
      expect(rows[id].added, id).toEqual([]);
      expect(rows[id].post, id).toEqual(rows[id].first);
    }
    expect(rows["HO3-025"].labelEffect).toBe("HUMAN_DECIDED_LABEL_CHANGE");
    expect(rows["HO3-028"].labelEffect).toBe("HUMAN_DECIDED_LABEL_CHANGE");
    expect(cmp.trueRemainingAmbiguity).toBe(0);
  });
  it("is deterministic", () => {
    const again = compareFrozenAndPostHuman(corpus, labels, overlay, QUEUED);
    expect(JSON.stringify(again)).toBe(JSON.stringify(cmp));
  });
});

describe("overlay validation is generic (no v0.3-specific bypass)", () => {
  it("the default allow-list still rejects v0.3 ids", () => {
    expect(() => applyHumanAdjudication(labels, overlay)).toThrow(/not one of the 9 reviewed case ids/);
  });
  it("rejects an id outside the supplied allow-list and a stale before snapshot", () => {
    expect(() => applyHumanAdjudication(labels, overlay, QUEUED.slice(1))).toThrow(/not one of the 9 reviewed case ids/);
    const bad: HumanAdjudicationOverlay = {
      ...overlay,
      decisions: [{ ...overlay.decisions[0], before: { label: "FLAWED" } }],
    };
    expect(() => applyHumanAdjudication(labels, bad, QUEUED)).toThrow(/does not match the frozen label/);
  });
});
