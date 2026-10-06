/**
 * Framework-free controller for the Practice "next batch" background load
 * (Run PERFORMANCE-RUN-001 Slice E).
 *
 * WHY it may only start after the LAST answer is persisted: next-batch
 * selection excludes every Question answered in the learning-day session
 * (server-side `listQuestionIdsAnsweredInSession`) plus the client's skip
 * hints. A batch requested before the final Attempt is saved could repeat the
 * just-answered Question or ignore the latest evidence. The caller therefore
 * starts this ONLY once every item in the current batch is answered (answer
 * ACCEPTED) or skipped, and keys the entry by (current batch + skip hints) so
 * a changed hint set can never reuse a stale selection.
 *
 * The load is a read-only GET: no Attempt, no answer request, no scheduler or
 * Today mutation. Entries are single-use, expire after `maxAgeMs` (a learner
 * lingering past the local-day boundary must not get a stale selection), and
 * only a pending or fresh READY entry is ever reused: a failed/non-READY
 * prefetch is discarded so the learner's tap performs a fresh request (retry).
 */
import type { FetchPracticeBatchOutcome } from "./practice-api";

export type BatchLoader = (signal: AbortSignal) => Promise<FetchPracticeBatchOutcome>;

/** Longer than a reading pause, far shorter than a day. */
export const PREFETCH_MAX_AGE_MS = 5 * 60 * 1000;

interface Entry {
  key: string;
  startedAt: number;
  controller: AbortController;
  promise: Promise<FetchPracticeBatchOutcome>;
  outcome: FetchPracticeBatchOutcome | null;
}

/**
 * Pure trigger rule: true only when no item of the current batch can still
 * produce an Attempt — the last item's answer was ACCEPTED (feedback stage,
 * Attempt persisted) or the batch is complete — and there may be more.
 * Never true while any question awaits an answer or while an answer is in flight.
 */
export function shouldPrefetchNextBatch(run: {
  hasMore: boolean;
  stage: "question" | "feedback" | "batchComplete" | "noMore";
  index: number;
  items: { length: number };
}): boolean {
  if (!run.hasMore) return false;
  if (run.stage === "batchComplete") return true;
  return run.stage === "feedback" && run.index === run.items.length - 1;
}

export class NextBatchPrefetcher {
  private entry: Entry | null = null;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxAgeMs: number = PREFETCH_MAX_AGE_MS,
  ) {}

  /** Begin a background load for `key` unless a reusable one already exists. */
  start(key: string, load: BatchLoader): void {
    this.ensure(key, load);
  }

  /**
   * The learner asked for the next batch: reuse the pending/fresh READY entry
   * for `key`, otherwise start a fresh request. Single-use.
   */
  consume(key: string, load: BatchLoader): Promise<FetchPracticeBatchOutcome> {
    const entry = this.ensure(key, load);
    return entry.promise.then((outcome) => {
      if (this.entry === entry) this.entry = null;
      return outcome;
    });
  }

  /** Abort and drop any in-flight/held batch (unmount, new batch applied). */
  cancel(): void {
    this.entry?.controller.abort();
    this.entry = null;
  }

  private ensure(key: string, load: BatchLoader): Entry {
    const existing = this.entry;
    if (existing !== null && existing.key === key && this.isReusable(existing)) return existing;
    existing?.controller.abort();
    const controller = new AbortController();
    const entry: Entry = {
      key,
      startedAt: this.now(),
      controller,
      outcome: null,
      promise: Promise.resolve({ outcome: "ERROR" } as FetchPracticeBatchOutcome),
    };
    entry.promise = load(controller.signal).then(
      (outcome) => {
        entry.outcome = outcome;
        return outcome;
      },
      () => {
        entry.outcome = { outcome: "ERROR" };
        return entry.outcome;
      },
    );
    this.entry = entry;
    return entry;
  }

  private isReusable(entry: Entry): boolean {
    if (this.now() - entry.startedAt > this.maxAgeMs) return false;
    return entry.outcome === null || entry.outcome.outcome === "READY";
  }
}
