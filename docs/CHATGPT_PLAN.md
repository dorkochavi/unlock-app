# UNLOCK — Pre-Pilot Validation Run

PLAN_VERSION: 001
RUN_ID: 2026-09-23-PRE-PILOT
BASE_HEAD: c5d370b
STATUS: IN PROGRESS — S1, S2 COMPLETE; S3 PASS (2026-09-24); S4 Technical Go/No-Go PASS with recorded accepted gaps (2026-09-25, "S4 Real-Device Evidence #2"); S4 Content Go/No-Go WAITING FOR REAL PILOT MATERIAL (external dependency, NOT executed, NOT PASS); the Pre-Pilot Run stays formally OPEN on Content — technically ready, NOT content-approved, NOT pilot-approved

## 1. Run Goal

Prove that the Ruppin pilot is technically safe enough to run and that UNLOCK can expose one small, trustworthy instructor-facing signal from real learner evidence without expanding into Run 009.

Outcomes:
1. finalize aggregate Item Analysis + privacy semantics;
2. implement the smallest safe current-QuestionVersion Item Analysis for OWNER/INSTRUCTOR;
3. verify classroom-burst behavior and a separate real-device rehearsal;
4. reach independent Technical Go/No-Go and Content Go/No-Go gates.

This is a Pre-Pilot validation Run. It does not replace or renumber product Run 009.

## 2. Run-Start Contract

At Run start verify repository state according to `CLAUDE.md`.

Expected default:
- branch `feature/project-foundation`;
- `HEAD == c5d370b`;
- `docs/CHATGPT_PLAN.md` may be the only expected uncommitted modification;
- working tree otherwise clean.

If HEAD changed, do not silently rewrite BASE_HEAD. If the state is not one of the valid Run-start states in `CLAUDE.md`, report `PLAN_CONFLICT` and stop.

No push. No autonomous hosted schema mutation.

## 3. Pilot Hypotheses

### Learner
Learners will return because Today makes course study quick, easy, and relevant.

Prefer authoritative existing records over duplicate analytics storage.

### Instructor
UNLOCK can expose useful evidence about what the class understands or does not understand that was not easy for the instructor to see before.

Narrow Pre-Pilot question:

> Can existing immutable Attempt evidence produce a useful, privacy-safe Item Analysis during or immediately after classroom use?

This Run does not attempt to prove broader instructor intelligence.

## 4. Fixed Run Decisions

### Correctness
Use persisted `Attempt.isCorrect`; never reimplement grading.

Verified semantics:
- SINGLE_CHOICE: server-evaluated against the frozen QuestionVersion;
- MULTIPLE_CHOICE: exact set equality;
- order irrelevant;
- missing/extra options => incorrect;
- no partial credit.

### Item Analysis scope
Per Course, per Question's current published QuestionVersion, aggregate-only.

Historical Attempts remain valid evidence but older QuestionVersions are excluded from the current-version view.

### Re-publish rule
Once classroom answering begins, do not re-publish pilot Questions unless intentionally accepting a fresh current-version count.

No enforcement feature in this Run; include this in the pilot content checklist.

### Response counting
Count one first accepted Attempt per distinct learner per current QuestionVersion.

Repeated practice must not inflate class counts.

If this conflicts materially with repository reality, report `PLAN_CONFLICT`.

### Pilot privacy/disclosure policy
- aggregate-only;
- no learner names/IDs;
- no learner drill-down;
- no answer-option distribution;
- no misconception labels;
- no individual confidence data;
- minimum active LEARNER memberships in Course: 5;
- minimum distinct responders per Question: 5;
- below threshold: explicit insufficient-data state, not interpreted statistics.

Centralize these rules in one reusable policy location.

These are pilot product/privacy thresholds, not universal legal/statistical claims.

### Wording
Allowed:
- `22 לומדים ענו`
- `13 ענו נכון`
- `9 ענו לא נכון`
- `41% תשובות שגויות`
- `עדיין אין מספיק תשובות להצגת נתון`

Do not label: weak, struggling, problematic, needs review, Teach Next, misconception.

Raw Item Analysis is not Topic interpretation.

### Zero responses
Published/current-version Questions may appear as `0 responses / no data yet`, with no difficulty interpretation.

### Refresh
Manual refresh + visible last-updated time only.

No polling, WebSocket, or Supabase realtime.

### KPI instrumentation
Do not add `today_opened` or a generic event log. Use authoritative records where possible. Deferred gaps remain in Follow-Up Backlog.

### Indexing
Do not add an Attempts analytics index unless measured Pre-Pilot evidence proves a blocker.

## 5. Explicit Non-Goals

Not in this Run:
- learner Progress / Learning Landscape / Learning Pulse;
- UNLOCK Mirror;
- Readiness / Compass / Ring / percentage;
- Class Pulse beyond raw Item Analysis;
- Teach Next / Topic-strength interpretation;
- semantic misconception tagging;
- learner-level instructor analytics;
- Cohort/Class modeling / Cross-Class Lens;
- session-scoped or cross-version analytics UI;
- polling/realtime infrastructure;
- analytics event platform, snapshots, warehouse, persisted aggregates;
- FSRS/NBA/Learning Engine changes;
- AI/PDF work;
- production-scale load infrastructure.

Deferred directions remain owned by `docs/FOLLOW_UP_BACKLOG.md`.

# S1 — Aggregate Privacy Contract

MODE: IMPLEMENT

## Goal
Create the smallest reusable contract that makes instructor aggregate disclosure deterministic and prevents privacy thresholds from being reimplemented in each route/UI.

## Inspect
Start with:
- Course membership / `canAuthorCourse`;
- existing domain/application policy conventions;
- QuestionVersion/Attempt ports;
- current instructor question-list path;
- relevant auth/API rules.

Do not broaden into generic analytics architecture.

## Deliverables
1. One reusable aggregate-disclosure policy/function in the appropriate existing layer.
2. Central thresholds:
   - minimum active learners = 5;
   - minimum distinct responders = 5.
3. Explicit outcomes:
   - eligible;
   - insufficient Course/group size;
   - insufficient Question responses.
4. Focused policy tests.
5. No persistence/schema change.

## Acceptance
- one reusable policy location;
- route/UI does not own thresholds;
- deterministic/pure where practical;
- edge cases covered;
- no learner identity in the contract;
- no unrelated analytics abstraction.

## Risk profile
Domain/application policy; privacy semantics; no DB migration; no HTTP endpoint yet.

# S2 — Minimal Instructor Item Analysis

MODE: IMPLEMENT

## Goal
Expose a Course-scoped, current-QuestionVersion Item Analysis to authorized OWNER/INSTRUCTOR users using existing immutable Attempt evidence.

## Inspect
Use the existing instructor question-list authorization/read path as the closest template. Verify actual paths before editing.

## Required read model
Per published/current Question:
- Question id;
- current QuestionVersion id;
- prompt;
- distinct responder count;
- correct count;
- incorrect count;
- incorrect rate;
- disclosure state;
- read timestamp for last-updated UI.

Counting rule:
> first accepted Attempt per learner per current QuestionVersion.

## Authorization
- authenticated;
- active non-revoked OWNER or INSTRUCTOR membership for Course;
- LEARNER denied;
- fail closed.

Reuse existing authorization predicates.

## Data semantics
- current QuestionVersion only;
- old-version Attempts excluded;
- draft-only Question without current version excluded;
- pending draft + current published version continues to use published current version;
- zero-response current Questions may appear;
- archived Course must not expose the active classroom analytics view.

If archived-Course behavior conflicts with canonical semantics, report `PLAN_CONFLICT`.

## UI
Add the smallest instructor-facing view consistent with current navigation.

Must:
- work in Hebrew/RTL;
- be usable on laptop/projector;
- show manual refresh;
- show last-updated time;
- show neutral raw evidence;
- show insufficient-data state;
- never show learner identity.

Do not create a branded dashboard.

## Acceptance
- authorized OWNER/INSTRUCTOR can view Course Item Analysis;
- LEARNER/unauthorized users cannot;
- current-version-only behavior covered;
- first-attempt-per-distinct-learner behavior covered;
- repeat Attempts cannot inflate counts;
- privacy policy gates disclosure;
- zero-response state correct;
- re-publish/current-version behavior tested;
- no migration or persisted aggregate;
- no learner drill-down or Topic interpretation.

## Risk profile
Auth/security; learner-derived aggregate data; application read model; Postgres aggregate query; instructor UI; RTL/accessibility.

Use canonical risk-based verification/reviewer selection.
A security review is required because this adds an instructor-facing endpoint over learner-derived data.

# S3 — Synthetic Classroom Burst Sanity

MODE: IMPLEMENT / VERIFY

## Goal
Verify the real classroom burst shape is technically plausible without building production load-test infrastructure.

## Scope
Create/use the smallest repeatable harness consistent with repository policy for approximately 20–40 near-simultaneous learners.

Target flow:
1. authenticated learner context;
2. Course join where applicable;
3. first `/today`;
4. first DailyPlan generation/reuse;
5. first answer submission.

Measure at minimum:
- successes/errors;
- basic latency distribution;
- timeouts;
- visible DB/pooler failures.

Do not claim production capacity from this test.

## Hosted boundary
Do not mutate hosted infrastructure autonomously.

If meaningful verification needs hosted users/credentials or another Dor-owned action, prepare the harness/instructions and stop at the manual gate.

## Acceptance
- harness matches intended classroom concurrency shape;
- ~20–40 concurrent learners can be exercised;
- no correctness invariant weakened for throughput;
- output distinguishes application errors, auth/provider friction, latency, and harness limits;
- blockers are documented before pilot.

## Risk profile
Performance/concurrency; Supabase/Postgres pool behavior; DailyPlan generation; answer submission; test tooling.

No broad performance refactor without measured blocker evidence.

## S3 Result — PASS (closed 2026-09-24)

Hosted evidence, 30 learners, Vercel Preview deployment + real Supabase Auth/Postgres
(`scripts/burst/burst-hosted.mjs`; pre-provisioned confirmed test accounts, throwaway
Course "Pre-Pilot Burst Test"; each learner: sign-in → timezone → join → Today ×2
concurrent → one logical answer sent ×2 concurrently). Correctness was identical in both
runs: 30/30 succeeded, no auth failures, no 429, no 5xx, no timeout, no DB/pooler failure,
duplicate-answer pairs within the accepted rule (200+200 or 200+409
`ITEM_ALREADY_RESOLVED`/`SUBMISSION_ID_REUSED`; FUB-025).

| Metric (ms unless noted) | `DATABASE_POOL_MAX=1` | `DATABASE_POOL_MAX=5` |
| --- | --- | --- |
| Auth p50 / p95 / max | 540 / 956 / 995 | — |
| Timezone p50 / p95 / max | 2103 / 2224 / 2235 | — |
| Join p50 / p95 / max | 867 / 1618 / 1699 | — |
| Today p50 / p95 / max | 15477 / 18897 / 19740 | 3065 / 4850 / 4866 |
| Answer p50 / p95 / max | 11083 / 14661 / 15974 | 2109 / 3182 / 3288 |
| Wall clock | 37.3 s | 10.1 s |
| vs. guidance (Today/Answer p95 ≤ ~5 s, max ≤ ~15 s) | **not met** | **met** |

Diagnosis (read-only investigation): SQL execution is fast (`pg_stat_statements`: 0.04–0.9 ms
per statement); no cross-learner lock contention; the primary bottleneck was connection
queueing behind the per-instance `pg.Pool(max:1)` under concurrent requests. Today (~15
sequential statements) and Answer (~13) are chatty, but no refactor was needed to pass —
deferred as FUB-026. The harness doubles Today and Answer requests, so these figures
overstate a real class's load.

**Decision: hosted `DATABASE_POOL_MAX=5`** (default in code stays 1; valid range 1–10;
`DATABASE_SSL_CA` required on hosted). Local synthetic evidence (real Postgres, 30–40
learners, both pool shapes, one plan/one Attempt/one completed item per learner) is in
Git (`supabase/tests/burst/`, `npm run test:burst`).

Supporting commits: `627dc92` harness, `eb1f504` create-course script, `755eb72` hosted TLS
fix (CA contents via `DATABASE_SSL_CA`), `7c5d135` duplicate-answer semantics,
`96a2a42` FUB-025, `696ea66` `DATABASE_POOL_MAX`.

Limits of this evidence: one client machine/IP, 30 learners (40 not run), Preview
deployment, accounts pre-confirmed (signup, email confirmation and provider rate limits are
NOT proven — S4), no real mobile network/devices/RTL (S4). Test data (throwaway Course,
`burst##` users and their rows) remains in the hosted project until Dor cleans it up.

# S4 — Real-Device Rehearsal + Pilot Go/No-Go

MODE: VERIFY / MANUAL GATE

## Goal
Validate the actual classroom experience on real phones and close independent Technical and Content gates.

This Slice requires human/manual evidence.

## A. Real-device rehearsal
Use multiple real phones where practical.

Exercise:
- QR/link;
- signup/login;
- email confirmation if required;
- Course join;
- Today load;
- answer submission;
- mobile layout;
- Hebrew/RTL;
- Wi-Fi/cellular reality;
- instructor Item Analysis refresh.

Record friction/failures and approximate time-to-first-answer.

## B. Technical Go/No-Go
GO requires no unresolved critical blocker in:
- QR/join;
- auth/signup;
- first Today;
- first answer;
- DailyPlan creation;
- Item Analysis authorization/privacy;
- classroom burst sanity;
- mobile/RTL usability.

A known non-critical issue may be accepted only if explicitly recorded.

## C. Content Go/No-Go
Independent from Technical GO.

Before pilot:
- instructor signs off on actual Course;
- answer keys correct;
- Hebrew wording clear;
- distractors reasonable;
- Questions match instruction;
- coverage sufficient;
- intended Questions published;
- no accidental test/draft/internal content exposed;
- no re-publish after classroom answering starts.

## D. Pilot success signals
Do not invent a hard statistical success threshold from one pilot.

Record at minimum:

### Activation
- learners present;
- learners successfully joined;
- learners reaching at least one accepted answer during onboarding;
- major technical-friction count/reasons.

### Repeat behavior
After the observation window:
- learners completing Today on 3 distinct days in a week, derived from authoritative DailyPlanItem evidence.

### Instructor value
Capture explicit evidence:
- did Item Analysis reveal something not immediately known?
- did it change what the instructor wanted to discuss/revisit?
- does the instructor want to use UNLOCK again?

These are pilot learning signals, not production KPI claims.

## Acceptance
- real-device rehearsal completed;
- Technical Go/No-Go explicit;
- Content Go/No-Go explicit;
- pilot signal capture method clear;
- unresolved blockers not hidden;
- if either gate is NO-GO, stop and address only the blocker before the class.

## Risk profile
Manual/browser E2E; real auth; mobile/RTL; content quality; human pilot readiness.

## S4 Preliminary Pre-Check (2026-09-24) — NOT the rehearsal; S4 remains PENDING

A preliminary real-device pre-check was attempted. It is recorded as evidence only; it
does not satisfy any S4 acceptance item and neither Go/No-Go gate has a result.

Observed (iPhone 16 Pro Max, Chrome, Wi-Fi):
- real signup succeeded; the confirmation email arrived in about 1.5 s;
- the confirmation URL redirected to `http://localhost:3000`, so the phone hit
  `ERR_CONNECTION_REFUSED`;
- the account was nevertheless confirmed, and a manual login afterwards succeeded;
- the original Course join had NOT happened (the join-return flow was lost); Courses was
  empty, and Today showed its legitimate no-items state because there was no membership;
- the question/answer flow was therefore not meaningfully exercised. Today itself is NOT
  classified as failed from this evidence.

**Blocker (app-side RESOLVED LOCALLY, hosted/manual verification PENDING):** signup
confirmation redirect target and join-return flow. The app now passes
`emailRedirectTo=<origin>/login?next=…` (FUB-027, `docs/FOLLOW_UP_BACKLOG.md`), so join
intent survives email confirmation. This is NOT verified on hosted infrastructure or a real
phone: the hosted Supabase Site URL / redirect allow-list is a human-owned dashboard check.
S4 cannot proceed until a new learner can sign up on a real phone, confirm by email, and
land back on the join flow of the deployed URL.

**Local hardening since the pre-check (current status: `docs/DEV_STATUS.md` and
`docs/RUNS/2026-09-24-OVERNIGHT-PREPILOT.md`; not S4 evidence).** F-12, F-13, F-14 and
F-04a are resolved locally; F-12, F-13 and F-14 still need manual UI verification. F-01 is
mitigated, not resolved. F-02 (Item Analysis small-n differencing) and F-04b (Course
archive after plan generation) are decision-pending and unchanged. Manual QA is not
complete; S4 remains NOT COMPLETE until the real rehearsal and both Go/No-Go gates run.

## S4 Real-Device Evidence #1 (2026-09-25) — partial rehearsal (historical; Technical gate and F-13/F-14 statuses superseded by Evidence #2 below)

One real phone, private/incognito browser, hosted Production deployment
(`https://unlock-app-pied.vercel.app`), fresh learner account, published self-join Course.
Human-confirmed flow: join link → join page → sign-up → confirmation email (~1 s) → tapped
confirmation link → returned to browser/login → logged in → Today with real questions →
Course visible in Courses → several questions answered (correct and incorrect) → UI showed
"נכון" / "לא נכון" with a Continue/המשך action → Continue advanced to the next question.

Recorded as verified (current Pre-Pilot scope):
- **FUB-027** — HOSTED + MANUAL VERIFIED, RESOLVED. Hosted Site URL / redirect allow-list
  behaved correctly on the real flow (implied by the successful return; dashboard values were
  not separately recorded).
- **F-12** — MANUAL UI VERIFIED, RESOLVED. Contract verified: the answered item stays visible
  with a correctness state + Continue, and Continue advances. This is not a detailed
  pedagogical-explanation claim.
- F-13 and F-14 states were NOT exercised; they stay RESOLVED LOCALLY, PENDING MANUAL UI
  VERIFICATION.

Earlier diagnostics (unchanged, not blockers): `/join/<id>` → `/login?next=/join/<id>` works;
authenticated join needs an explicit second Join click; a prior signup hit Supabase Auth 429
email rate limiting — an external platform limit, not an app defect (see Technical risk below).

**Gate status after this evidence**
- Technical Go/No-Go: NOT YET COMPLETE. Proven now: link join (QR scan not separately recorded), signup, email
  confirmation, login, membership, Today, first answer, correct+incorrect path, feedback +
  Continue, Courses visibility on one phone. Still unexecuted per the protocol: ≥2 physical
  devices, both Wi-Fi and cellular, double-tap/refresh/resume, network switch, structured RTL
  check, instructor Item Analysis refresh and privacy/authorization checks on device,
  Runtime Log review, time-to-first-answer record.
- Content Go/No-Go: NOT YET COMPLETE / NOT EXECUTED. The Course having questions is not
  content sign-off. No instructor/content-owner sign-off, answer-key, Hebrew, distractor,
  alignment, coverage or no-test-content verification is recorded; the offline validator
  (`docs/PILOT_CONTENT_VALIDATOR.md`) has no recorded run on the real material.
- Technical risk (operational, not an app defect): Supabase Auth email rate limiting (429)
  can BLOCK class signups. Per the protocol this is BLOCKED (not GO) if it stops a step; custom
  SMTP status and per-IP limits are not recorded and must be decided before a 5+ learner
  classroom rehearsal.

## S4 Real-Device Evidence #2 (2026-09-25) — Technical Go/No-Go PASS; Content WAITING

Human-observed Production evidence (`https://unlock-app-pied.vercel.app`). Supersedes the
"Gate status" bullets of Evidence #1 for the Technical gate (Evidence #1 is kept as history).

| Criterion (protocol / Technical GO list) | Result | Evidence / scope |
| --- | --- | --- |
| ≥2 physical devices | PASS | first real phone (model not recorded in this evidence) + Android |
| QR/link join | PASS | join URL shown as QR, scanned on a physical phone; correct URL/flow, no redirect/layout issue |
| Signup + real email confirmation | PASS | device 1 only (fresh learner, private browser; email ~1 s); not repeated on Android |
| Login → membership → Today with questions → Courses shows Course | PASS | device 1 |
| First answer; correct + incorrect; "נכון"/"לא נכון" + Continue → next | PASS | device 1 (F-12) |
| Wi-Fi and cellular; Wi-Fi→cellular switch; navigation | PASS | Android |
| Refresh inside Today (same place); app resume after app switch | PASS | Android |
| Double-tap on answer / on Continue: no duplicate behaviour | PASS | Android |
| Hebrew/RTL + mobile usability | PASS (limited) | Android: Hebrew correct, buttons usable, no broken layout; structured per-screen RTL checklist not separately recorded |
| F-13 (no dead self-join link when policy is not OPEN) | PASS | OPEN → AUTHORIZED_ONLY: join/share link disappeared |
| F-14 (answer-submit failure + retry only; original initial-load bug is RESOLVED LOCALLY via tests, its manual verification NOT EXECUTED) | PASS (submit path) | airplane mode → submit → "לא ניתן היה לשלוח את התשובה. נסו שוב" → network restored → resubmit succeeded. App-level request failure/retry only; not a full-page offline reload |
| Instructor Item Analysis (direct URL): loads, questions, insufficient-data states, aggregates where enough responses, Refresh | PASS | owner/instructor |
| Item Analysis authorization denial | PASS | learner denied ("אין לך הרשאה לצפות בניתוח התשובות של קורס זה"). Signed-out rejection not manually recorded (covered by S2 tests/security review) |
| Item Analysis privacy | PASS via S2 tests + security review | manual visual check of "no names/emails/per-option/'weak' wording" not separately recorded — accepted non-critical gap |
| Runtime Logs | PASS | Vercel Production: 0 warning/error/fatal, no 5xx/timeout/exception; one 403 = the intentional denial test; pg pool max=5, no queue issue observed |
| Time to first answer | RECORDED | existing learner, login → Today → first answer ≈ 7 s or less (observed, not a benchmark or guarantee); scan→first-answer for a brand-new learner not timed |
| DailyPlan creation; classroom burst sanity | PASS | S3 (Preview, 30 learners, pool max 5); not re-run (per protocol) |

**TECHNICAL GO/NO-GO: PASS.** No unresolved critical blocker in the Plan's list. Accepted
non-critical gaps (recorded here as the Plan requires): signup/email confirmation exercised
on one device only; structured RTL checklist not itemised; signed-out Item Analysis rejection
and the manual privacy visual check not recorded (test-covered); the Wi-Fi/cellular matrix
exercised on Android only; no multi-learner same-IP signup burst with real email (see
operational risk).

**Operational pilot risk (not an app defect, not a Technical blocker):** Supabase Auth email
sending/rate limits (one 429 seen during an earlier signup attempt) and SMTP capacity for a
class-sized cohort. Custom-SMTP status and per-IP limits are unrecorded; decide before the
real pilot. Under the protocol it is BLOCKED (not GO) if it stops a step.

**CONTENT GO/NO-GO: WAITING FOR REAL PILOT MATERIAL — NOT EXECUTED (external dependency).**
Real Ruppin pilot content is not available and not expected soon. Nothing below is checked;
no sign-off exists; the offline validator has not been run on real material.
Deferred checklist, to run when material arrives (existing criteria only, no new gates):
1. Real pilot material exists and is imported (`docs/PILOT_CONTENT_VALIDATOR.md` run on it first).
2. Every answer key verified against the material.
3. Hebrew wording reviewed.
4. Distractors reviewed.
5. Every Question mapped to a Topic and to the instruction.
6. Enough published Questions (a learner's Today draw plus margin).
7. No test/draft/burst/internal content visible from a learner account.
8. Instructor/content-owner sign-off recorded (name/date).
9. No re-publish after classroom answering starts.

**Formal Pre-Pilot status:** Run-level acceptance items 5–6 are not both met (Content not
evaluated), so the Run stays OPEN. The system is technically ready, NOT content-approved and
NOT pilot-approved. Content is a PRE-PILOT RELEASE GATE (mandatory before the real class); it
is not a product-development gate: nothing in this Plan or `CLAUDE.md` requires product
development to stop while Content is externally blocked. Run 009 still requires its own new
Plan from Dor (§8) and is not started here. This does not approve the pilot.

**Pilot UX follow-ups (not blockers; FUB-028, FUB-029):** Item Analysis is reachable by direct
URL but not discoverable from the normal instructor Course UI; Publish validates persisted
state, so a correct answer selected but not saved gives "correct answer must be selected".

## S4 Rehearsal Protocol (exact checklist)

S4 is a human rehearsal on the deployment intended for the pilot. Record everything in a
short evidence note (template at the end). The two gates are independent.

### Not re-tested (S3 already proved; re-test only if something changed)
Concurrency correctness (one plan / one Attempt per learner, duplicate opens and submits),
30-learner latency at `DATABASE_POOL_MAX=5`, hosted TLS/CA connection, join/Today/answer
request paths under load, SQL performance. Do NOT run another synthetic burst for S4.

### Preparation (before anyone touches a phone)
1. **Target and config.** Rehearse on the deployment the pilot will use, with
   `DATABASE_POOL_MAX=5` and `DATABASE_SSL_CA` set; note its URL and commit. Record that
   both variables are present (names only).
2. **Supabase dashboard.** Authentication → Rate Limits: record the sign-up/sign-in per-IP
   limit. Authentication → Email: record whether custom SMTP is configured — the default
   built-in sender is very tightly rate-limited (about 2 emails/hour), which can block class
   signups. If it is not custom, decide before the rehearsal (custom SMTP, or a smaller
   rehearsal) and record it as a Technical risk.
3. **Vercel.** Production/pilot URL reachable without Vercel login (Deployment Protection
   off for it); Runtime Logs open.
4. **Course.** Create the REAL rehearsal Course through the instructor UI (or use the pilot
   Course only if Content gate below is already signed off): PUBLISHED, join policy OPEN,
   Topics set, real published Questions. Not the throwaway burst Course.
5. **Join link + QR.** Copy the join link from the Course page (`/join/<courseId>`), generate
   a QR code for it, print or display it on a screen.
6. **Devices/networks.** At least 2 physical phones (prefer 1 iPhone + 1 Android), each with
   Wi-Fi and cellular available; a laptop for the instructor (projector if possible). Fresh
   student accounts: real email addresses for at least 2 learners (5+ if you want to see
   Item Analysis; it needs ≥5 active learners and ≥5 responders per Question).
7. **Cleanup awareness.** Decide what happens to the throwaway burst Course and `burst##`
   users (archive Course; optional SQL cleanup — Dor-owned).

### Student rehearsal script (each phone; run once on Wi-Fi, once on cellular)
Start a timer at "scan".
1. Scan the QR (and once, open the link from a message app). Record: lands on join page?
2. Signed out → you should be sent to sign-up/login and back to the join page afterward.
3. Create a new account with a real email (Wi-Fi run) / log in with an existing one
   (cellular run). Record email arrival time if confirmation is required; confirm; return.
4. Join the Course (OPEN policy → immediate). Record: any confusing wording.
5. Open Today. Record time from scan to first question visible.
6. Answer the first question; observe correct/incorrect feedback. Record time to first answer.
7. Repeat/double interaction: on the next question, double-tap the answer/submit control
   quickly; then refresh the page mid-answer; then open Today in a second tab. Expected:
   no error page, no duplicate answer, item shows resolved once, plan identical.
8. Finish the plan, note the completion state. Kill the app/browser, reopen the same link:
   session persists, Today resumes the same plan.
9. Switch Wi-Fi → cellular (or airplane-mode blip) mid-session; reload Today; record
   recovery and any error text.
10. Hebrew/RTL check on every screen visited (join, login/signup, Today, feedback, completion):
    text direction, alignment, mixed Hebrew/number/Latin, no clipped or overlapping text,
    tap targets usable one-handed, keyboard does not hide the submit control.
11. Progress: there is NO Progress screen yet (Run 009). Confirm the learner navigation
    shows no dead or broken Progress link. This is N/A, not a failure.

### Instructor rehearsal script (laptop; ideally while 5+ students answer)
1. Log in; open the Course; confirm status PUBLISHED, join policy OPEN, Topics visible, all
   intended Questions PUBLISHED and no DRAFT/test Question is visible to learners.
2. Show the join QR/link; watch memberships arrive (students joining).
3. Announce a **group answering window** (for example 3 minutes; every student answers the
   same Question(s)). Do NOT refresh Item Analysis while answers trickle in.
4. After the window closes, open Item Analysis (`Course → ניתוח תשובות לפי שאלה`) and refresh
   once. Record the responder counts, the incorrect-rate bucket, the last-updated time, and
   the insufficient-data message for Questions with fewer than 5 responders. Item Analysis is
   NOT a per-answer live scoreboard; if the instructor starts refreshing after each answer,
   stop and record it.
5. Privacy checks: no student names, emails or IDs anywhere; no per-option distribution; no
   "weak"/"struggling" wording; a learner account cannot open the Item Analysis URL (403 /
   not-authorized page); signed-out request is rejected.
6. Record instructor value evidence: did it reveal something not immediately obvious; did it
   change what they would revisit; would they use UNLOCK again?
7. Instructor manages nothing else mid-rehearsal (no re-publish of Questions once answering
   begins).

### Wi-Fi vs cellular
- **Wi-Fi (classroom-like, shared IP):** signup/login and email confirmation with several
  people at once, join, Today, answer, Item Analysis; watch for auth rate-limit messages or
  slow email.
- **Cellular:** login, first Today load and first answer latency, reload/resume, switching
  networks, error messaging on a weak signal.

### Evidence to record (per device)
Device/OS/browser, network, URL and commit, scan→first-question seconds, scan→first-answer
seconds, email delay (if any), each failure or confusing moment with a screenshot,
RTL/layout defects, the double-tap/refresh outcome, and the Vercel Runtime Log errors during
the session (count and codes only). Instructor: counts shown, refresh time, privacy checks.

### TECHNICAL GO / NO-GO
- **PASS (GO):** on at least 2 physical devices, both networks: signup/login (with real email
  confirmation), QR/link join, Today, answer, resume, and the double/refresh test all work;
  RTL/mobile usable; no auth/privacy/security defect; Item Analysis authorization and privacy
  checks pass; no unrecorded 5xx in Runtime Logs; time to first answer is acceptable to the
  instructor (record it; no invented threshold).
- **FAIL (NO-GO):** any of: cannot sign up/log in; join or Today broken; answer lost or
  duplicated; auth/privacy leak; unusable RTL; repeated 5xx/timeouts.
- **BLOCKED:** cannot complete a step for a reason outside the app that stops the rehearsal
  (email not delivered because of SMTP limits, Vercel Deployment Protection, device
  unavailable). Record it; it is not a GO. Resolve, then repeat only the blocked steps.
- A known non-critical issue may be accepted only if written into the evidence note.

### CONTENT GO / NO-GO (independent; content owner signs)
Checklist: real pilot material exists; every answer key verified against the material;
Hebrew wording reviewed; distractors reviewed; every Question mapped to a Topic and to the
instruction; enough published Questions for the rehearsal/pilot (at least the number a
learner's Today draws, plus margin); no test, draft, burst or internal content visible to a
learner; the Course-level view a learner sees was checked from a learner account; no
Question re-published after answering starts.
- **PASS:** every box checked and the instructor/content owner records sign-off (name/date).
- **FAIL:** any wrong key, unclear Hebrew, misaligned Question, or visible test/draft content.
- **BLOCKED:** material or reviewer unavailable.

### Evidence-note template
`Target: … commit … | Devices/networks: … | Technical: GO/NO-GO/BLOCKED (reasons) |
Content: GO/NO-GO/BLOCKED (owner, date) | First-answer times: … | Defects: … | Accepted
non-critical issues: … | Item Analysis: counts/refresh/privacy result | Runtime Log errors: …`

## 6. Run-Level Acceptance

Complete only when:
1. S1 privacy semantics implemented and verified.
2. S2 Item Analysis implemented and security-reviewed under current policy.
3. S3 burst evidence exists, or explicit Dor-owned hosted/manual gate is completed.
4. S4 real-device rehearsal completed.
5. Technical Go/No-Go explicit.
6. Content Go/No-Go explicit.
7. no Run 009+ feature pulled into scope.
8. `docs/DEV_STATUS.md` reflects only durable changed truth.
9. Run Report records evidence and remaining limitations.
10. Git state reconciled under canonical Run Completion Protocol.
11. Claude has not pushed.

## 7. Stop Conditions

Stop for Dor instead of improvising if:
- HEAD/working tree conflicts with BASE_HEAD semantics;
- Item Analysis requires migration or new aggregate persistence;
- first-attempt-per-distinct-learner conflicts materially with Attempt model;
- authorization cannot reuse existing Course management semantics;
- privacy requires a product/legal decision beyond this Plan;
- hosted mutation is required;
- burst test exposes a redesign-level bottleneck;
- Content Go/No-Go needs instructor input;
- implementation would pull Run 009 features forward.

Use `PLAN_CONFLICT` when repository reality contradicts the Plan.

## 8. Handoff

After completion:
- do not start Run 009 automatically;
- report Technical and Content gate results to Dor;
- preserve newly discovered deferred work only if it meets existing Follow-Up Backlog rules;
- wait for explicit Run 009 planning.

Run 009 remains a separate product Run.
