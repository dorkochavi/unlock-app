# UNLOCK — DESIGN-AUDIT-FOLLOWUP-001 — Evidence-Backed, No-Decision Fixes from Design Audit 001

PLAN_VERSION: 030
RUN_ID: 2026-10-09-DESIGN-AUDIT-FOLLOWUP-001
START_HEAD: `6c5e2cf`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `6c5e2cf`
STATUS: **IN PROGRESS** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/Google contact.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Apply only clear, evidence-backed, low-risk fixes from the SOURCE_ONLY Design Audit 001 (2026-10-09; no rendered pass existed, no rendered claim is made) that need NO human product decision: P2-01 (two unlabeled Topic inputs), P2-02 (instructor error paragraphs bypass the shared `Notice`), DS-01 (`setsPadding` regex lost its backslashes). Prepare a Decision Packet (analysis only) for P2-03 (unsaved-edit navigation loss).

## 2. Invariants
No push/merge/rebase/tag/deploy/force; no hosted mutation; no migration/schema; no dependency change; no AI/Google. Preserve existing messages, visual tone and behavior; no duplicated alerts; no new focus behavior; no broad design churn or token/visual redesign; no change to learner flows. NOT decided autonomously: P2-03 mechanism (beforeunload / router guard / modal / autosave / draft persistence), dark-mode policy, non-manager instructor-link intent, revoked-access navigation semantics, UX-01 gating, large design-system refactor. Assessment Engine untouched.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| B1 | P2-01: accessible names for the two Topic inputs (natural Hebrew via existing message keys) | REVIEW_GATE | PENDING |
| B2 | P2-02: replace the identified plain error/success paragraphs with shared `Notice`, preserving messages/behavior | REVIEW_GATE | PENDING |
| B3 | DS-01: fix `setsPadding` regex (independently confirm defect red→green) + focused tests | REVIEW_GATE | PENDING |
| B4 | P2-03 Decision Packet + route deferred audit items to backlog (no implementation) | AUTO | PENDING |
| Z | Review, verification, Run close | FINAL_GATE | PENDING |

## History

- ASSESSMENT-ENGINE-004: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-004.md`
- ASSESSMENT-ENGINE-HEBREW-REVIEW-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001.md`
- ASSESSMENT-ENGINE-003: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-003.md`
- ASSESSMENT-ENGINE-002: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-002.md`
- ASSESSMENT-ENGINE-NIGHT-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-NIGHT-001.md`
- Q3-A11Y-NIGHT-001: `docs/RUNS/2026-10-08-Q3-A11Y-NIGHT-001.md`
