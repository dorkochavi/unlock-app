# UNLOCK — Master Pilot Countdown

Status: ACTIVE — operational source of truth from 2026-10-10 until Pilot GO.
Load level: WARM. Detail lives in `docs/PILOT_READINESS.md` (gates, protocol) and `docs/RUPPIN_PILOT_CONTENT_INTAKE.md` (content path).

Statuses: `DONE` · `NOW` · `WAITING_FOR_RUPPIN` · `READY_AFTER_CONTENT` · `HUMAN` · `GO_GATE` · `DEFERRED_POST_PILOT`

**Rule:** if a backlog item cannot explain how it advances a Countdown item, it is not pre-Pilot scope.

## P0 — Product foundation
| Item | Status |
|---|---|
| Core learner flow | DONE |
| Learning Engine / FSRS / Today | DONE |
| Instructor Courses / Topics / Questions | DONE |
| Structured Import (JSON/CSV → DRAFT_ONLY) | DONE |
| Progress / Instructor Insights | DONE |
| Minimum backup/DR (restore-proof) | DONE |
| SMTP/Auth | DONE |
| Pilot privacy/operations baseline | DONE |

## P1 — Pilot-focus closure
| Item | Status |
|---|---|
| Lock Ruppin V1 content-entry route (OQ-024) | DONE |
| Freeze Assessment Engine for Pilot (FUB-076 not implemented) | DONE |
| FUB-068 decision (Option B) | DONE |
| FUB-068 implementation (Question Editor unsaved-edit guard + dirty-Publish block; unit evidence only, no browser run) | DONE `c2fcb72` — real-browser check pending in the P4 instructor walkthrough |
| Create intake protocol | DONE |
| Identify exact external dependencies | DONE |

External dependencies (all WAITING_FOR_RUPPIN): (1) real Ruppin source material; (2) a named content owner / instructor reviewer; (3) the target Course/Topic structure and class date.

## P2 — Ruppin content intake and QA
| Item | Status |
|---|---|
| Receive real Ruppin material | WAITING_FOR_RUPPIN |
| Source inventory | WAITING_FOR_RUPPIN |
| Map content to Course / Topics | READY_AFTER_CONTENT |
| Convert to authoring/import drafts | READY_AFTER_CONTENT |
| Preview/import as DRAFT_ONLY | READY_AFTER_CONTENT |
| Verify every answer key against source | HUMAN |
| Hebrew wording review | HUMAN |
| Distractor review | HUMAN |
| Topic + instruction alignment | HUMAN |
| Sufficient published Question pool + margin | READY_AFTER_CONTENT |
| No test/draft/internal content learner-visible | READY_AFTER_CONTENT |
| Instructor/content-owner sign-off | HUMAN |

## P3 — Pilot Release Candidate
| Item | Status |
|---|---|
| Freeze Pilot code/content candidate | READY_AFTER_CONTENT |
| Preview QA | READY_AFTER_CONTENT |
| Final Production deployment | HUMAN |

## P4 — Real rehearsal
| Item | Status |
|---|---|
| iPhone rehearsal | HUMAN |
| Android rehearsal | HUMAN |
| Instructor laptop walkthrough | HUMAN |
| Signup/login/join/Today/answer/resume | HUMAN |
| RTL/mobile/accessibility checks | HUMAN |
| 401 recovery checks | HUMAN |
| Wi-Fi/cellular switch | HUMAN |
| Runtime logs | HUMAN |
| QR/join link | HUMAN |
| Privacy notice (ADR-021; operator presents until UI exists) | HUMAN |
| Backup/operator checklist | HUMAN |
| Production QA/test-data cleanup (Clean Slate reset: audit + dry-run prepared, `docs/PILOT_CLEAN_SLATE_RESET_RUNBOOK.md`; BLOCKED_PENDING_BACKUP, destructive step not executed) | HUMAN |

## P5 — GO / class launch
| Item | Status |
|---|---|
| Content GO/NO-GO | GO_GATE |
| Technical GO/NO-GO | GO_GATE |
| Pilot GO | GO_GATE |

## Deferred (post-Pilot, not in countdown)
`DEFERRED_POST_PILOT`: FUB-076 implementation / v0.5 / H1-H3; in-product PDF/OCR/Google OAuth/AI generation/Material CMS (OQ-023, OQ-038). FUB-068 implementation is done (`c2fcb72`); its real-browser behavior is verified only in the P4 instructor walkthrough.
