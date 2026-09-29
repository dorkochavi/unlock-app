# UNLOCK — Run Report: 2026-09-29-GOVERNANCE-RECONCILE-001

Run: `2026-09-29-GOVERNANCE-RECONCILE-001`
Status: COMPLETE (governance docs only)
Baseline (START_HEAD): `9019796`
Last verified content commit: `1d9328a` (the Run-close commit sits above it; derive its hash from Git)
Branch: `feature/run-010-learning-intelligence` (not pushed)

## 1. Goal
Lossless reconciliation of `docs/FOLLOW_UP_BACKLOG.md`, `docs/OPEN_QUESTIONS.md` and
`docs/archive/FOLLOW_UP_BACKLOG_CLOSED.md` so each obeys its own lifecycle: Backlog = deferred executable work in the
canonical vocabulary; Open Questions = unresolved decisions only; resolved/historical detail = archive / Run reports.
Not a Product Run, not Run 011, no product decision made.

## 2. Commits
| Step | Commit | Result |
|---|---|---|
| 1 | `aee98d9` | Plan identity; ad-hoc Backlog statuses (`LATENT`, `UX WATCH`, `RECORDED`, promoted-to-inactive-Run) normalized to `DEFERRED` with the old label kept in the body; stale V1.2 framing removed |
| 2 | `1d9328a` | Ownership moves + new OQs (below); independent `unlock-reviewer` pass: no blocking findings |
| 3 | Run-close commit | this report; Plan `RUN_STATUS: COMPLETE` |

## 3. What Moved
- **New OQ-046** — date-only `exam_date` interpretation (UTC-midnight parse; learner calendar/learning day?). Split from
  OQ-002, which stays focused on exam-date source hierarchy. Gates the Product Fix for exam-day urgency.
- **New OQ-047** — CourseAuthor grant / re-grant / reactivation lifecycle (distinct from learner OQ-043), plus the
  last-manager residue moved from OQ-043 B. Former FUB-042 item 4 (number kept as a pointer).
- **New OQ-048** — answer-submission idempotency identity vs server-generated `answeredAt`. Moved from FUB-025.
- **Archived** (closed as backlog items; underlying decisions NOT resolved): FUB-025 -> OQ-048; FUB-040 -> OQ-017 and
  OQ-018; FUB-039 audit resolved, residual calibration interaction stays open in OQ-044.
- **Narrowed**: FUB-034 (tier-crossing gap only), FUB-041 (open `topicId` residual, ready for Product Fix promotion),
  FUB-042; OQ-002/017/018/024/029/031/038/043/044.
- `docs/DEV_STATUS.md`: Pre-push A/F/G pointers only.

## 4. OQ-045
Untouched and still OPEN: the ARCHIVED author self-enrollment decision (join-policy restriction vs lifecycle stop) is a
human decision gate; not resolved here.

## 5. Verification
- Docs only: `git diff --name-only 9019796..HEAD` lists only `docs/**`; no `src/**`, tests, migrations, `.claude/**`.
- Status vocabulary: active Backlog items all `DEFERRED`; OQ statuses only OPEN / DEFERRED / CALIBRATION.
- Cross-references: FUB-025/039/040 references resolve to the closed-items index or archive; OQ-046..048 unique.
- `git diff --check` clean; no stale current-Plan `S1/S2` pointer; remaining "owned by Run 011" text sits only in quoted
  historical qualifiers marked non-current.
- Independent review (Commit 2): no blocking findings. Non-blocking: OQ-047 paragraph wrapping is awkward; OQ-045's
  heading says "(ARCHIVED)" while Status is OPEN (pre-existing, out of scope).

## 6. Process notes
- The Plan was briefly rolled back in the working tree to the closed DEVOS-V1.3 identity by an interrupted worker; it was
  restored from `aee98d9` in this Run. Telemetry for early events of this work sits under the DEVOS-V1.3 folder.
- No runtime code, tests, migrations, hosted state or push. Run 011 not started.

## 7. Open items handed on (not started)
Run 010 Product Fix / reconciliation: OQ-046 decision then exam-day urgency fix (pre-push), OQ-045 human decision,
FUB-041 `topicId` test/mapping triage, FUB-042 item 1 before any route wiring, FUB-043 naming. Then manual/hosted QA,
release planning (H.1 -> app cutover -> H.3), and only then a push/merge decision.
