# UNLOCK — Run 009: Learner Progress + Instructor Insights V1

PLAN_VERSION: 003
RUN_ID: 2026-09-25-009
BASE_HEAD: afcd750
STATUS: IN PROGRESS — S1 committed (learner Topic Progress read model); S3 committed and Preview-verified (COMPLETE); S2 not started. The S1 entry gate (§9.1) was satisfied. S2's entry shape is decided (§7 S2).

## 1. Run Goal

Expose the learning state UNLOCK already derives in two small, honest, read-only views:

1. **Learner:** a simple Topic-state Progress view (qualitative states + coverage context + a path back to Today).
2. **Instructor:** one discoverable "ניתוח תשובות" surface with Question-level Item Analysis and Topic-level Insights, both under one privacy contract (F-02).

Run 009 is an explicitly approved product-development Run. It is not a Pre-Pilot release requirement and does not approve the pilot. The Pre-Pilot Content gate is an external dependency owned by `docs/PILOT_READINESS.md` and does not block this Run.

Learner Progress is a **partial promotion** of `FUB-018` / `OQ-029` (simple Topic-state only). Nothing here claims pilot evidence validated advanced Progress.

## 2. Run-Start Contract

Expected: branch `feature/project-foundation`, `HEAD == BASE_HEAD` (`afcd750`) or one deliberate documentation commit above it that contains only this Plan revision and its reconciled docs; working tree clean; otherwise `PLAN_CONFLICT`. No push. No hosted mutation.

**Observability bootstrap (before any implementation read).** Run implementation in a genuinely NEW Claude Code process/session (do not assume `/clear` refreshes the environment; the collector prefers a persisted `UNLOCK_RUN_ID` over the Plan). Then, in order: (1) verify branch and HEAD; (2) verify the working tree; (3) verify this file's `RUN_ID` is `2026-09-25-009`; (4) verify the first actually recorded telemetry event carries `run_id = 2026-09-25-009`; (5) record `/context`; (6) perform 2–3 normal tool/read events; (7) verify they land in `scratch/telemetry/2026-09-25-009/`; (8) only then start S1/S3. If the run id is wrong or event capture stops, STOP and fix the telemetry tooling separately. The collector is not modified by this Plan.

## 3. Fixed Run Decisions

### D1 — Privacy contract (F-02; applies to BOTH Item Analysis and Topic Insights)
- Never expose: exact responder count, bucketed responder count, learner identity, per-option distributions, learner drill-down.
- Eligibility uses the existing disclosure policy: ≥5 active LEARNERs and ≥5 distinct responders for the relevant evidence surface (per Question for Item Analysis; per Topic for Topic Insights). The minimum stays 5; no higher threshold. The counts are used internally to decide eligibility and are never returned. Instructor aggregate eligibility deliberately retains the existing ACTIVE LEARNER population (non-revoked AND non-archived); this differs intentionally from learner self-read authorization (§3 Standing constraints), where an archived-but-not-revoked LEARNER still satisfies `hasAccess` — instructor analytics describe the active class population, not every learner who retains historical access.
- When eligible, show only: a coarse descriptive band, static copy ("based on first answers from at least 5 learners"), and the last-updated time. When not eligible: an explicit insufficient-data state with no classification.
- Bands (3): `MOSTLY_CORRECT`, `MIXED`, `MOSTLY_INCORRECT`. **Frozen boundaries** over the eligible first accepted answers (c correct of n): `MOSTLY_CORRECT` when more than 2/3 are correct, `MIXED` when between 1/3 and 2/3 correct inclusive, `MOSTLY_INCORRECT` when fewer than 1/3 are correct. Implement and test with integer-safe comparisons only: `3c > 2n` / `n ≤ 3c ≤ 2n` / `3c < n`. Percentages and the underlying counts are never exposed in the UI or DTO.
- Existing Item Analysis (`distinctResponderCount`, `approximateIncorrectRatePercent`, and the "N learners answered / N correct" copy) is brought into this contract in S3. This intentionally changes a shipped surface and supersedes the count-style wording allowed by the earlier Pre-Pilot Plan.
- No new persisted privacy/disclosure model. Manual refresh only, and the operating rule stays: refresh after an answering window, not per answer.
- Accepted residual risk: crossing the eligibility threshold, or a single response flipping a band boundary, is still inferable by an instructor who refreshes after every response. The contract reduces this; it does not eliminate it.

### Topic Insight evidence unit
Reuse the accepted rule: the first accepted Attempt per learner per current QuestionVersion. Within a Topic, pool eligible first-attempt evidence across the current published Questions in that Topic. This is intentionally attempt/question weighted; no per-learner Topic normalization in V1. **Limitation (kept visible):** a learner who answered more Questions in a Topic contributes more evidence than one who answered fewer. Revisit only if pilot evidence shows it is materially misleading.

### D2 — Learner Topic states (exactly four; no percentages, no mastery/confidence score, no level)
Hebrew concepts: `NOT_STARTED` "לא התחלת", `IN_PROGRESS` "בתהליך", `NEEDS_REINFORCEMENT` "דורש חיזוק", `SOLID` "מבוסס".
- `NOT_STARTED`: no learner evidence (no real Attempt) on any Question in the Topic.
- `NEEDS_REINFORCEMENT`: only from existing domain-derived stronger signals on ATTEMPTED Questions — an `active` misconception, or an unresolved lapse (existing lapse check). A single suspected misconception or a single confident error alone never triggers it.
- `SOLID`: requires meaningful Topic coverage, no reinforcement signal, and every attempted Question at the existing `strengthening` or `mastered` category (existing mastery/evidence policy is not loosened to make SOLID appear more often).
- `IN_PROGRESS`: everything else with evidence. Sparse evidence MUST resolve here, never to `NEEDS_REINFORCEMENT`.
- Precedence: `NEEDS_REINFORCEMENT` over `SOLID`. Coverage context is shown as a plain count ("attempted X of Y questions").
- The repository provides no obvious safe coverage constant, so it is an explicit Plan constant, not a hidden heuristic. **Frozen SOLID coverage gate** (N = the Topic's current published Questions, A = attempted Questions): for N ≥ 3, `A ≥ 3` AND `2A ≥ N` (at least 50% attempted); for N = 1 or 2, `A = N` (100% coverage required). All other SOLID requirements above are unchanged. Integer-safe comparisons only. No policy-version persistence mechanism.

### D3 — Promotion scope
Promoted: simple read-only Topic-state Progress, qualitative states, coverage context, path back to Today. Still deferred: Landscape, Pulse, historical trends, readiness score, percentages, forecasting, learner-selected study workflow, gamification, rich analytics, advanced memory visualization.

### D4 — Instructor wording (descriptive, not interpretive)
Name the metric: first answers / first accepted attempts. Example concepts: "רוב התשובות הראשונות היו נכונות" / "תמונה מעורבת בתשובות הראשונות" / "רוב התשובות הראשונות היו שגויות" (exact Hebrew refined in S3). Do not use: weak, struggling, low ability, "needs reinforcement", "low relative performance" (no defined comparator). Static copy states: evidence uses first accepted answers; current published QuestionVersions only; insufficient-data Topics are not classified. Learner and instructor vocabularies are intentionally different.

### D5 — Discoverability
One instructor surface, "ניתוח תשובות", containing Question-level Item Analysis and Topic-level Insights; not a broad analytics dashboard. A visible entry point from the normal instructor Course UI, rendered only when the user has Course-management access AND the Course state supports the analysis (avoid an F-13-style dead link). Authorization stays enforced at endpoint/use-case level. `FUB-028` closes only after the entry point exists and Preview verification succeeds. `FUB-029` is unchanged.

### D6 — Topic history semantics: CURRENT-DERIVED
`questions.topic_id` (current, non-versioned; deliberately not snapshotted at publish) is the canonical organization for the Run 009 read models. Historical Attempts are interpreted under the Question's CURRENT Topic. No Topic on Attempt, QuestionVersion, or any snapshot table; no migration. Reassigning a Question's Topic after Attempts exist makes historical evidence appear under the new Topic — accepted V1 behavior; a test pins it. Operational rule: avoid Topic reassignment once learner answering has started (recorded in `docs/PILOT_READINESS.md`, not enforced). Historical/trend analytics that need immutable Topic attribution stay deferred.

### Null Topics
Published Questions normally require a Topic. Defensively: Learner Progress shows no "Uncategorized" Topic. Instructor Insights shows a neutral "ללא נושא" bucket if eligible published content genuinely has no Topic (same eligibility rules; evidence is never silently dropped). Tested.

### Archived Topics
Not silently collapsed into "Other". Instructor view: a distinct, clearly marked archived-Topic representation when evidence/current content exists. Learner view: an archived Topic is not an active Progress destination. Coverage and Today are not silently rewritten. Prior evidence (a grep of the Postgres Today/unseen query code found no Topic-archive filtering) suggests Questions in an archived Topic may still be served by Today while the learner view hides the Topic — a possible contradiction with the Progress denominator. S1 MUST inspect the actual behavior first; if the contradiction is real and cannot be resolved without inventing semantics: `PLAN_CONFLICT`, stop. `F-04b` is untouched.

### Archived Courses
Learner Progress is **PUBLISHED-only for Run 009 V1**: a PUBLISHED Course may be read (subject to membership access); a DRAFT or ARCHIVED Course is unavailable (`COURSE_NOT_ACTIVE` / 409, already implemented in S1). ADR-015 membership access and Course lifecycle are separate dimensions: an archived-but-not-revoked learner membership still satisfies `hasAccess` (§3 Standing constraints), but Progress additionally requires the Course itself to be PUBLISHED. This is an intentionally conservative, TEMPORARY local rule — it is NOT the final lifecycle decision. Whether learner-owned history stays readable after an instructor archives the Course remains part of `F-04b` / future lifecycle semantics; F-04b is not resolved or closed by Run 009. Instructor Topic Insights follows the existing Item Analysis Course-state rules (PUBLISHED).

### Standing constraints
Read-model only; no persisted aggregate; no migration; no Learning Engine/FSRS/NBA/DailyPlan/enum change; Progress is read-only, links back to Today, does not select/rank/resolve Today items and is not a manual study-selection workflow. Access (ADR-015 §7/§8): learner sees only own state for Courses where they hold a LEARNER role with `hasAccess` (not revoked) — revoked ⇒ denied; archived-but-not-revoked ⇒ still authorized for own Progress/history (archiving only removes the Course from the active learning/Today set; discoverability stays governed by existing UI/active-learning semantics, and S2 need not add an archived-Course navigation path; same precedent as F-04a); instructor views require an active non-revoked OWNER/INSTRUCTOR (`canAuthorCourse`); auth before DB (`auth.md`). Hebrew/RTL, mobile-first, existing `src/messages` layer; learner nav gains one tab. One app; Local → Preview → Production; no Staging; no destructive Production-DB experiments.

## 4. Explicit Non-Goals / Deferred

Landscape/Pulse/trends (FUB-018); Readiness/Mirror (FUB-019, OQ-030); Class Pulse/Teach Next/realtime (FUB-020); cohorts (FUB-021); semantic misconceptions and learner drill-down (FUB-022); analytics platform/KPI events (FUB-023); session-scoped/cross-version analytics (FUB-024); active vs inactive learner counts; forgetting-risk display; Today/Answer round-trip refactor (FUB-026); Staging; branch-model migration; F-01/F-04b behavior; AI/PDF (Run 011); pilot-content criteria (see `docs/PILOT_READINESS.md`).

## 5. Design Review (summary)

**KEEP:** `user_question_progress` (mastery, evidence strength, misconception, lapse) + production policies; the Item Analysis stack as template for authorization, disclosure and counting; existing Topics/`questions.topic_id`; layering, injected time, PGlite tests, `getMessages()`, the nav array.
**WATCH:** strict per-question `mastered` makes `SOLID` rare in a short pilot (accepted; do not loosen); "unseen" follows ADR-017 (no prior real Attempt — a missing progress row alone is insufficient); Topic assignment is current (D6); pooled attempt-weighted Topic evidence (limitation above); small-n threshold crossing; hot files (`progress-update.ts` 752 lines, `domain/learning/types.ts`) — the read model needs only the `UserQuestionProgress` type, do not read `progress-update.ts` in full.
**CHANGE:** Item Analysis moves to the D1 contract (S3); the archived-Topic inspection is done before S1.

## 6. Data / Domain Model

Exists: `UserQuestionProgress`, immutable Attempts, `questions.topic_id`, `topics.archived_at`, `course_memberships`, current `question_versions`, the aggregate-disclosure policy. New (pure, derived, non-persisted): a Topic-state derivation for learners; a Topic (and Question) band function for instructors with the eligibility check kept inside the read model; two read use cases behind read-only ports. If any migration, index, or persisted aggregate looks necessary → stop (§11).

## 7. Slices (three only; run close uses the canonical completion protocol, not a slice)

Verification per `.claude/rules/testing.md`; reviewers per `review-commit`. S3 is architecturally independent of S1/S2 and may run first once its gate is met.

### S1 — Learner Topic Progress Read Model
- **Outcome:** deterministic per-learner Topic states for a Course.
- **Scope:** pure derivation; read query; application use case (LEARNER role + `hasAccess` required, fails closed; archived non-revoked learner allowed); read-only port/adapter; API/route contract if required; PGlite/integration where DB behavior matters.
- **Tests:** table tests (all four states, sparse evidence → `IN_PROGRESS`, single suspected misconception/confident error ≠ `NEEDS_REINFORCEMENT`, precedence, determinism); ADR-017 unseen; current QuestionVersion; membership authorization (active and archived-non-revoked LEARNER allowed; non-member, revoked LEARNER, OWNER/INSTRUCTOR denied); null-Topic and archived-Topic cases; a test pinning current-derived Topic behavior (reassign Topic → history follows the new Topic); route: 401, malformed input, no leakage.
- **Manual verification:** none (API/read only).
- **Must not begin implementation until:** the archived-Topic semantic inspection is done (`PLAN_CONFLICT` and stop if it exposes an unresolvable contradiction). The learner constants (§3 D2) and current-derived Topic semantics (§3 D6) are already frozen. The SOLID coverage boundaries (N=1, 2, 3+; A at and around the thresholds) get explicit tests.
- **Stop:** migration/index needed; Engine/enum change needed; percentages or scores creeping in.

### S2 — Learner Progress UI
- **Outcome:** learner opens Progress and sees Topic states with coverage and a path back to Today.
- **Entry shape (decided):** Progress is a GLOBAL learner-nav destination (nav: Today, Courses, Progress; `learner-nav.tsx`). The page shows the learner's ACTIVE/DISCOVERABLE Courses (existing active-Course/discoverability semantics — the same listing the Courses page uses), grouped by Course; each Course section shows that Course's Topic states from the S1 read model. Authorization and discoverability stay separate: an archived-but-not-revoked membership may still be authorized at the S1 API/use-case layer, but archived memberships are not surfaced as active Progress destinations, and S2 adds NO archived-Course navigation path or other backdoor. No new persisted cross-Course model; S2 composes the existing active-Course listing with S1. If that composition would require an unsafe or architecturally inappropriate N+1 pattern: STOP and report before inventing a new aggregate.
- **Scope:** Progress navigation entry, mobile-first Hebrew/RTL page, four states, coverage context ("attempted X of Y"), back-path to Today, and explicit empty/unavailable states: no active Courses → global empty state; active Course with `topics: []` → Course-level empty state (NOT "not started" — no Topics is distinct from a Topic in `NOT_STARTED`); `COURSE_NOT_ACTIVE`/409 → explicit unavailable state if encountered; nothing attempted → Topics show `NOT_STARTED` as defined.
- **Tests:** component/page tests for each state and each empty/unavailable state (including `topics: []` vs `NOT_STARTED`); nav test; RTL assertions where the repo does them.
- **Manual verification:** Vercel Preview on a real phone (RTL, tap targets, no dead links, fresh-learner empty state).
- **Stop:** pressure toward percentages, streaks, readiness, topic practice, or a dashboard.

### S3 — Instructor Topic Insights + Analysis Discoverability
- **Outcome:** one discoverable "ניתוח תשובות" surface with privacy-safe Question-level and Topic-level views.
- **Scope:** Topic aggregation under D1 (first-attempt pooled evidence); Item Analysis reconciled to D1 (remove exact count and rounded percentage from DTO/page/copy); descriptive bands; insufficient-data states; last-updated + manual refresh consistent with the existing surface; "ללא נושא" and archived-Topic representations; visible Course entry point (D5); authorization.
- **Tests:** OWNER/INSTRUCTOR allowed, LEARNER/revoked/archived-Course denied; eligibility edges (thresholds internal, never returned); band boundaries (exhaustive over n, c like the Item Analysis bucketing test, including exactly 1/3 and exactly 2/3 correct → `MIXED`); response contains no count/percentage/identity/per-option data; current-version-only; repeat attempts do not inflate; current-derived Topic pin; null and archived Topic; entry point renders only when it will work; PGlite for the aggregate query.
- **Manual verification:** Preview — instructor path via the entry point; learner denial. Closes `FUB-028` only after this.
- **Review:** security reviewer required (learner-derived aggregate over a changed shipped endpoint); DB reviewer if the aggregate query is non-trivial.
- **Entry:** no remaining human gate — the F-02 privacy contract (D1, including frozen band boundaries) and the descriptive-wording principle (D4) are frozen (§9).
- **Stop:** new persistence; pressure to add counts, misconception labels, Teach Next, realtime, or active/inactive counts.

## 8. Acceptance Criteria (Run-level)

- Deterministic learner Topic state; no false precision; no percentages; sparse evidence safe (`IN_PROGRESS`).
- Current-derived Topic behavior explicitly tested; null/archive edge cases covered.
- Learner and instructor authorization correct (fail closed, auth before DB).
- F-02 applied consistently to Item Analysis and Topic Insights: no exact or bucketed responder count; no identity, drill-down, or per-option distribution.
- Instructor wording descriptive; learner and instructor vocabularies distinct.
- Hebrew/RTL and mobile usable (Preview, real phone).
- Progress complements Today and is not a manual study-selection workflow; Today behavior unchanged.
- PGlite integration where DB behavior matters.
- No migration; no Learning Engine rewrite; no persisted aggregate; no unresolved security regression.
- `DEV_STATUS` reflects only durable truth; Run report written; Claude has not pushed.

Pilot Content Go/No-Go criteria are not part of Run 009 acceptance.

## 9. Slice-Entry Gates

1. **Before S1:** the archived-Topic semantic inspection (§3 "Archived Topics"). SATISFIED — inspected before S1; no conflict (Today does not filter on Topics; archived Topics are omitted from learner Progress with per-Topic denominators, so no Course-level total is distorted).
2. **S3:** no remaining human gate. The privacy contract, band boundaries (§3 D1) and the descriptive-copy principle (§3 D4) are frozen; exact Hebrew wording may be refined during implementation without changing semantics.
3. Any other calibration constant surfaced during implementation is an explicit decision, not a heuristic.

Operational (not blockers): Supabase Auth email/SMTP capacity; Production QA data cleanup — both in `docs/PILOT_READINESS.md`.

## 10. Observability During the Run

Existing tooling only (`.claude/telemetry/*`, `docs/RUN_TELEMETRY.md`, `docs/DEVOS_OBSERVABILITY.md`). Measure → Interpret → Compare → Act. Capture timestamps, files read/re-read, context snapshots (`/context`), available token/context/cost metadata, commands/tests, near-misses/rework, documentation churn. Summarize deterministically once per slice boundary and read only the compact summary; do not read large raw logs. Classify findings KEEP / WATCH / CHANGE at slice boundaries; no single productivity score; report unavailable fields as `NOT AVAILABLE`. Watch list (measure, do not assume): `progress-update.ts`, `domain/learning/types.ts`, `submit-answer.ts`, Item Analysis files used as templates, test-fake reuse. The planning session's telemetry was recorded under the Pre-Pilot RUN_ID and is incomplete; do not treat it as Run 009 data.

## 11. Stop Conditions

Stop for Dor if: HEAD/working tree conflicts with the Run-start contract; a §9 gate is unmet; a migration, index, persisted aggregate, or history model is needed; Learning Engine or enum changes are needed; archived-Topic semantics cannot be resolved without inventing behavior (`PLAN_CONFLICT`); privacy needs a decision beyond D1; a hosted action is required; scope pulls in Run 010+ (readiness, Teach Next, semantic misconceptions, realtime, trends); telemetry run-id/capture verification fails (fix tooling separately first).

## 12. Handoff

After completion: report to Dor; close the Run with the canonical protocol (`DEV_STATUS`, Run report, telemetry summary, KEEP/WATCH/CHANGE); add deferred work to the backlog per its rules; do not start Run 010 automatically. Run-close decision to make: the Canonical Consistency Audit found that flat Topics, soft archive, and current-derived `questions.topic_id` semantics have no durable ADR-level home (only the migration comment, D6, and OQ-031) — decide whether to create/consolidate an ADR then. The real-pilot gate remains owned by `docs/PILOT_READINESS.md`.
