# UNLOCK — Ruppin Pilot focus: countdown + content intake protocol

PLAN_VERSION: 046
RUN_ID: 2026-10-10-RUPPIN-PILOT-FOCUS-001
START_HEAD: `384b819`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `384b819`
STATUS: **COMPLETE — STOP.** GOVERNANCE / PILOT-PREPARATION ONLY. No product implementation.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**`.

## 1. Goal

Create the canonical Pilot execution countdown and intake protocol, lock the first Ruppin content-entry path, freeze Assessment Engine expansion for Pilot, and record the approved FUB-068 direction.

## 2. Hard invariants

- no source-code changes; no schema / dependency / API / UI changes
- no hosted mutation; no push / merge / deploy / tag
- no Assessment Engine implementation; no new held-out batch
- no broad backlog cleanup; no unrelated product work

## 3. Human-approved decisions (Dor, 2026-10-10)

- **A. Ruppin Pilot V1 content entry:** the canonical entry is the EXISTING Instructor Authoring and/or Structured Import pipeline; Structured Import enters DRAFT_ONLY; every assessment question + answer key is human-reviewed before Publish; source prep may use external/manual/AI-assisted tooling; no in-product PDF/OCR/Google OAuth/AI provider/AI generator/Material CMS is required for Pilot GO. (OQ-024)
- **B. Assessment Engine Pilot freeze:** current research suffices. FUB-076 stays DESIGNED_PRE_REGISTERED, NOT implemented; H1/H2/H3 unresolved; no v0.5. Promotion only on: decision to wire user-visible assessment lint, an observed real-content problem, or post-Pilot Assessment Engine work. Human Content QA gate is authoritative.
- **C. FUB-068:** Option B (beforeunload + guard editor-controlled internal exits + Publish must not silently publish the saved draft while dirty; save-first or explicit saved-vs-visible state; no localStorage/server autosave). Decision recorded only; NOT implemented.

## 4. Slices

| Slice | Scope | Status |
|---|---|---|
| 1 | `docs/MASTER_PILOT_COUNTDOWN.md` + `docs/RUPPIN_PILOT_CONTENT_INTAKE.md` | DONE |
| 2 | Reconcile OQ-024, FUB-068, FUB-076, PILOT_READINESS, DEV_STATUS, Run report | DONE |
| Z | Verify, commit, close | DONE |

## History

- ASSESSMENT-ENGINE-010: `docs/RUNS/2026-10-10-ASSESSMENT-ENGINE-010.md` (Run report; COMPLETE)
- RUPPIN-PILOT-FOCUS-001: `docs/RUNS/2026-10-10-RUPPIN-PILOT-FOCUS-001.md` (Run report; COMPLETE)
- Earlier Runs: see `docs/RUNS/**` and `git log`.
