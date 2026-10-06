/**
 * Slice E evidence: next-batch continuity. Environment is node (no jsdom
 * harness in this repo), so the behavior lives in a framework-free controller
 * + pure trigger rule and is proven here; page glue is typechecked/linted.
 */
import { describe, expect, it, vi } from "vitest";

import {
  NextBatchPrefetcher,
  PREFETCH_MAX_AGE_MS,
  shouldPrefetchNextBatch,
} from "../next-batch-prefetch";
import type { FetchPracticeBatchOutcome } from "../practice-api";

const ready = (title: string): FetchPracticeBatchOutcome => ({
  outcome: "READY",
  batch: { scope: { kind: "COURSE", title }, items: [], hasMore: false },
});

function deferred() {
  let resolve!: (v: FetchPracticeBatchOutcome) => void;
  const promise = new Promise<FetchPracticeBatchOutcome>((r) => (resolve = r));
  return { promise, resolve };
}

describe("shouldPrefetchNextBatch (no request before the last answer is persisted)", () => {
  const items = { length: 3 };
  it("never fires while a question awaits an answer (incl. the last one)", () => {
    expect(shouldPrefetchNextBatch({ hasMore: true, stage: "question", index: 0, items })).toBe(false);
    expect(shouldPrefetchNextBatch({ hasMore: true, stage: "question", index: 2, items })).toBe(false);
  });
  it("never fires on feedback of a NON-last item", () => {
    expect(shouldPrefetchNextBatch({ hasMore: true, stage: "feedback", index: 1, items })).toBe(false);
  });
  it("fires on feedback of the last item (its answer POST was ACCEPTED) and at batchComplete", () => {
    expect(shouldPrefetchNextBatch({ hasMore: true, stage: "feedback", index: 2, items })).toBe(true);
    expect(shouldPrefetchNextBatch({ hasMore: true, stage: "batchComplete", index: 3, items })).toBe(true);
  });
  it("never fires when there is no more content or the run is empty/noMore", () => {
    expect(shouldPrefetchNextBatch({ hasMore: false, stage: "batchComplete", index: 3, items })).toBe(false);
    expect(
      shouldPrefetchNextBatch({ hasMore: true, stage: "noMore", index: 0, items: { length: 0 } }),
    ).toBe(false);
  });
});

describe("NextBatchPrefetcher", () => {
  it("start performs only the injected batch load (no answer/attempt request) and consume reuses it", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const load = vi.fn(async () => ready("a"));
    const p = new NextBatchPrefetcher();
    p.start("k", load);
    p.start("k", load); // idempotent
    expect(load).toHaveBeenCalledTimes(1);
    expect(await p.consume("k", load)).toEqual(ready("a"));
    expect(load).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("consume while pending awaits the same request (double-click safe)", async () => {
    const d = deferred();
    const load = vi.fn(() => d.promise);
    const p = new NextBatchPrefetcher();
    const a = p.consume("k", load);
    const b = p.consume("k", load);
    expect(load).toHaveBeenCalledTimes(1);
    d.resolve(ready("x"));
    expect(await a).toEqual(ready("x"));
    expect(await b).toEqual(ready("x"));
  });

  it("entries are single-use: a second consume issues a fresh request", async () => {
    const load = vi.fn(async () => ready("a"));
    const p = new NextBatchPrefetcher();
    await p.consume("k", load);
    await p.consume("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a failed prefetch is discarded: the learner's tap re-requests (retry), never serves the error", async () => {
    const load = vi
      .fn<(s: AbortSignal) => Promise<FetchPracticeBatchOutcome>>()
      .mockResolvedValueOnce({ outcome: "ERROR" })
      .mockResolvedValueOnce(ready("ok"));
    const p = new NextBatchPrefetcher();
    p.start("k", load);
    await Promise.resolve();
    await Promise.resolve();
    expect(await p.consume("k", load)).toEqual(ready("ok"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a rejecting loader maps to ERROR (never throws)", async () => {
    const p = new NextBatchPrefetcher();
    expect(await p.consume("k", () => Promise.reject(new Error("boom")))).toEqual({
      outcome: "ERROR",
    });
  });

  it("a different key (changed batch/skip hints) never reuses a held selection; old request is aborted", async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn(async (s: AbortSignal) => {
      signals.push(s);
      return ready("k" + signals.length);
    });
    const p = new NextBatchPrefetcher();
    p.start("old", load);
    expect(await p.consume("new", load)).toEqual(ready("k2"));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("an expired entry is not reused (stale selection across a long pause)", async () => {
    let t = 0;
    const load = vi.fn(async () => ready("x"));
    const p = new NextBatchPrefetcher(() => t);
    p.start("k", load);
    t = PREFETCH_MAX_AGE_MS + 1;
    await p.consume("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("cancel (unmount) aborts the in-flight request and drops the entry", () => {
    let signal!: AbortSignal;
    const load = vi.fn((s: AbortSignal) => {
      signal = s;
      return deferred().promise;
    });
    const p = new NextBatchPrefetcher();
    p.start("k", load);
    p.cancel();
    expect(signal.aborted).toBe(true);
    p.start("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
