/**
 * Held-out v0.4 (FRESH_HELD_OUT_V0_4) freeze-integrity tests (Run 2026-10-09-ASSESSMENT-ENGINE-009, V04_FREEZE_HEAD).
 *
 * Deliberately does NOT import the linter or the evaluation harness: it proves only that the frozen artifacts are
 * unchanged and internally coherent. Evaluation results live in heldout-v0-4-eval.test.ts (added after the freeze).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const DIR = "../golden/heldout-v0-4/";
const readRaw = (name: string): string => readFileSync(fileURLToPath(new URL(DIR + name, import.meta.url)), "utf8");
const sha256Lf = (s: string): string => createHash("sha256").update(s.replace(/\r\n/g, "\n"), "utf8").digest("hex");

interface Item {
  questionType: string;
  prompt: string;
  answerOptions: { id: string; content: string }[];
  correctOptionIds: string[];
}
interface Case {
  caseId: string;
  scope: "ITEM" | "SET";
  item?: Item;
  set?: Item[];
}
interface Label {
  caseId: string;
  scope: string;
  label: string;
  expectedCodes?: string[];
  expectedSetCodes?: string[];
  itemCodes?: Record<string, string[]>;
  semanticExpectation: string | null;
}

const corpus = JSON.parse(readRaw("corpus.json")) as { cases: Case[] };
const labels = JSON.parse(readRaw("labels.json")) as { labels: Label[] };
const HEBREW = /[֐-׿]/;

describe("held-out v0.4 freeze invariant", () => {
  const rec = JSON.parse(readRaw("freeze-hashes.json")) as {
    version: string;
    evidenceIdentity: string;
    cases: number;
    items: number;
    sets: number;
    counts: Record<string, number>;
    sha256: Record<string, string>;
  };

  it("matches the sha256 record of the frozen files (LF-normalized)", () => {
    expect(rec.version).toBe("v0.4-heldout");
    expect(rec.evidenceIdentity).toBe("FRESH_HELD_OUT_V0_4");
    expect(Object.keys(rec.sha256).sort()).toEqual(["author-intent.json", "corpus.json", "label-review.json", "labels.json"]);
    for (const [name, hash] of Object.entries(rec.sha256)) expect(sha256Lf(readRaw(name)), name).toBe(hash);
    expect(rec.cases).toBe(corpus.cases.length);
  });

  it("matches the recorded corpus composition counts", () => {
    const items = corpus.cases.filter((c) => c.scope === "ITEM");
    const hebrew = items.filter((c) => HEBREW.test(JSON.stringify(c))).length;
    expect(rec.items).toBe(items.length);
    expect(rec.sets).toBe(corpus.cases.length - items.length);
    expect(rec.counts.hebrew).toBe(hebrew);
    expect(rec.counts.english).toBe(items.length - hebrew);
    expect(rec.counts.singleChoiceItems).toBe(items.filter((c) => c.item?.questionType === "SINGLE_CHOICE").length);
    expect(rec.counts.multipleChoiceItems).toBe(items.filter((c) => c.item?.questionType === "MULTIPLE_CHOICE").length);
    expect(rec.counts.clean).toBe(labels.labels.filter((l) => l.label === "CLEAN").length);
    expect(rec.counts.flawed).toBe(labels.labels.filter((l) => l.label === "FLAWED").length);
  });
});

describe("held-out v0.4 ids / labels coherence", () => {
  it("labels every case exactly once with matching scope", () => {
    const ids = corpus.cases.map((c) => c.caseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(labels.labels.map((l) => l.caseId)).toEqual(ids);
    for (const l of labels.labels) expect(l.scope, l.caseId).toBe(corpus.cases.find((c) => c.caseId === l.caseId)?.scope);
  });

  it("has well-formed items (key ids exist; SINGLE_CHOICE has one key, MULTIPLE_CHOICE at least two)", () => {
    for (const c of corpus.cases) {
      for (const it of c.item ? [c.item] : (c.set ?? [])) {
        const ids = it.answerOptions.map((o) => o.id);
        for (const k of it.correctOptionIds) expect(ids, c.caseId).toContain(k);
        if (it.questionType === "SINGLE_CHOICE") expect(it.correctOptionIds.length, c.caseId).toBe(1);
        else expect(it.correctOptionIds.length, c.caseId).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("keeps CLEAN labels free of expected codes and semantic expectations", () => {
    for (const l of labels.labels) {
      if (l.label !== "CLEAN") continue;
      expect([...(l.expectedCodes ?? []), ...(l.expectedSetCodes ?? []), ...Object.values(l.itemCodes ?? {}).flat()], l.caseId).toEqual([]);
      expect(l.semanticExpectation, l.caseId).toBeNull();
    }
  });
});
