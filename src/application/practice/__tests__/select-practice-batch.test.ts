/**
 * Unit tests for `interleaveByTopic` (UX-03-QA1 Finding 5) — the pure,
 * deterministic Topic-diversification helper `selectPracticeBatch` applies
 * ONLY within Tier 2 (unseen) and Tier 3 (broader coverage), never to Tier 1
 * (the shared NBA ranking Today also uses). These tests prove the exact
 * property the Run brief requires: "a lower-priority Question is not
 * promoted above a higher-priority Question merely for randomness" — here,
 * that a Topic's relative internal order is preserved and nothing is
 * dropped/duplicated, while cross-Topic clumping (raw import/creation order)
 * is broken up. Full-pipeline Tier 1 < Tier 2 < Tier 3 ordering is proven
 * separately by the real-Postgres integration test
 * (`supabase/tests/postgres/practice-topic-interleave.test.ts`), since Tier
 * boundaries are structural (Tier 2/3 only ever APPEND to an `ordered` array
 * Tier 1 already populated) and best proven end-to-end.
 */
import { describe, expect, it } from "vitest";

import { interleaveByTopic } from "../select-practice-batch";

interface Item {
  id: string;
  topicId: string | null;
}

describe("interleaveByTopic", () => {
  it("breaks up raw creation-order clumping by Topic (round-robin across Topics)", () => {
    // Exactly the reported shape: all of Topic A's Questions created first,
    // then all of Topic B's — the raw import-order bias Finding 5 reports.
    const items: Item[] = [
      { id: "a1", topicId: "A" },
      { id: "a2", topicId: "A" },
      { id: "a3", topicId: "A" },
      { id: "b1", topicId: "B" },
      { id: "b2", topicId: "B" },
      { id: "b3", topicId: "B" },
    ];

    const result = interleaveByTopic(items).map((i) => i.id);

    expect(result).toEqual(["a1", "b1", "a2", "b2", "a3", "b3"]);
  });

  it("preserves each Topic's own relative (already-sorted) order — only regroups ACROSS Topics", () => {
    const items: Item[] = [
      { id: "a1", topicId: "A" },
      { id: "a2", topicId: "A" },
      { id: "b1", topicId: "B" },
    ];

    const result = interleaveByTopic(items).map((i) => i.id);

    // a1 must still precede a2 (their relative Topic-A order is untouched).
    expect(result.indexOf("a1")).toBeLessThan(result.indexOf("a2"));
  });

  it("treats null topicId (Course Practice, no Topic) as its own single bucket", () => {
    const items: Item[] = [
      { id: "n1", topicId: null },
      { id: "n2", topicId: null },
      { id: "a1", topicId: "A" },
    ];

    const result = interleaveByTopic(items).map((i) => i.id);

    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set(["n1", "n2", "a1"]));
    expect(result.indexOf("n1")).toBeLessThan(result.indexOf("n2"));
  });

  it("never drops or duplicates an item, for an uneven Topic distribution", () => {
    const items: Item[] = [
      { id: "a1", topicId: "A" },
      { id: "a2", topicId: "A" },
      { id: "a3", topicId: "A" },
      { id: "a4", topicId: "A" },
      { id: "b1", topicId: "B" },
    ];

    const result = interleaveByTopic(items);

    expect(result).toHaveLength(items.length);
    expect(result.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
  });

  it("is a pure function: identical input always produces identical output (no randomness)", () => {
    const items: Item[] = [
      { id: "a1", topicId: "A" },
      { id: "b1", topicId: "B" },
      { id: "c1", topicId: "C" },
      { id: "a2", topicId: "A" },
    ];

    const first = interleaveByTopic(items).map((i) => i.id);
    const second = interleaveByTopic(items).map((i) => i.id);

    expect(first).toEqual(second);
  });

  it("empty input returns empty output", () => {
    expect(interleaveByTopic([])).toEqual([]);
  });
});
