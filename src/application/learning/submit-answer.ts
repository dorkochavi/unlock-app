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
 * - **Today-attached Attempts** (`todaySessionItemId !== null`): the
 *   application derives `learningSessionId` from the persisted
 *   `TodaySessionItem.todaySessionId` — the one continuous session concept
 *   that already exists for Today (a `TodaySessionItem` belongs to exactly
 *   one `TodaySession`, and Today is already course+date scoped, ADR-011).
 *   No new Session subsystem is introduced. The client's `command
 *   .learningSessionId` is IGNORED for these Attempts — not merely
 *   validated — the same treatment already given to other
 *   server-derived fields (`isCorrect`, `engineVersion`). Consequently it
 *   is also EXCLUDED from the canonical command-identity comparison for
 *   these Attempts (see `findConflictingFields`): comparing a value the
 *   client does not actually own would only produce false idempotency
 *   conflicts.
 * - **Manual practice** (`todaySessionItemId === null`): no persisted
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
 * advisory lock, QuestionVersion/TodaySessionItem consistency checks, or
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

import { deriveIsSameLearningSession } from "../../domain/learning/learning-session";
import {
  applyAttemptToProgress,
  type ProgressUpdateContext,
} from "../../domain/learning/progress-update";
import { rebuildUserQuestionProgress } from "../../domain/learning/rebuild";
import { OutOfOrderRetrievalError } from "../../domain/learning/retrieval-qualification";
import type { Attempt, UserQuestionProgress } from "../../domain/learning/types";
import type {
  TodaySessionItem,
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
      kind: "TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED";
      todaySessionItemId: string;
    }
  | {
      kind: "QUESTION_VERSION_CONSISTENCY_VIOLATION";
      questionVersionId: string;
    };

/**
 * ADR-010's canonical command-identity field list. `learningSessionId` is
 * deliberately NOT in this generic list — its identity ownership depends
 * on whether the Attempt is Today-attached (see `findConflictingFields`
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
  "todaySessionId",
  "todaySessionItemId",
  "assistanceUsed",
  "attemptNumberForPresentedItem",
  "answerWasRevealedBeforeResponse",
  "answeredAt",
];

/**
 * Exact null-aware equality per field, per ADR-010 ("an existing
 * todaySessionItemId of 'item-123' and a retry carrying null are NOT the
 * same command"). Dates are compared by value, not reference.
 *
 * `learningSessionId` is handled separately, not via the generic list
 * above: it is genuine client-owned identity ONLY for manual practice
 * (`command.todaySessionItemId === null`). For a Today-attached Attempt it
 * is application-derived from the persisted `TodaySessionItem` (see
 * `resolveLearningSessionId`) — the client's claim there is not
 * authoritative, so comparing it as identity would reject a legitimate
 * retry whenever the client's (irrelevant) value happened to vary.
 */
function findConflictingFields(
  command: SubmitAnswerCommand,
  existing: Attempt,
): string[] {
  const conflicts: string[] = [];
  for (const field of CANONICAL_COMMAND_IDENTITY_FIELDS) {
    const commandValue = command[field];
    const existingValue = existing[field];
    const equal =
      commandValue instanceof Date && existingValue instanceof Date
        ? commandValue.getTime() === existingValue.getTime()
        : commandValue === existingValue;
    if (!equal) {
      conflicts.push(field);
    }
  }
  if (
    command.todaySessionItemId === null &&
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
 */
function resolveLearningSessionId(
  command: SubmitAnswerCommand,
  todaySessionItem: TodaySessionItem | null,
): string | null {
  if (todaySessionItem !== null) {
    return todaySessionItem.todaySessionId;
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

class TodaySessionItemOwnershipViolation extends Error {
  constructor(public readonly todaySessionItemId: string) {
    super(
      "submitAnswer: todaySessionItemId not found, or does not belong to this user/question/version",
    );
    this.name = "TodaySessionItemOwnershipViolation";
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
    if (error instanceof TodaySessionItemOwnershipViolation) {
      return {
        kind: "TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED",
        todaySessionItemId: error.todaySessionItemId,
      };
    }
    if (error instanceof QuestionVersionConsistencyViolation) {
      return {
        kind: "QUESTION_VERSION_CONSISTENCY_VIOLATION",
        questionVersionId: error.questionVersionId,
      };
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
  command: SubmitAnswerCommand,
  context: SubmitAnswerContext,
  repos: TransactionalRepositories,
): Promise<SubmitAnswerResult> {
  // Fast path: a genuine, already-resolved retry short-circuits BEFORE the
  // lock, BEFORE QuestionVersion/TodaySessionItem consistency checks, and
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

  // TodaySessionItem ownership/question/version validation. `todaySessionItem`
  // is kept (not discarded) — it is also what `resolveLearningSessionId`
  // uses below to derive the authoritative learningSessionId for a
  // Today-attached Attempt, ignoring whatever the client claimed.
  let todaySessionItem: TodaySessionItem | null = null;
  if (command.todaySessionItemId !== null) {
    todaySessionItem = await repos.todaySessions.findItemById(
      command.todaySessionItemId,
    );
    if (
      todaySessionItem === null ||
      todaySessionItem.userId !== command.userId ||
      todaySessionItem.questionId !== command.questionId ||
      todaySessionItem.questionVersionId !== command.questionVersionId
    ) {
      throw new TodaySessionItemOwnershipViolation(command.todaySessionItemId);
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
    learningSessionId: resolveLearningSessionId(command, todaySessionItem),
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
  if (command.todaySessionItemId !== null) {
    await repos.todaySessions.markItemCompleted(
      command.todaySessionItemId,
      command.answeredAt,
      attempt.id,
    );
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
