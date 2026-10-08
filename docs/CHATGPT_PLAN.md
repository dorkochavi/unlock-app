# UNLOCK — ASSESSMENT-ENGINE-HEBREW-REVIEW-001 — Apply Dor's Hebrew Review + Calibration Recheck

PLAN_VERSION: 028
RUN_ID: 2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001
START_HEAD: `2c0b053`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `09e42a5`
STATUS: **COMPLETE + STOP** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI call/Google contact.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Apply Dor's 17 human Hebrew-review decisions (12 APPROVED, 5 CHANGE) to the Golden Dataset, regenerate calibration, resolve FUB-060 truthfully, reassess integration readiness. Small, bounded Run.

## 2. Invariants
No push/merge/rebase/tag/deploy/force; no hosted mutation; no migration/schema; no dependency change; no AI/Google; linter not wired; no new heuristics unless strictly required (default: document disagreements as KNOWN_MISS/KNOWN_FALSE_POSITIVE/SEMANTIC_EXPECTATION); no Blueprint/OQ-050 work; no new Skill.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| H1 | Apply 5 CHANGE fixtures + record 12 APPROVED (HUMAN_APPROVED: Dor, 2026-10-08) | REVIEW_GATE | DONE |
| H2 | Regenerate calibration, delta, disagreements, FUB-060, readiness recheck | REVIEW_GATE | DONE |
| Z | Review, verification, Run close | FINAL_GATE | DONE |

## History

- ASSESSMENT-ENGINE-HEBREW-REVIEW-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001.md`
- ASSESSMENT-ENGINE-003: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-003.md`
- ASSESSMENT-ENGINE-002: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-002.md`
- ASSESSMENT-ENGINE-NIGHT-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-NIGHT-001.md`
- Q3-A11Y-NIGHT-001: `docs/RUNS/2026-10-08-Q3-A11Y-NIGHT-001.md`
