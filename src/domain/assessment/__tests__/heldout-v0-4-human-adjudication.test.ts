import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  applyHumanAdjudication,
  compareFrozenAndPostHuman,
  type HeldOutCorpus,
  type HeldOutLabels,
  type HumanAdjudicationOverlay,
} from "../golden/heldout-eval";

const DIR = "../golden/heldout-v0-4/";

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(DIR + name, import.meta.url)), "utf8");

const corpus = JSON.parse(read("corpus.json")) as HeldOutCorpus;
const labels = JSON.parse(read("labels.json")) as HeldOutLabels;
const overlay = JSON.parse(read("human-adjudication.json")) as HumanAdjudicationOverlay;

const REVIEWED = [
  "HO4-062",
  "HO4-015",
  "HO4-063",
  "HO4-007",
  "HO4-008",
  "HO4-052",
  "HO4-042",
  "HO4-003",
  "HO4-041",
  "HO4-004",
  "HO4-040",
  "HO4-013",
  "HO4-018",
  "HO4-016",
  "HO4-057",
  "HO4-075",
  "HO4-073",
] as const;

const frozenSnapshot = JSON.stringify(labels);
const post = applyHumanAdjudication(labels, overlay, REVIEWED);
const cmp = compareFrozenAndPostHuman(corpus, labels, overlay, REVIEWED);

const postLabel = (id: string) => {
  const x = post.labels.find((l) => l.caseId === id);
  if (!x) throw new Error(`missing post-human label ${id}`);
  return x;
};

describe("HUMAN_ADJUDICATED_V0_4", () => {
  it("records post-evaluation human provenance and exactly 17 top-level decisions", () => {
    expect(overlay.version).toBe("v0.4-human-adjudication-1");
    expect(overlay.reviewer).toBe("Dor");
    expect(overlay.reviewDate).toBe("2026-10-09");
    expect(overlay.provenance).toBe("HUMAN_APPROVED_POST_EVALUATION");
    expect(overlay.evaluationStatus).toContain("POST_EVALUATION");
    expect(overlay.evaluationStatus).toContain("NOT BLIND");
    expect(overlay.decisions.map((d) => d.caseId).sort()).toEqual([...REVIEWED].sort());
  });

  it("does not mutate frozen v0.4 labels", () => {
    expect(JSON.stringify(labels)).toBe(frozenSnapshot);
  });

  it("encodes the five Hebrew negation false positives as forbidden", () => {
    for (const id of ["HO4-062", "HO4-015", "HO4-063", "HO4-007", "HO4-008"]) {
      expect(postLabel(id).label, id).toBe("CLEAN");
      expect(postLabel(id).forbiddenCodes ?? [], id).toContain("STEM_NEGATIVE_WORDING");
    }
  });

  it("keeps HO4-052 as a genuine negative-selection flaw", () => {
    const x = postLabel("HO4-052");
    expect(x.label).toBe("FLAWED");
    expect(x.expectedCodes ?? []).toContain("STEM_NEGATIVE_WORDING");
  });

  it("treats complete imperative stems as CLEAN", () => {
    for (const id of ["HO4-042", "HO4-004", "HO4-040"]) {
      const x = postLabel(id);
      expect(x.label, id).toBe("CLEAN");
      expect(x.expectedCodes ?? [], id).not.toContain("STEM_NO_QUESTION_FORM");
    }
  });

  it("keeps noun-phrase fragments FLAWED", () => {
    expect(postLabel("HO4-003").label).toBe("FLAWED");
    expect(postLabel("HO4-041").label).toBe("FLAWED");
  });

  it("keeps weak-tier absolutes contextual in HO4-013", () => {
    expect(postLabel("HO4-013").label).toBe("CLEAN");
    expect(postLabel("HO4-013").expectedCodes ?? []).toEqual([]);
  });

  it("preserves the approved deterministic findings on HO4-018", () => {
    const x = postLabel("HO4-018");
    expect(x.label).toBe("FLAWED");
    expect(x.expectedCodes ?? []).toContain("OPTION_ABSOLUTE_TERM");
    expect(x.expectedCodes ?? []).toContain("KEY_LONGEST_OPTION");
  });

  it("keeps semantic stem-key leakage cases FLAWED without restoring lexical-overlap ownership", () => {
    for (const id of ["HO4-016", "HO4-057"]) {
      const x = postLabel(id);
      expect(x.label, id).toBe("FLAWED");
      expect(x.expectedCodes ?? [], id).not.toContain("KEY_STEM_LEXICAL_OVERLAP");
      expect(x.semanticExpectation, id).not.toBeNull();
    }
  });

  it("encodes HO4-075 set-level and nested item-7 decisions", () => {
    const x = postLabel("HO4-075");

    expect(x.label).toBe("FLAWED");

    expect(x.expectedSetCodes ?? []).toContain("KEY_POSITION_IMBALANCE");
    expect(x.expectedSetCodes ?? []).toContain("KEY_POSITION_RUN");
    expect(x.expectedSetCodes ?? []).not.toContain("QUESTION_TYPE_MONO");

    expect(x.forbiddenSetCodes ?? []).toContain("SET_KEY_LENGTH_BIAS");
    expect(x.forbiddenSetCodes ?? []).toContain("QUESTION_TYPE_MONO");

    expect(x.forbiddenItemCodes?.["7"] ?? []).toContain("OPTION_OVERLAP_HIGH");
  });

  it("makes HO4-073 CLEAN and QUESTION_TYPE_MONO informational only", () => {
    const x = postLabel("HO4-073");
    expect(x.label).toBe("CLEAN");
    expect(x.expectedSetCodes ?? []).not.toContain("QUESTION_TYPE_MONO");
  });

  it("produces deterministic HUMAN_ADJUDICATED_V0_4 metrics", () => {
    const again = compareFrozenAndPostHuman(corpus, labels, overlay, REVIEWED);
    expect(JSON.stringify(again)).toBe(JSON.stringify(cmp));

    console.log("");
    console.log("=== HUMAN_ADJUDICATED_V0_4 ===");
    console.log("CASE_COUNTS", JSON.stringify(cmp.postHuman.caseCounts));
    console.log("TOTALS", JSON.stringify(cmp.postHuman.totals));
    console.log("DELTA", JSON.stringify(cmp.delta.totals));

    console.log(
      "FALSE_POSITIVES",
      JSON.stringify(
        cmp.postHuman.falsePositives.map(
          (x) => `${x.ref}|${x.code}|${x.basis ?? ""}`,
        ),
      ),
    );

    console.log(
      "FALSE_NEGATIVES",
      JSON.stringify(
        cmp.postHuman.falseNegatives.map(
          (x) => `${x.ref}|${x.code}|${x.kind ?? ""}`,
        ),
      ),
    );

    console.log(
      "UNLABELED",
      JSON.stringify(
        cmp.postHuman.unlabeledEmissions.map(
          (x) => `${x.ref}|${x.code}`,
        ),
      ),
    );

    console.log(
      "NEGATION_RULE",
      JSON.stringify(
        cmp.postHuman.checks.find(
          (x) => x.code === "STEM_NEGATIVE_WORDING",
        ),
      ),
    );

    console.log(
      "SHORT_RULE",
      JSON.stringify(
        cmp.postHuman.checks.find(
          (x) => x.code === "STEM_TOO_SHORT",
        ),
      ),
    );

    console.log(
      "SET_LENGTH_BIAS",
      JSON.stringify(
        cmp.postHuman.checks.find(
          (x) => x.code === "SET_KEY_LENGTH_BIAS",
        ),
      ),
    );
  });
});
