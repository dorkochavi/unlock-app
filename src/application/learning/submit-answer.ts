/**
 * submitAnswer — the application-layer use case for "a learner answers one
 * Question," implementing ADR-010's transaction sequence, ADR-012's
 * current-logic rebuild semantics, and full synchronous out-of-order
 * reconciliation.
 *
 * This file orchestrates domain code (`applyAttemptToProgress`,
 * `rebuildUserQuestionProgress`) and persistence ports (ports.ts) — it
 * contains NO learning policy of its own. Every threshold/formula decision
 * still lives in `src/domain/learning/`.
 *
 * `SubmitAnswerCommand` is deliberately `Omit<Attempt, ...>` rather than a
 * hand-written duplicate of `Attempt`'s fields, and the omitted fields are
 * exactly ADR-010's "server-generated metadata" + "derived fields"
 * categories:
 * - `id` — generated here (`context.generateId()`), not client-supplied;
 * - `isCorrect` — computed via `AnswerCorrectnessChecker`, not client-supplied;
 * - `suspiciousTiming` — computed via `context.determineSuspiciousTiming`,
 *   verified server/application-derived, not client-supplied (ADR-010);
 * - `engineVersion` — stamped from `context.engineVersion`, environment
 *   metadata, not client-supplied.
 *
 * ## `learningSessionId` ownership (pre-commit correctness audit)
 *
 * `learningSessionId` directly controls `deriveIsSameLearningSession`, and
 * therefore whether a retrieval is treated as same-session vs longitudinal
 * spaced evidence — an arbitrary client value here is not a cosmetic
 * identity field, it can change Learning Engine evidence interpretation.
 * An audit found that this file previously trusted `command
 * .learningSessionId` unconditionally, which meant a buggy/malicious
 * client could claim a NEW `learningSessionId` on every Today answer and
 * force every retrieval to qualify as spaced. Fixed by splitting ownership
 * by origin, via `resolveLearningSessionId` below:
 *
 * - **DailyPlan-attached Attempts** (`dailyPlanItemId !== null`): the
 *   application derives `learningSessionId` from the persisted
 *   `DailyPlanItem.dailyPlanId` — the one continuous session concept that
 *   already exists for Today (ADR-016: one DailyPlan per learner per local
 *   day). No new Session subsystem is introduced. The client's `command
 *   .learningSessionId` is IGNORED for these Attempts — not merely
 *   validated — the same treatment already given to other
 *   server-derived fields (`isCorrect`, `engineVersion`). Consequently it
 *   is also EXCLUDED from the canonical command-identity comparison for
 *   these Attempts (see `findConflictingFields`): comparing a value the
 *   client does not actually own would only produce false idempotency
 *   conflicts.
 * - **Manual practice** (`dailyPlanItemId === null`): no persisted
 *   session concept exists for manual practice in V1, and inventing one
 *   is out of scope here. The client supplies and owns a stable token for
 *   this case, the same trust boundary V1 already extends to every other
 *   client-supplied evidence field on `SubmitAnswerCommand` (for example
 *   `answeredAt`, `confidenceLevel`) that the server does not
 *   independently re-derive. It remains part of the canonical
 *   command-identity comparison, so a retry claiming a different
 *   `learningSessionId` is still rejected as a conflict.
 *
 * `SubmitAnswerContext` deliberately OMITS `ProgressUpdateContext
 * .isSameLearningSession` — this file computes it fresh, per Attempt, via
 * `deriveIsSameLearningSession(command.learningSessionId,
 * previousProgress?.retrievalBaselineLearningSessionId ?? null)`, the same
 * pure derivation `rebuildUserQuestionProgress` uses. A caller of
 * `submitAnswer` can no longer inject an arbitrary override for it, which
 * is exactly the point: the old design let the caller supply a
 * relationally-scoped boolean that could not survive reordering; the new
 * design derives it from two stable, persisted identities every time.
 *
 * ## Out-of-order Attempts: synchronous reconciliation (ADR-012)
 *
 * The prior draft ("Option C") preserved the Attempt but left
 * `UserQuestionProgress` permanently stale for it, returning a distinct
 * `ACCEPTED_BUT_OUT_OF_ORDER` result. That was accepted only because true
 * rebuild was blocked by `isSameLearningSession` not being reconstructable
 * — now fixed (see `learning-session.ts`, `types.ts`'s
 * `Attempt.learningSessionId`/`UserQuestionProgress
 * .retrievalBaselineLearningSessionId`). With that gap closed, permanently
 * stale progress is no longer acceptable, and this file no longer produces
 * it: an out-of-order Attempt is reconciled SYNCHRONOUSLY, in the same
 * transaction, via a full canonical-order replay of every Attempt for the
 * pair (including the new one) — see `rebuildUserQuestionProgress`
 * (rebuild.ts). The result is a plain `ACCEPTED`, with
 * `wasReconciledViaRebuild: true` for observability only.
 *
 * Complexity/performance: this is an O(n) full replay of every historical
 * Attempt for one `(userId, questionId)` pair, not an O(1) incremental
 * update — deliberately, not by oversight. This is judged acceptable for
 * V1 because (a) out-of-order arrival is the RARE path (normal in-order
 * submissions — the overwhelming majority — still take the O(1)
 * incremental path below, untouched); (b) `n` is bounded by one learner's
 * attempt history on one Question, which for a spaced-repetition workload
 * is expected to stay small (tens, not thousands); and (c) correctness of
 * a rare recovery path matters far more than its speed. This is stated
 * explicitly, not assumed — if V1 data volume assumptions change, this is
 * the place to revisit.
 *
 * ## Retry short-circuit
 *
 * A genuine retry (same `submissionId`, resolved via
 * `AttemptRepository.findByUserAndSubmissionId`) is detected BEFORE the
 * advisory lock, QuestionVersion/DailyPlanItem consistency checks, or
 * `isCorrect`/`suspiciousTiming` computation — none of that work is needed
 * to answer "does this submissionId already have a result?". This does
 * NOT weaken `UNIQUE (user_id, submission_id)`: a genuinely concurrent
 * duplicate can still race this cheap read and see `null` on both sides,
 * in which case both fall through to the full path, whose
 * `insertIfNotExists` conflict handling remains the actual safety net,
 * exactly as it was before this fast path existed. This only makes the
 * COMMON, non-concurrent, sequential-retry case (network timeout then
 * retry, double-click after the first request already finished) cheaper.
 */

import {
  canonicalizeSelectedAnswer,
  InvalidSelectedAnswerError,
} from "../../domain/learning/answer";
import { deriveIsSameLearningSession } from "../../domain/learning/learning-session";
import {
  applyAttemptToProgress,
  type ProgressUpdateContext,
} from "../../domain/learning/progress-update";
import { rebuildUserQuestionProgress } from "../../domain/learning/rebuild";
import { OutOfOrderRetrievalError } from "../../domain/learning/retrieval-qualification";
import type { Attempt, UserQuestionProgress } from "../../domain/learning/types";
import type {
  DailyPlanAnswerTarget,
  TransactionalRepositories,
  UnitOfWork,
} from "./ports";

export type SubmitAnswerCommand = Omit<
  Attempt,
  "id" | "isCorrect" | "suspiciousTiming" | "engineVersion"
>;

export type SubmitAnswerContext = Omit<
  ProgressUpdateContext,
  "isSameLearningSession"
> & {
  generateId: () => string;
  /**
   * Anomaly-detection capability for `suspiciousTiming`
   * (`docs/LEARNING_ENGINE.md` §10). No such capability exists yet in this
   * repo — callers that don't have one should pass `() => false`, which is
   * an honest "no anomaly signal available," not an invented rule.
   */
  determineSuspiciousTiming: (input: {
    responseTimeSeconds: number | null;
    questionId: string;
    userId: string;
  }) => boolean;
};

export type SubmitAnswerResult =
  | {
      kind: "ACCEPTED";
      attempt: Attempt;
      progress: UserQuestionProgress;
      wasIdempotentRetry: boolean;
      /**
       * True only when this Attempt arrived out of chronological order and
       * `UserQuestionProgress` was reconciled via a full canonical-order
       * replay rather than the normal O(1) incremental update. Purely for
       * observability/debugging — the result is otherwise a normal
       * ACCEPTED outcome.
       */
      wasReconciledViaRebuild: boolean;
    }
  | {
      kind: "IDEMPOTENCY_KEY_CONFLICT";
      existingAttempt: Attempt;
      conflictingFields: string[];
    }
  | {
      /** ADR-016. */
      kind: "DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED";
      dailyPlanItemId: string;
    }
  | {
      /**
       * ADR-016 §19: the DailyPlanItem was already COMPLETED or SKIPPED —
       * a genuinely new submissionId arriving for an already-resolved item
       * (not a retry of the same submissionId, which short-circuits earlier
       * via the idempotency fast path). No Attempt is created and no
       * grading/progress-update work runs for this outcome.
       */
      kind: "DAILY_PLAN_ITEM_ALREADY_RESOLVED";
      dailyPlanItemId: string;
      status: "completed" | "skipped";
    }
  | {
      kind: "QUESTION_VERSION_CONSISTENCY_VIOLATION";
      questionVersionId: string;
    }
  | {
      /**
       * ADR-014: a structurally malformed `selectedAnswer` — wrong shape
       * for the Question's type, an unknown/duplicate option id, or
       * `null`/empty when a real selection is required. This is a
       * request-validation outcome, never conflated with `isCorrect:
       * false` — a malformed submission was never actually graded.
       */
      kind: "INVALID_SELECTED_ANSWER";
      reason: string;
    };

/**
 * ADR-010's canonical command-identity field list. `learningSessionId` is
 * deliberately NOT in this generic list — its identity ownership depends
 * on whether the Attempt is DailyPlan-attached (see `findConflictingFields`
 * below, and the module doc comment). Fields NOT in this list (`id`,
 * `isCorrect`, `suspiciousTiming`, `engineVersion`) are
 * server-generated/derived and never compared.
 */
const CANONICAL_COMMAND_IDENTITY_FIELDS: Array<keyof SubmitAnswerCommand> = [
  "courseId",
  "questionId",
  "questionVersionId",
  "selectedAnswer",
  "confidenceLevel",
  "responseTimeSeconds",
  "dailyPlanItemId",
  "assistanceUsed",
  "attemptNumberForPresentedItem",
  "answerWasRevealedBeforeResponse",
  "answeredAt",
];

/**
 * Exact null-aware equality per field, per ADR-010 ("an existing
 * dailyPlanItemId of 'item-123' and a retry carrying null are NOT the
 * same command"). Dates are compared by value, not reference.
 *
 * `selectedAnswer` needs its own case too, since ADR-014: a MULTIPLE_CHOICE
 * answer is a `string[]`, and plain `===` on two distinct array instances
 * is always `false` even for identical contents (reference inequality) —
 * naive `===` would make every legitimate MULTIPLE_CHOICE retry look like
 * an idempotency-key conflict. Both sides SHOULD already be canonical
 * (sorted, deduplicated) by the time they reach here — `command` is
 * canonicalized at the top of `submitAnswerInTransaction`, and
 * `existing.selectedAnswer` was canonicalized identically before its own
 * original insert — but this comparison sorts defensively (both sides,
 * fresh copies) rather than relying on that as an unstated cross-call-site
 * contract: comparing as true sets costs nothing extra here and removes
 * the assumption entirely, rather than merely documenting it.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  }
  return a === b;
}

function findConflictingFields(
  command: SubmitAnswerCommand,
  existing: Attempt,
): string[] {
  const conflicts: string[] = [];
  for (const field of CANONICAL_COMMAND_IDENTITY_FIELDS) {
    if (!valuesEqual(command[field], existing[field])) {
      conflicts.push(field);
    }
  }
  if (
    command.dailyPlanItemId === null &&
    command.learningSessionId !== existing.learningSessionId
  ) {
    conflicts.push("learningSessionId");
  }
  return conflicts;
}

/**
 * The single place that decides which `learningSessionId` an Attempt
 * actually gets — see the module doc comment's "learningSessionId
 * ownership" section for why this cannot simply trust
 * `command.learningSessionId`.
 *
 * A DailyPlan-attached Attempt (ADR-016) has its `learningSessionId`
 * derived from the `dailyPlanId` of the persisted DailyPlanItem the
 * Attempt resolves — a DailyPlan is already one per-user-per-local-day
 * plan, the one continuous session concept for it — so
 * `command.learningSessionId` is ignored for that case.
 */
function resolveLearningSessionId(
  command: SubmitAnswerCommand,
  dailyPlanItem: DailyPlanAnswerTarget | null,
): string | null {
  if (dailyPlanItem !== null) {
    return dailyPlanItem.dailyPlanId;
  }
  return command.learningSessionId;
}

class IdempotencyKeyConflict extends Error {
  constructor(
    public readonly existingAttempt: Attempt,
    public readonly conflictingFields: string[],
  ) {
    super("submitAnswer: submissionId reused for a different logical command");
    this.name = "IdempotencyKeyConflict";
  }
}

class DailyPlanItemOwnershipViolation extends Error {
  constructor(public readonly dailyPlanItemId: string) {
    super(
      "submitAnswer: dailyPlanItemId not found, or does not belong to this user/question/version",
    );
    this.name = "DailyPlanItemOwnershipViolation";
  }
}

class DailyPlanItemAlreadyResolvedError extends Error {
  constructor(
    public readonly dailyPlanItemId: string,
    public readonly status: "completed" | "skipped",
  ) {
    super(`submitAnswer: dailyPlanItemId ${dailyPlanItemId} is already ${status}`);
    this.name = "DailyPlanItemAlreadyResolvedError";
  }
}

class QuestionVersionConsistencyViolation extends Error {
  constructor(public readonly questionVersionId: string) {
    super(
      "submitAnswer: questionVersionId does not belong to the supplied questionId/courseId",
    );
    this.name = "QuestionVersionConsistencyViolation";
  }
}

/**
 * Shared by both the fast path (found before any insert attempt) and the
 * slow path (found via `insertIfNotExists`'s own conflict) — validates the
 * canonical command-identity field list and returns the safe-retry result,
 * or throws `IdempotencyKeyConflict` if this is actually a different
 * logical command reusing the same key.
 */
async function handleExistingAttempt(
  repos: TransactionalRepositories,
  command: SubmitAnswerCommand,
  existingAttempt: Attempt,
): Promise<SubmitAnswerResult> {
  const conflictingFields = findConflictingFields(command, existingAttempt);
  if (conflictingFields.length > 0) {
    throw new IdempotencyKeyConflict(existingAttempt, conflictingFields);
  }
  const progress = await repos.progress.getForUpdate(
    command.userId,
    command.questionId,
  );
  if (progress === null) {
    // An Attempt exists but no progress row does — should never happen
    // now that out-of-order Attempts are always reconciled synchronously
    // (there is no longer a "recorded but never folded" state this design
    // can produce). Surfaced as an unexpected error.
    throw new Error(
      `submitAnswer: Attempt ${existingAttempt.id} exists but no UserQuestionProgress row was found for (${command.userId}, ${command.questionId}) — data inconsistency`,
    );
  }
  return {
    kind: "ACCEPTED",
    attempt: existingAttempt,
    progress,
    wasIdempotentRetry: true,
    wasReconciledViaRebuild: false,
  };
}

export async function submitAnswer(
  command: SubmitAnswerCommand,
  context: SubmitAnswerContext,
  uow: UnitOfWork,
): Promise<SubmitAnswerResult> {
  try {
    return await uow.runInTransaction((repos) =>
      submitAnswerInTransaction(command, context, repos),
    );
  } catch (error) {
    if (error instanceof IdempotencyKeyConflict) {
      return {
        kind: "IDEMPOTENCY_KEY_CONFLICT",
        existingAttempt: error.existingAttempt,
        conflictingFields: error.conflictingFields,
      };
    }
    if (error instanceof DailyPlanItemOwnershipViolation) {
      return {
        kind: "DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED",
        dailyPlanItemId: error.dailyPlanItemId,
      };
    }
    if (error instanceof DailyPlanItemAlreadyResolvedError) {
      return {
        kind: "DAILY_PLAN_ITEM_ALREADY_RESOLVED",
        dailyPlanItemId: error.dailyPlanItemId,
        status: error.status,
      };
    }
    if (error instanceof QuestionVersionConsistencyViolation) {
      return {
        kind: "QUESTION_VERSION_CONSISTENCY_VIOLATION",
        questionVersionId: error.questionVersionId,
      };
    }
    if (error instanceof InvalidSelectedAnswerError) {
      // ADR-014: a structurally malformed selectedAnswer (wrong shape,
      // unknown/duplicate option id, or null/empty) is a request-validation
      // outcome, not an unexpected error and not "isCorrect: false" — it
      // may be thrown either by the early canonicalization step above or
      // by `repos.answerCorrectness.isCorrect`'s own deeper shape/option
      // validation; either way it maps to the same typed result.
      return { kind: "INVALID_SELECTED_ANSWER", reason: error.message };
    }
    // Any other error is unexpected — re-thrown, never swallowed, per the
    // "code discipline" requirement from the Phase 2 audit (transaction
    // rollback must never be hidden from the caller). This includes a
    // stray OutOfOrderRetrievalError from applyAttemptToProgress on the
    // incremental path below: the pre-check + rebuild fallback are
    // designed to make that unreachable, so if it ever surfaces here it is
    // a real bug to fix, not a case to paper over silently.
    throw error;
  }
}

async function submitAnswerInTransaction(
  rawCommand: SubmitAnswerCommand,
  context: SubmitAnswerContext,
  repos: TransactionalRepositories,
): Promise<SubmitAnswerResult> {
  // ADR-014: canonicalize selectedAnswer ONCE, up front — every use below
  // (the fast-path idempotency comparison, the correctness check, and the
  // persisted Attempt itself) then sees the same normalized value, so
  // `["a","b"]` and `["b","a"]` are treated and PERSISTED identically. This
  // needs no QuestionVersion/questionType knowledge (pure syntax — see
  // `canonicalizeSelectedAnswer`'s own doc comment), so it can safely run
  // before any repository call, including the fast-path retry lookup.
  // Throws InvalidSelectedAnswerError on a duplicate-id array, caught by
  // `submitAnswer`'s outer try/catch below and mapped to
  // `INVALID_SELECTED_ANSWER` — never silently accepted or treated as
  // "incorrect".
  const command: SubmitAnswerCommand = {
    ...rawCommand,
    selectedAnswer: canonicalizeSelectedAnswer(rawCommand.selectedAnswer),
  };

  // Fast path: a genuine, already-resolved retry short-circuits BEFORE the
  // lock, BEFORE QuestionVersion/DailyPlanItem consistency checks, and
  // BEFORE computing isCorrect/suspiciousTiming — none of that work is
  // needed to answer "does this submissionId already have a result?".
  // Race-safe (see AttemptRepository.findByUserAndSubmissionId's doc
  // comment): a genuinely concurrent duplicate can still race this read
  // and see `null` on both sides, in which case both fall through to the
  // full path below, whose UNIQUE (user_id, submission_id) constraint on
  // `insertIfNotExists` remains the actual safety net, unchanged from
  // before this fast path existed. This only makes the COMMON,
  // non-concurrent, sequential-retry case cheaper.
  const existingAttempt = await repos.attempts.findByUserAndSubmissionId(
    command.userId,
    command.submissionId,
  );
  if (existingAttempt !== null) {
    await repos.acquireLearnerQuestionLock(command.userId, command.questionId);
    return handleExistingAttempt(repos, command, existingAttempt);
  }

  // Step 1 (ADR-010): advisory lock, first, before any read/write.
  await repos.acquireLearnerQuestionLock(command.userId, command.questionId);

  // QuestionVersion/Question/Course consistency: the composite FK in
  // docs/PERSISTENCE_SCHEMA_V1.md is the last-resort DB-level guarantee;
  // this is the equivalent application-layer check, needed because
  // in-memory/test callers and any pre-insert validation can't rely on a
  // DB constraint firing.
  const versionContext = await repos.questionVersions.resolveVersionContext(
    command.questionVersionId,
  );
  if (
    versionContext === null ||
    versionContext.questionId !== command.questionId ||
    versionContext.courseId !== command.courseId
  ) {
    throw new QuestionVersionConsistencyViolation(command.questionVersionId);
  }

  // DailyPlanItem ownership + pending-status validation (ADR-016). Also
  // verifies `status === "pending"` here, before any
  // grading/Attempt-creation work — a
  // DailyPlanItem resolves at most once (`.claude/rules/learning-engine.md`
  // "Item resolution"), so a genuinely new submissionId arriving for an
  // already-resolved item must be rejected cleanly, before it can create a
  // second Attempt or a second progress update for the same plan slot. A
  // real RETRY of the same submissionId never reaches this block at all —
  // it already short-circuited via the idempotency fast path above.
  let dailyPlanItem: DailyPlanAnswerTarget | null = null;
  if (command.dailyPlanItemId !== null) {
    dailyPlanItem = await repos.dailyPlanItems.findItemById(
      command.dailyPlanItemId,
    );
    if (
      dailyPlanItem === null ||
      dailyPlanItem.userId !== command.userId ||
      dailyPlanItem.questionId !== command.questionId ||
      dailyPlanItem.questionVersionId !== command.questionVersionId
    ) {
      throw new DailyPlanItemOwnershipViolation(command.dailyPlanItemId);
    }
    if (dailyPlanItem.status !== "pending") {
      throw new DailyPlanItemAlreadyResolvedError(
        command.dailyPlanItemId,
        dailyPlanItem.status,
      );
    }
  }

  const suspiciousTiming = context.determineSuspiciousTiming({
    responseTimeSeconds: command.responseTimeSeconds,
    questionId: command.questionId,
    userId: command.userId,
  });

  const isCorrect = await repos.answerCorrectness.isCorrect(
    command.questionVersionId,
    command.selectedAnswer,
  );

  const candidateAttempt: Attempt = {
    ...command,
    // ADR-016: APPLICATION-derived from the persisted DailyPlanItem when
    // one is being resolved, never independently trusted from
    // `command.dailyPlanId` — the exact same discipline `learningSessionId`
    // already gets, extended to this field too since a DailyPlanItem
    // uniquely determines its own parent plan.
    dailyPlanId:
      dailyPlanItem !== null ? dailyPlanItem.dailyPlanId : command.dailyPlanId,
    learningSessionId: resolveLearningSessionId(command, dailyPlanItem),
    id: context.generateId(),
    isCorrect,
    suspiciousTiming,
    engineVersion: context.engineVersion,
  };

  // Step 2/3 (ADR-010): idempotent insert; on conflict, validate the full
  // canonical command-identity field list before treating it as a safe
  // retry.
  const { attempt, wasNew } = await repos.attempts.insertIfNotExists(
    candidateAttempt,
  );

  if (!wasNew) {
    return handleExistingAttempt(repos, command, attempt);
  }

  // Step 4 (ADR-010): safe to read previousProgress now — the advisory
  // lock already excludes any other transaction for this exact pair, even
  // when no row exists yet.
  const previousProgress = await repos.progress.getForUpdate(
    command.userId,
    command.questionId,
  );

  const isOutOfOrder =
    previousProgress !== null &&
    previousProgress.lastAttemptAt !== null &&
    attempt.answeredAt.getTime() < previousProgress.lastAttemptAt.getTime();

  let finalProgress: UserQuestionProgress;
  let wasReconciledViaRebuild = false;

  if (!isOutOfOrder) {
    // Normal chronological path: O(1) incremental update, unchanged from
    // before except that isSameLearningSession is now always derived, not
    // caller-injected.
    const isSameLearningSession = deriveIsSameLearningSession(
      attempt.learningSessionId,
      previousProgress?.retrievalBaselineLearningSessionId ?? null,
    );
    const fullContext: ProgressUpdateContext = {
      ...context,
      isSameLearningSession,
    };

    try {
      const updateResult = applyAttemptToProgress(
        previousProgress,
        attempt,
        fullContext,
      );
      finalProgress = updateResult.progress;
    } catch (error) {
      if (!(error instanceof OutOfOrderRetrievalError)) {
        throw error;
      }
      // Defense-in-depth: the pre-check above should make this
      // unreachable (see the module doc comment's complexity note), but
      // if the domain rejects it anyway, fall back to the same
      // synchronous rebuild the explicit out-of-order path uses, rather
      // than leaving progress stale or crashing.
      finalProgress = await rebuildProgress(repos, command, context);
      wasReconciledViaRebuild = true;
    }
  } else {
    // Out-of-order path (ADR-012): synchronous full canonical-order
    // replay, in the same transaction, of every Attempt for this pair —
    // including the one just inserted above.
    finalProgress = await rebuildProgress(repos, command, context);
    wasReconciledViaRebuild = true;
  }

  // Step 6.
  await repos.progress.upsert(finalProgress);

  // Step 7.
  if (command.dailyPlanItemId !== null) {
    const resolution = await repos.dailyPlanItems.markCompleted(
      command.dailyPlanItemId,
      command.answeredAt,
    );
    if (resolution.outcome !== "RESOLVED") {
      // Unreachable under normal operation: the pending check above ran
      // under the SAME (userId, questionId) advisory lock this call is
      // still holding, and a DailyPlanItem's `(daily_plan_id, question_id)`
      // is unique, so nothing else could have resolved this exact item
      // between the two checks. Surfaced loudly rather than silently
      // treated as success, per docs/ARCHITECTURE.md §21.
      throw new Error(
        `submitAnswer: dailyPlanItemId ${command.dailyPlanItemId} could not ` +
          `be marked completed (${resolution.outcome}) despite passing the ` +
          `pending check earlier in the same transaction`,
      );
    }
  }

  return {
    kind: "ACCEPTED",
    attempt,
    progress: finalProgress,
    wasIdempotentRetry: false,
    wasReconciledViaRebuild,
  };
}

async function rebuildProgress(
  repos: TransactionalRepositories,
  command: SubmitAnswerCommand,
  context: SubmitAnswerContext,
): Promise<UserQuestionProgress> {
  const records = await repos.attempts.listForReplay(
    command.userId,
    command.questionId,
  );
  // rebuildUserQuestionProgress sorts defensively and derives
  // isSameLearningSession fresh per record — see rebuild.ts. The
  // `isSameLearningSession` field on the context passed in is ignored/
  // overwritten there; `null` is passed only to satisfy the
  // ProgressUpdateContext shape.
  const rebuilt = rebuildUserQuestionProgress(records, {
    ...context,
    isSameLearningSession: null,
  });
  if (rebuilt === null) {
    // Unreachable in practice: the Attempt this call is reconciling was
    // already inserted before this function runs, so `records` always has
    // at least one entry. Surfaced loudly rather than silently, in case
    // that invariant is ever broken by a future change.
    throw new Error(
      `submitAnswer: rebuild produced no progress for (${command.userId}, ${command.questionId}) despite at least one Attempt existing`,
    );
  }
  return rebuilt;
}
