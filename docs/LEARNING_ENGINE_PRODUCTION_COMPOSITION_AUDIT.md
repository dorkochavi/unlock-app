# Learning Engine — Production Composition Audit

Status: AUDIT ONLY. No code, defaults, or composition root were added by
this document. Every claim below is grounded in the current repository
state as of branch `feature/project-foundation`, commit `ca3547f`
("harden learning contracts and formalize course access model").

## 0. What this audits

A claim made earlier in this session (recorded in
`docs/V1_VERTICAL_SLICE_PLAN.md`, Checkpoint 3 and Checkpoint 4) is that
the Learning Engine's policy/config objects lack production defaults and
that no composition root exists. This document independently re-verifies
that claim against the actual current source tree rather than trusting it.

**Headline finding: the prior claim is ACCURATE, not overstated.** Every
threshold-bearing policy object required to run `submitAnswer` or
`getOrCreateTodaySession` end-to-end has zero production default anywhere
in `src/`, and no composition root exists outside test files. One
secondary claim in the same planning document (about `src/app/` being
"the default Next.js scaffold" with "no `src/messages/` usage") is
**stale/inaccurate** and is called out separately in §5 — it does not
change the substantive finding about policy defaults, which remains fully
correct.

## 1. Every policy/config object found

Searched `src/domain/learning/` and `src/application/learning/` for every
exported `interface`/`type` ending in `Policy` or `Context`. Full result
set (nothing beyond this list exists):

| Type | File:line | Threshold/config fields | Carries a threshold? |
|---|---|---|---|
| `TodayPlannerPolicy` | `src/domain/learning/today-planner.ts:106` | `maxItems: number` | Yes |
| `RetrievalQualificationPolicy` | `src/domain/learning/retrieval-qualification.ts:119` | `minGapMsForSpacedRetrieval: number` | Yes |
| `MasteryPolicy` | `src/domain/learning/mastery.ts:33` | `minSpacedRetrievalsForStrengthening`, `minSpacedRetrievalsForMastered`, `minEvidenceStrengthForMastered`, `minRetrievabilityForMastered` | Yes |
| `MisconceptionPolicy` | `src/domain/learning/misconception.ts:103` | `confidentErrorScoreIncrement`, `recoveryScoreDecrement`, `minScore`, `maxScore`, `suspectedScoreThreshold`, `activeScoreThreshold`, `resolvedScoreThreshold` | Yes |
| `EvidenceStrengthPolicy` | `src/domain/learning/evidence-strength.ts:103` | `minMeaningfulAttemptsForEarly/Moderate/Strong`, `minSpacedRetrievalsForModerate/Strong`, `minObservationSpanMsForStrong` | Yes |
| `ProgressUpdateContext` | `src/domain/learning/progress-update.ts:108` | Bundles `retrievalQualificationPolicy`, `evidenceStrengthPolicy`, `masteryPolicy`, `misconceptionPolicy` (plus `now`, `engineVersion`, `memoryScheduler`, `isSameLearningSession`) | Yes (by composition) |
| `NextBestActionContext` | `src/domain/learning/next-best-action.ts:120` | `now`, `memoryScheduler` only | No threshold — clock/scheduler injection only |
| `NextBestActionRankingContext` | `src/domain/learning/next-best-action-ranking.ts:120` | `now` only | No threshold |
| `TodaySessionContext` | `src/application/learning/today-session.ts:39` | Bundles `todayPlannerPolicy` (plus `now`, `engineVersion`, `memoryScheduler`) | Yes (by composition) |
| `SubmitAnswerContext` | `src/application/learning/submit-answer.ts:135` | `Omit<ProgressUpdateContext, "isSameLearningSession">` plus `generateId`, `determineSuspiciousTiming` | Yes (by composition, inherits all four `ProgressUpdateContext` policies) |

Files checked with no policy/config object at all (confirmed, not
assumed): `src/domain/learning/evidence.ts` (evidence classification is
fully hard-coded rule logic — `classifyAttemptEvidence`, no policy
parameter), `src/domain/learning/lapse.ts` (pure function of two dates, no
policy — file's own doc comment: "No policy/threshold is injected here —
there is none"), `src/domain/learning/scheduler-rating.ts` (hard-coded V1
mapping, no policy object — `mapEvidenceToSchedulerRating`), `src/domain/learning/scheduler.ts`
(the `MemoryScheduler` interface itself carries no config — it is a pure
port), `src/domain/learning/learning-session.ts`, `src/domain/learning/answer.ts`,
`src/domain/learning/rebuild.ts` (imports the above policies but defines
none of its own).

## 2. FSRS scheduler config (`src/infrastructure/learning/fsrs/`)

`src/infrastructure/learning/fsrs/ts-fsrs-memory-scheduler.ts:43-45`:

```ts
const ADAPTER_FSRS_PARAMETERS = {
  enable_fuzz: false,
} as const;
```

This IS a hard-coded production value already present in `src/`, but it is
narrow and deliberate: `enable_fuzz: false` only disables ts-fsrs's
built-in interval randomization for deterministic tests
(file comment, lines 32-36: "an implementation/testing choice for this
spike, not a product decision"). Critically, `request_retention` (FSRS's
desired-retention parameter, i.e. how aggressively it schedules reviews)
is deliberately left unset so ts-fsrs falls back to its own library
default, per the file's own comment (lines 38-41) citing
`docs/OPEN_QUESTIONS.md` #12 as still open. So even this one file that
does hard-code something stops short of making the actual product-relevant
scheduling decision — it inherits a third-party library default for the
one number that matters (retention), not a UNLOCK-chosen one.

## 3. Every instantiation site, verified by grep across all of `src/`

Grepped for each type name (`TodayPlannerPolicy`, `RetrievalQualificationPolicy`,
`MasteryPolicy`, `MisconceptionPolicy`, `EvidenceStrengthPolicy`,
`ProgressUpdateContext`, `NextBestActionContext`, `NextBestActionRankingContext`,
`TodaySessionContext`, `SubmitAnswerContext`) across all of `src/`, including
`__tests__` folders. Result: **23 files matched, and every single one is
either (a) the domain/application source file that *defines* the type, or
(b) a `__tests__/*.test.ts` file that constructs literal values inline for
that one test.** No match exists in `src/app/`, `src/lib/`, `src/services/`
(empty directory — confirmed via `find`), `src/features/` (empty directory
— confirmed), or `src/infrastructure/postgres/`.

Concrete literal values found (all test-only), e.g.:
- `src/application/learning/__tests__/today-session.test.ts:16` — `{ maxItems: 10 }`
- `src/application/learning/__tests__/submit-answer.test.ts:25-48` and
  `src/domain/learning/__tests__/learning-engine-golden-scenarios.test.ts:46-73`
  and `src/domain/learning/__tests__/evidence-strength.test.ts:11-16` and
  `src/domain/learning/__tests__/mastery.test.ts:8-11` all independently
  hand-write their own full set of policy numbers (e.g.
  `minGapMsForSpacedRetrieval: 1 * DAY_MS`, `minMeaningfulAttemptsForEarly: 1`,
  `confidentErrorScoreIncrement: 2`, `minRetrievabilityForMastered: 0.8` or
  `0.85` depending on the file).

These values are **not** imported from any shared fixture/constants module
— each test file re-declares its own copy inline (confirmed: none of these
test files imports anything named `fixture`, `default`, or a shared
policy constant; only `import type { XPolicy } from "..."` type imports
exist). They are mutually similar but not identical (e.g.
`minRetrievabilityForMastered` is `0.8` in one test file and `0.85` in
another), which is itself evidence that no single canonical "the V1
default" has been agreed even informally — they are independent
test-authors' arbitrary stand-ins, not a de facto standard.

## 4. Does a production composition root exist? No.

Searched `src/app/`, `src/lib/`, `src/services/` for anything resembling
application wiring/bootstrap:

- `src/app/` contains exactly `favicon.ico`, `globals.css`, `layout.tsx`,
  `page.tsx`. **No `route.ts` file exists anywhere under `src/app/`**
  (confirmed via `find src -iname "route.ts"` — zero results). There is
  no server action, no API handler, and therefore nothing that could call
  `submitAnswer` or `getOrCreateTodaySession` with real values outside a
  test.
- `src/lib/` contains only `locale.ts` (+ its test) — RTL/i18n locale
  metadata, unrelated to the learning engine.
- `src/services/` and `src/features/` both exist as directories but are
  **empty** (confirmed via `find ... -type f` returning nothing).
- `src/infrastructure/postgres/` contains real adapters for every port
  (`attempt-repository.ts`, `progress-repository.ts`,
  `today-session-repository.ts`, `postgres-unit-of-work.ts`, etc.) — the
  persistence side is real and tested against PGlite — but nothing in that
  directory constructs a `SubmitAnswerContext` or `TodaySessionContext`;
  those adapters only satisfy `ports.ts`'s repository/UnitOfWork
  interfaces, not the policy-bearing contexts.

**Conclusion: no production composition root exists anywhere in this
repository.** The only places any of these policy objects are ever
instantiated with concrete numbers are `__tests__/*.test.ts` files.

## 5. Is `src/app/` "still the default Next.js scaffold"? — Partially stale claim, flagged

`docs/V1_VERTICAL_SLICE_PLAN.md:47-51` states: "No API routes. `src/app/`
is still the default Next.js scaffold (`layout.tsx`, `page.tsx`,
`favicon.ico`, `globals.css` only). No UI beyond the default scaffold. No
`src/messages/` usage in any route yet (the messages layer itself exists
— `src/messages/he.ts` — but nothing renders it)."

This is **not accurate as read** — `src/app/layout.tsx` and
`src/app/page.tsx` both actively import and call `getMessages()`
(`src/messages/index.ts`) and `src/app/layout.tsx` imports `locale` from
`src/lib/locale.ts` to set `<html lang dir>` for RTL (ADR-002). This is
real, non-default, functioning i18n/RTL wiring, not boilerplate:

```tsx
// src/app/layout.tsx
import { locale } from "@/lib/locale";
import { getMessages } from "@/messages";
const messages = getMessages();
...
<html lang={locale.lang} dir={locale.dir} ...>
```

Checked via `git log --follow -- src/app/layout.tsx`: this content was
introduced in the `c133afe` ("chore: complete foundation cleanup") /
`bdb4215` ("chore: establish project foundation") commits — i.e. it has
been present since near the very start of this repository's history,
*before* `docs/V1_VERTICAL_SLICE_PLAN.md` itself was authored/last touched
(that document was last modified in `ca3547f`, the current HEAD commit,
per `git log --follow`). So this was not a claim that went stale later —
it appears to have been inaccurate at the moment it was written, most
likely because `src/app/` was compared only by file *count* (still 4
files) rather than by content.

**This does not change the substantive finding.** The part of the claim
that actually matters for this audit — no `route.ts` files exist, no
composition root exists, nothing calls the learning engine outside tests
— is independently confirmed accurate by this audit (§3, §4). Only the
narrower "default scaffold" / "no messages usage" phrasing is wrong. This
is flagged for whoever maintains `docs/V1_VERTICAL_SLICE_PLAN.md` next;
per this audit's own scope (Learning Engine composition, not general doc
maintenance) no edit is made to that file here.

## 6. Could Today run end-to-end for a real user even after Auth existed?

**No — Auth is not the only blocker.** Even with a fully working Auth
system supplying a trustworthy `userId`, a route handler would still need
to construct a `SubmitAnswerContext` (for `submitAnswer`) or a
`TodaySessionContext` (for `getOrCreateTodaySession`), and both require
concrete numeric/enum values for policy fields that currently have **no
production value anywhere in the codebase**:

- `TodaySessionContext.todayPlannerPolicy.maxItems` — no default (
  `today-planner.ts:107`: "No default.")
- `SubmitAnswerContext`'s inherited `retrievalQualificationPolicy.minGapMsForSpacedRetrieval`
  — no default (`retrieval-qualification.ts:117`: "No production value is
  chosen here — see docs/OPEN_QUESTIONS.md #12.")
- `SubmitAnswerContext`'s inherited `evidenceStrengthPolicy` (6 fields),
  `masteryPolicy` (4 fields), `misconceptionPolicy` (7 fields) — none
  have production defaults; `progress-update.ts:117-146` explicitly notes
  each is a "no production default is chosen here" injection point.

A route author would either have to (a) block until these are decided, or
(b) invent numbers on the spot inside route code — which is exactly the
outcome `docs/V1_VERTICAL_SLICE_PLAN.md` Checkpoint 3 already flags as
unacceptable ("This is not this checkpoint's decision to make silently").
So: **the ONLY blocker is not Auth. A production run would also
immediately fail (or silently invent policy) for lack of these values,
independently of Auth's status.**

## 7. Classification of each missing default

| Missing default | Classification | Reasoning |
|---|---|---|
| `TodayPlannerPolicy.maxItems` | **PRODUCT** | Directly determines how much work Today asks of a learner per day — `docs/OPEN_QUESTIONS.md` #16 ("Today Session Size") is explicitly open and frames this as balancing completion likelihood, learning volume, and product habit. Superseded-but-not-yet-decided by `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §6, which explicitly declares dynamic size with no fixed N and defers exact bounds to product/calibration work not yet done. Not a number engineering should pick unilaterally. |
| `RetrievalQualificationPolicy.minGapMsForSpacedRetrieval` | **ENGINEERING CALIBRATION** (with product visibility) | This is a "how long counts as spaced enough to be a distinct retrieval, not same-session repetition" gate. A conservative literature-informed default (e.g. same-day vs. next-day) is a defensible engineering starting point, but it directly shapes what counts as evidence toward mastery/misconception recovery, so any chosen default should be documented as provisional and reviewed by product, not treated as invisible plumbing. |
| `MasteryPolicy` (4 fields, esp. `minEvidenceStrengthForMastered`, `minRetrievabilityForMastered`) | **PRODUCT** | This defines what "mastered" *means* to a learner-facing product — directly a learning-outcome/trust claim UNLOCK makes to the user. `docs/OPEN_QUESTIONS.md` #11 ("Mastery Scale") is explicitly open and warns against "false precision." Not safe for engineering to decide alone. |
| `MisconceptionPolicy` (7 fields) | **PRODUCT** | Determines when a learner is told (implicitly, via Next Best Action prioritization) that they have a misconception needing remediation — a learning-outcome-facing claim. `docs/OPEN_QUESTIONS.md` #13 ("Misconception Rule") is explicitly open. |
| `EvidenceStrengthPolicy` (6 fields) | **ENGINEERING CALIBRATION, but feeds directly into MasteryPolicy so needs product sign-off before shipping** | The individual attempt-count/span thresholds ("how many attempts before evidence counts as moderate/strong") are more mechanical than `MasteryPolicy`'s category boundaries, and a reasonable conservative starting point could plausibly be engineering-authored. However, because `MasteryPolicy.minEvidenceStrengthForMastered` gates directly on this policy's output, shipping any concrete numbers here without product visibility would silently pre-bake a mastery-speed decision. Classified as calibration-with-required-visibility, not pure engineering-only. |
| FSRS `request_retention` (currently: unset, library default) | **PRODUCT** (already correctly deferred) | `docs/OPEN_QUESTIONS.md` #12 explicitly lists "desired retention configuration" and "whether/how desired retention changes near an exam date" as open. The current code's choice to leave it at the ts-fsrs library default rather than hard-coding 0.9 is the CORRECT conservative posture, not a gap to fix — flagged here only for completeness, since it is a real config value with no UNLOCK-chosen default. |
| `enable_fuzz: false` (FSRS) | **Safe to keep as-is, no product/engineering decision needed** | This is a determinism-for-testing choice about interval randomization, not a learning-outcome behavior. It is already set, already narrow, and already justified in the file's own comment. Nothing to do here. |

Honest self-check per the task's instruction: I did **not** find any
threshold in this list that "can safely get a V1 default without Dor
deciding anything" beyond the `enable_fuzz` case above, which is not
really a threshold in the learning-outcome sense at all. Every other
threshold here touches either how much work a learner is asked to do
(`maxItems`), what counts as evidence (`EvidenceStrengthPolicy`,
`RetrievalQualificationPolicy`), or what claims are made about a learner's
knowledge (`MasteryPolicy`, `MisconceptionPolicy`) — all of which the
codebase's own doc comments and `docs/OPEN_QUESTIONS.md` already treat as
requiring product judgment, not just an engineer's best guess.

## 8. Summary

- No production composition root exists anywhere in `src/` (confirmed by
  exhaustive grep + directory listing, §3-§4).
- No policy/config object has a production default anywhere in `src/`
  (confirmed by exhaustive grep, §1 and §3).
- The one hard-coded config value that does exist
  (`ADAPTER_FSRS_PARAMETERS.enable_fuzz`) is narrow, deliberate, and
  correctly does NOT decide the one product-relevant FSRS parameter
  (retention) — §2.
- Auth is real but is **not the only blocker** to running Today/submitAnswer
  end-to-end in production — the missing policy defaults are an
  independent, equally-blocking gap (§6).
- The prior session's claim that these policies lack production defaults
  and a composition root is **accurate**. A secondary, narrower claim in
  the same planning document (`src/app/` = "default Next.js scaffold",
  "no `src/messages/` usage") is **stale/inaccurate** and is flagged in
  §5 for future correction, without editing that file here (out of this
  audit's scope).

## Related Documents

- `docs/V1_VERTICAL_SLICE_PLAN.md` (source of the audited claim, Checkpoints 3-4)
- `docs/OPEN_QUESTIONS.md` (#11, #12, #13, #16 — all still open)
- `docs/DECISIONS/008-fsrs-memory-scheduler.md` (ADR-008)
- `src/domain/learning/today-planner.ts`, `retrieval-qualification.ts`,
  `mastery.ts`, `misconception.ts`, `evidence-strength.ts`,
  `progress-update.ts`
- `src/application/learning/submit-answer.ts`, `today-session.ts`
- `src/infrastructure/learning/fsrs/ts-fsrs-memory-scheduler.ts`
