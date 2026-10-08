# UNLOCK — BROWSER-ISOLATION-STUDY-001 — Safe Architecture for Rendered Audits Without Hosted Contact

PLAN_VERSION: 031
RUN_ID: 2026-10-09-BROWSER-ISOLATION-STUDY-001
START_HEAD: `4b28bb9`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `f512a4e`
STATUS: **COMPLETE + STOP** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/Google contact.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Find the smallest safe architecture that lets UNLOCK run browser/rendered audits (Design Audit 001's missing Pass 1) without contacting hosted Supabase, hosted Postgres, Production APIs or any external application service. READ-ONLY / DESIGN-FIRST: map every escape path from BROWSER → NEXT CLIENT → NEXT SERVER → AUTH → DB → EXTERNAL NETWORK; compare options (local Supabase stack, dedicated test Supabase project, full mocked Next/API data layer, PGlite/local-Postgres-backed harness, expanded existing Q3 mocked-browser technique); recommend; define the future rendered Design Audit plan. A prototype is allowed only if it is completely local, needs no dependency, no real credentials, no schema mutation, deterministically blocks hosted network, fails safe, and an independent reviewer agrees; otherwise DESIGN ONLY.

## 2. Invariants
No push/merge/rebase/tag/deploy/force; no hosted mutation; no migration/schema; no dependency change; no AI/Google; never read or print secret values (`.env*`); no dev server, browser or network contact in this study unless a prototype passes the gates above; no product-code change; this is NOT permission to touch hosted state.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| C1 | Architecture map + escape paths + options matrix + recommendation + future rendered-audit plan (design doc) | REVIEW_GATE | DONE |
| C2 | Prototype decision (gated; default DESIGN ONLY) | REVIEW_GATE | DONE |
| Z | Review, verification, backlog routing, Run close | FINAL_GATE | DONE |

## History

- BROWSER-ISOLATION-STUDY-001: `docs/RUNS/2026-10-09-BROWSER-ISOLATION-STUDY-001.md`
- DESIGN-AUDIT-FOLLOWUP-001: `docs/RUNS/2026-10-09-DESIGN-AUDIT-FOLLOWUP-001.md`
- ASSESSMENT-ENGINE-004: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-004.md`
- ASSESSMENT-ENGINE-HEBREW-REVIEW-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001.md`
- ASSESSMENT-ENGINE-003: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-003.md`
- ASSESSMENT-ENGINE-002: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-002.md`
- ASSESSMENT-ENGINE-NIGHT-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-NIGHT-001.md`
- Q3-A11Y-NIGHT-001: `docs/RUNS/2026-10-08-Q3-A11Y-NIGHT-001.md`
