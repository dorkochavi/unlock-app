# UNLOCK — ASSESSMENT-ENGINE-NIGHT-001 — Assessment Engine Foundation + Pilot/Q3 Closure Gates (bounded autonomous Run)

PLAN_VERSION: 025
RUN_ID: 2026-10-08-ASSESSMENT-ENGINE-NIGHT-001
START_HEAD: `3cee94b`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `3cee94b`
STATUS: **IN PROGRESS** — local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI call/Google contact.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Make bounded progress on the Assessment Engine direction (ingest ordinary material → blueprint → generate → validate deterministically → instructor authority) and close two Pilot-facing review tracks.
Principle: DETERMINISTIC BY DEFAULT. SEMANTIC AI ONLY WHERE NECESSARY. HUMAN AUTHORITY AT PUBLICATION.
Canonical product/architecture owner: `docs/ASSESSMENT_ENGINE.md` (created by this Run; other docs link to it).

## 2. Invariants
No push/merge/deploy/tag/force; no hosted Supabase or Vercel mutation; no DB migration/schema change; no dependency change; no external AI/Google calls; no auto-publication; no learning-engine/FSRS/scheduler change; structured CSV/JSON import behavior unchanged; no persisted uploads.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Repository discovery: import/authoring flow (read-only) | AUTO | PENDING |
| B | External assessment research | AUTO | PENDING |
| C–G | Design: assessment model, taxonomy, difficulty, distractors, anti-patterns → `ASSESSMENT_ENGINE.md` part 1 | AUTO | PENDING |
| H | Quality linter (design + pure deterministic prototype if architecture allows) | REVIEW_GATE | PENDING |
| I–O | Design: blueprint, duplicates, provenance, pipeline, escalation, evaluation, golden dataset | AUTO | PENDING |
| P–V | Design: ingestion, DOCX/PDF feasibility (dependency gate), Google path, review workspace, feedback loop, cost | AUTO | PENDING |
| W | Pilot UX closure gate (read-only) | AUTO | PENDING |
| X | Q3 a11y/RTL local browser gate | AUTO | PENDING |
| Z | Final review, governance, Run close | FINAL_GATE | PENDING |

## History

- Q3-A11Y-NIGHT-001: `docs/RUNS/2026-10-08-Q3-A11Y-NIGHT-001.md`
- TODAY-LEARNING-RECAP-004: `docs/RUNS/2026-10-07-TODAY-LEARNING-RECAP-004.md`
- VISUAL-POLISH-RUN-003: `docs/RUNS/2026-10-07-VISUAL-POLISH-RUN-003.md`
- DESIGN-REFRESH-OVERNIGHT-002: `docs/RUNS/2026-10-07-DESIGN-REFRESH-OVERNIGHT-002.md`
- (earlier Runs: see `docs/RUNS/**`)
