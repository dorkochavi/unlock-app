# PILOT-HARDENING-EVIDENCE-001 / Slice E - Pilot Readiness Go/No-Go INPUT Matrix

Run: 2026-10-04-PILOT-HARDENING-EVIDENCE-001. START_HEAD `b8568cb`. Date: 2026-10-04. Docs-only; no `src/` change, no hosted contact.

This is an INPUT matrix for the human launch decision. It is NOT a launch decision, NOT a pilot approval, and does not change the
Content gate (WAITING FOR REAL PILOT MATERIAL, not executed, not PASS) or the Real-pilot gate (NOT YET APPROVED).
Canonical checklist remains `docs/PILOT_READINESS.md` section 3; this reconciles it against repository truth after Slices B-D.

## Classes
- PROVEN_READY: evidence exists and is fresh for the claim.
- HUMAN_CHECK: a person must verify/sign off; the repo cannot prove it.
- EXTERNAL/HOSTED_CHECK: depends on hosted dashboards/services or external material outside the repo.
- OPEN_DECISION: a product/ops decision is unmade.
- ENGINEERING_GAP: repo-doable work is missing.
- DEFERRED_NON_BLOCKER: known, accepted, canonically not a pilot blocker.

Provenance labels: automated local / DB read-only / HUMAN_REPORTED / Preview-Production manual / local-Docker (disposable, no hosted).
"Blocker?" restates what canonical docs say, not a new judgment.

## Matrix

| # | Item | Class | Basis (one line) | Provenance / freshness | Blocker? (per docs) |
|---|---|---|---|---|---|
| 1 | Hosted migrations 15/15 applied, 0 pending/remote-only | PROVEN_READY | `migration list` aligned; H.1/H.3 applied | human-confirmed 2026-10-03 + read-only migration list (QA-CLEANUP I5) 2026-10-03; not re-run 2026-10-04 | no |
| 2 | Technical Go/No-Go (S4: real iPhone+Android, signup/join/Today/answer/retry) | PROVEN_READY | PASS recorded for that baseline | Production manual 2026-09-25 (`v0.1.0`); Production smoke after `v0.2.0` human-confirmed 2026-10-03 | no |
| 3 | Hosted burst (30 learners, pool max 5) | PROVEN_READY | 30/30 ok, Today p95 4.85 s | hosted automated 2026-09-23 (not re-run; protocol says do not rerun unless changed) | no |
| 4 | Backup restore: public schema + data + migration history | PROVEN_READY | restored into disposable PG 17.6; 12/12 table counts exact; 15 migration versions = repo; 25/25 FKs valid; 11/11 courses have an active author | local-Docker 2026-10-04, Slice B report; backup is the point-in-time pre-QA-cleanup snapshot of 2026-10-03 | no (13c technical part) |
| 5 | Auth schema/GoTrue restore; auth-aware restore runbook; repeatable restore script | ENGINEERING_GAP | Auth restore only partial (auth data loaded into text stubs; auth DDL is not in the backup; the `handle_new_auth_user` trigger binding must be recreated from migration `20260923000000`); no runbook or script exists. Repo-doable. Whether it is required for 13c "known recovery path" is a human call | local-Docker 2026-10-04 (B report, Limitations) | undecided (13c wording) |
| 6 | Backup owner, frequency, RPO/RTO targets, retention/encryption of PII dumps | OPEN_DECISION | Human-owned; none defined (FUB-009 narrowed, not closed) | B report recommendation 2026-10-04 | 13c needs "current backup + known recovery path"; RPO/RTO are beyond-pilot per FUB-009 |
| 7 | Supabase plan backup/PITR availability | EXTERNAL/HOSTED_CHECK | Readable only from the Supabase dashboard; do not assume managed guarantees | unverified | informs 13c |
| 8 | `revokeCourseAuthor` last-author invariant under real multi-connection concurrency (FUB-042 7(c)) | PROVEN_READY | 14/14 real-PG tests x4 including negative control; FOR UPDATE serializes; invariant never broke | automated local real-PostgreSQL (opt-in `npm run test:real-pg`) 2026-10-04, commit `1c534df`; local server only, says nothing about hosted | no |
| 9 | FUB-042 7(b): may a mid-flight revoked author complete one revoke? | OPEN_DECISION | Observed invariant-safe stale-snapshot window; semantics undecided; function is unwired to any route | automated local, C report 2026-10-04 | no (reconsider before wiring to a route) |
| 10 | FUB-042 7(a): missing `revoked_at is null` in `revoke()` SQL | DEFERRED_NON_BLOCKER | Unreachable via the use case; cosmetic; tie to OQ-043 C | C report 2026-10-04 | no |
| 11 | OQ-047 author re-grant lifecycle | DEFERRED_NON_BLOCKER | Must be decided before any co-author-management UI; no such UI exists | DEV_STATUS / OQ-047 OPEN | no, until co-author UI |
| 12 | OQ-043 learner revoke/rejoin semantics | DEFERRED_NON_BLOCKER | OPEN, untouched; unresolved semantics fail closed | OPEN_QUESTIONS | not stated as pilot blocker |
| 13 | QA-PREVIEW-A/B archived (non-joinable) | PROVEN_READY | A archived by human via product UI, B already archived; none PUBLISHED; join denial shown by `canSelfJoinCourse` + 22/22 tests, not a live hosted join | DB read-only + HUMAN_REPORTED archive 2026-10-03 (QA-CLEANUP-001) | no |
| 14 | Retained QA data (1 inert QA learner membership, 7 Attempts, 6 progress rows) | DEFERRED_NON_BLOCKER | Kept as evidence; hard delete is a separate human decision; Attempts are immutable | DB read-only 2026-10-03 | no |
| 15 | Earlier QA-SliceB-* data, "Pre-Pilot Burst Test" Course, `burst##` accounts, other QA/test data (item 12) | EXTERNAL/HOSTED_CHECK | Docs do NOT record these as cleaned; item 12 stays open and human-owned. QA-CLEANUP-001 covered only QA-PREVIEW-A/B. The current Course set (8 PUBLISHED, 1 DRAFT, 2 ARCHIVED) is not mapped to names in any doc | not verified; last counts 2026-10-03 | yes (item 12) |
| 16 | App-side `next=` redirect / open-redirect safety | PROVEN_READY | No open redirect, no server redirect, no header-derived origin; allowlist-only `next`; no product code change | automated local, 79 tests, commit `0c12526`, 2026-10-04 | no |
| 17 | Supabase Dashboard Auth URL Configuration (Site URL; Redirect URLs accept `/login?next=` shapes; no broad wildcard; template uses `{{ .ConfirmationURL }}`) | EXTERNAL/HOSTED_CHECK | Dashboard-only; failure mode is fallback to Site URL (join intent lost), not a security hole | D report 2026-10-04; older join-via-confirmation Production-verified 2026-09-25 | non-blocking (DEV_STATUS) |
| 18 | Item 11: Auth email/SMTP capacity decision | OPEN_DECISION | Default sender tightly rate-limited, a 429 seen once; per-IP and custom SMTP state unrecorded; a blocked step is BLOCKED, not GO. Needs a dashboard read (external) then a decision | unrecorded | yes (item 11) |
| 19 | Same-IP multi-learner real-email signup burst | HUMAN_CHECK | Not proven in S4; tied to row 18 | PILOT_READINESS section 4 | part of rehearsal |
| 20 | Item 1: real Ruppin material exists and is imported (validator first) | EXTERNAL/HOSTED_CHECK | Material not expected soon; external dependency | PILOT_READINESS | yes (Content gate) |
| 21 | Item 2: every answer key verified | HUMAN_CHECK | Content owner | not executed | yes |
| 22 | Item 3: Hebrew wording reviewed | HUMAN_CHECK | Content owner | not executed | yes |
| 23 | Item 4: distractors reviewed | HUMAN_CHECK | Content owner | not executed | yes |
| 24 | Item 5: every Question mapped to Topic + instruction | HUMAN_CHECK | Content owner; depends on material | not executed | yes |
| 25 | Item 6: enough published Questions (Today draw + margin) | HUMAN_CHECK | Depends on material | not executed | yes |
| 26 | Item 7: no test/draft/burst/internal content visible from a learner account | HUMAN_CHECK | Must be checked from a learner account on hosted; QA-A/B are archived but whether they or other QA Courses appear to learners is not recorded | not executed | yes |
| 27 | Item 8: instructor/content-owner sign-off (name/date) | HUMAN_CHECK | Not recorded | not executed | yes |
| 28 | Item 9: no re-publish after classroom answering starts | HUMAN_CHECK | Operating rule; no technical lock documented | process | yes |
| 29 | Item 10: no Topic reassignment after answering starts | HUMAN_CHECK | Operating rule; Topic views are current-derived | process | yes |
| 30 | Item 13(a): basic product event evidence | OPEN_DECISION | Answers/joins/plan completion derivable from authoritative records; FUB-023 lists gaps (`today_opened`, unmaintained plan columns); how it is met is "decided when executed" and not recorded | FUB-023 | yes (baseline); method undecided |
| 31 | Item 13(b): runtime/error visibility during class windows | OPEN_DECISION | Vercel Runtime Logs were used in S4; no recorded decision on how this is met for a class window | not recorded | yes (baseline) |
| 32 | Item 13(c): backup/recovery sanity | (pointer) | Technical restore proven (row 4); auth-aware path (row 5), ownership/RPO/RTO (row 6), plan check (row 7) remain. Not counted separately | 2026-10-04 | yes (baseline); partially evidenced |
| 33 | Item 13(d): privacy / data-ownership baseline (OQ-039) | OPEN_DECISION | OQ-039 OPEN: who owns materials, questions, attempts, insights, exports, deletion; what learners are told | OPEN_QUESTIONS | yes (baseline) |
| 34 | Q2-B valid-refresh-token behavior after natural session expiry | HUMAN_CHECK | Unproven | Slice B verification 2026-09-26 | open human gate |
| 35 | Q3 accessibility of login/join/Progress/instructor flows | HUMAN_CHECK | Unexercised | same | open human gate |
| 36 | Q4 authenticated Today timings | HUMAN_CHECK | None recorded (S4 has only ~7 s existing-learner first answer) | same | open human gate |
| 37 | Q5 Vercel failed-build behavior | EXTERNAL/HOSTED_CHECK | Unknown; Vercel behavior/setting | same | open human gate |
| 38 | Q6a `/login` is frameable (framing protection) | OPEN_DECISION | Human decision | same | open human gate |
| 39 | F-14 initial-load failure path, manual | HUMAN_CHECK | Verified by automated tests only; manual not executed | DEV_STATUS | non-blocking |
| 40 | FUB-044 UX candidates + expired-session recovery gaps (401 links lack `next`, etc.) | DEFERRED_NON_BLOCKER | Low severity, confirmed | FUB-044 | no |
| 41 | Concurrent publish of same Question not lock-serialized; `confirmImport` re-check race (FUB-014) | DEFERRED_NON_BLOCKER | Accepted V1 limitations; UNIQUE prevents corruption | DEV_STATUS | no |
| 42 | Hosted TLS (`DATABASE_SSL_CA`) proven only by unit tests | DEFERRED_NON_BLOCKER | Accepted limitation; hosted runs used it, no separate proof | DEV_STATUS | no |
| 43 | Connection strategy / CI-CD hardening (FUB-010, FUB-007) | DEFERRED_NON_BLOCKER | "Not a pilot blocker" per backlog | FUB-010 / FUB-007 | no |
| 44 | Real-Postgres unseen-question behavior; OQ-017 calibration | DEFERRED_NON_BLOCKER | Audited KEEP 2026-10-03; real-PG not proven; OQ-017 DEFERRED | DEV_STATUS | no |
| 45 | F-04b Course ARCHIVED after the plan exists | OPEN_DECISION | DECISION PENDING; conservative temporary rule in place | DEV_STATUS | not stated as blocker |
| 46 | `npm audit` freshness | DEFERRED_NON_BLOCKER | Clean in Run 008; not re-run | DEV_STATUS | no |

## Counts per class
45 classified rows (row 32 is a pointer to rows 4-7):
- PROVEN_READY: 7 (rows 1, 2, 3, 4, 8, 13, 16)
- HUMAN_CHECK: 14 (rows 19, 21-29, 34-36, 39)
- EXTERNAL/HOSTED_CHECK: 5 (rows 7, 15, 17, 20, 37)
- OPEN_DECISION: 8 (rows 6, 9, 18, 30, 31, 33, 38, 45)
- ENGINEERING_GAP: 1 (row 5)
- DEFERRED_NON_BLOCKER: 10 (rows 10-12, 14, 40-44, 46)

## Findings worth stating plainly
- One true ENGINEERING_GAP: no auth-aware restore runbook/script (row 5). It is repo-doable; whether 13c requires it is a human call.
- Nothing in Slices B-D found an application-side defect: restore is sound for public data (B), the revoke invariant holds under real concurrency (C), no open-redirect surface (D).
- Item 12 (burst Course, `burst##` accounts, QA-SliceB-* data) is not recorded as cleaned anywhere; do not assume it is.
- Hosted evidence (rows 1-3) predates this Slice; no hosted contact occurred 2026-10-04.

## Top human actions (ordered by what unblocks the most)
1. Decide OQ-039 (13d) and how 13(a)/(b) are met.
2. Read Supabase Authentication rate limits / SMTP and decide item 11 (row 18); check Redirect URL config (row 17) in the same visit.
3. Read Supabase plan backup/PITR (row 7); name a backup owner, frequency, RPO/RTO (row 6); decide whether an auth-aware restore runbook (row 5) is required for 13c.
4. Clean up or confirm item 12 test data (row 15); then check a learner account for visible test content (row 26).
5. Obtain real Ruppin material; run the content validator; content owner completes items 2-8 and signs.
6. Human gates Q2-B, Q3, Q4, Q5, Q6a and the F-14 manual check (rows 34-39).
7. Optionally decide FUB-042 7(b) (row 9) before any route wires `revokeCourseAuthor`.
