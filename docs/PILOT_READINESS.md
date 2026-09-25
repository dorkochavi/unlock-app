# UNLOCK — Pilot Readiness

Status: ACTIVE (operational source of truth for the still-open real-pilot gate)

Load level: COLD

Purpose: hold the durable, reusable truth for starting the real Ruppin pilot, so it does not live in the current Run Plan (`docs/CHATGPT_PLAN.md`) or grow inside `docs/DEV_STATUS.md`.

This file is not a Run report and not the current execution plan. Historical evidence lives in `docs/RUNS/**` and Git.

## 1. Current Status (2026-09-25)

| Gate | Status |
| --- | --- |
| Technical Go/No-Go | **PASS** (Pre-Pilot S4, Production, real phone + Android; accepted gaps recorded in the Pre-Pilot Run report) |
| Content Go/No-Go | **WAITING FOR REAL PILOT MATERIAL** — NOT EXECUTED, NOT PASS (external dependency; material not expected soon) |
| Real pilot | **NOT YET APPROVED** |

The Pre-Pilot Run (`2026-09-23-PRE-PILOT`) stays formally open on Content only. Content is a **pre-pilot release gate**; it does not block independent product development (Run 009).

Run 009 (learner Progress + instructor Insights) is COMPLETE and Preview-verified (`docs/RUNS/2026-09-25-009.md`). It is not a gate and not a pilot approval, and its behavior is not claimed to be deployed to Production here.

## 2. Environment / Release Model

UNLOCK is ONE application and ONE codebase; there is no separate pilot app. The pilot is the first controlled use of the same Production application, which remains the live app afterwards.

- **Local** — development, tests, Claude-assisted work, safe experimentation.
- **Vercel Preview** — browser/manual verification before release.
- **Production** (`https://unlock-app-pied.vercel.app`) — the one live application.

No permanent Staging today. Revisit Staging / Supabase Preview Branches / a dedicated Staging project on: more developers, higher release frequency, more complex schema/Auth changes, destructive-DB-testing risk, or production-data safety concerns. Production data is protected: no destructive development experiments on the Production DB. Git direction: `feature/project-foundation` is the active branch; long term `main` should represent released Production state (not migrated now).

Hosted configuration that must remain: `DATABASE_SSL_CA` set; `DATABASE_POOL_MAX=5`.

## 3. Remaining Before the Real Pilot

1. Real Ruppin pilot material exists and is imported (run `docs/PILOT_CONTENT_VALIDATOR.md` first).
2. Every answer key verified against the material.
3. Hebrew wording reviewed.
4. Distractors reviewed.
5. Every Question mapped to a Topic and to the instruction.
6. Enough published Questions (a learner's Today draw plus margin).
7. No test/draft/burst/internal content visible from a learner account (check from a learner account).
8. Instructor/content-owner sign-off recorded (name/date).
9. No re-publish of Questions after classroom answering starts.
10. No Topic reassignment after classroom answering starts (Run 009 Topic views are current-derived: a reassigned Question's history appears under its new Topic).
11. Supabase Auth email/SMTP capacity decision (default sender is very tightly rate-limited; a 429 was seen once; per-IP and custom-SMTP state unrecorded). Under the rehearsal protocol, a step blocked by this is BLOCKED, not GO.
12. Production QA/test-data cleanup (throwaway "Pre-Pilot Burst Test" Course, `burst##` accounts, QA learners/courses/questions) — human-owned hosted action.

Note (dependency, not a new gate): the F-02 privacy contract (Run 009 D1) is IMPLEMENTED in Run 009 S3 (`aa9f858`) and Preview-verified; **Production deployment is not verified in this document**. Until the pilot deployment runs S3, its Item Analysis still shows the responder count and rounded rate; if the real pilot starts before S3 is deployed there, that is a conscious human decision (operating rule: refresh only after a group answering window). Once deployed, confirm on the pilot URL that the analysis page shows only descriptive bands or the insufficient-data state, then update this note.

## 4. Technical Evidence Pointer

Do not duplicate historical evidence here. Sources:
- `docs/RUNS/2026-09-23-PRE-PILOT.md` (addenda 1 and 2) and `docs/RUNS/2026-09-24-OVERNIGHT-PREPILOT.md`;
- the full S4 evidence tables and rehearsal protocol as they stood in `docs/CHATGPT_PLAN.md` at commit `afcd750` (`git show afcd750:docs/CHATGPT_PLAN.md`).

Summary only: S3 hosted burst PASS (30 learners, `DATABASE_POOL_MAX=5`); S4 real-device PASS (QR/join, signup + email confirmation, login, Today, correct/incorrect answers, feedback + Continue, Wi-Fi/cellular/switch, refresh/resume, double-tap, F-13, F-14 submit-failure/retry, Item Analysis authorization, clean runtime logs, ≈7 s existing-learner time to first answer). Not proven: multi-learner same-IP real-email signup burst; F-14 initial-load path manually.

## 5. Reusable Operational Protocol (for the real rehearsal / class)

Use only the smallest set that proves the claim; do not re-run a synthetic burst (S3 stands unless something changed).

### Preparation
1. Target the deployment the pilot uses; confirm `DATABASE_POOL_MAX` and `DATABASE_SSL_CA` are set (names only).
2. Supabase dashboard: record Authentication → Rate Limits and whether custom SMTP is configured; decide before a class-size rehearsal.
3. Vercel: pilot URL reachable without Vercel login; Runtime Logs open.
4. Use the real Course (or a rehearsal Course only if content is signed off): PUBLISHED, join policy OPEN, Topics set, real published Questions.
5. Copy the join link (`/join/<courseId>`), generate a QR code.
6. At least 2 physical phones (1 iPhone + 1 Android), Wi-Fi and cellular; a laptop for the instructor; fresh learner accounts with real email (≥5 active learners and ≥5 responders to see any aggregate).

### Student script (each phone; Wi-Fi and cellular)
Scan QR (and once open the link from a message app) → signed-out goes to sign-up/login and back to the join page → sign-up with a real email (confirm; record email delay) or log in → join (OPEN = immediate) → open Today → answer the first question and observe correct/incorrect feedback + Continue → double-tap answer/Continue, refresh mid-answer, second tab (no duplicate, no error page) → finish the plan; kill/reopen the link (session persists, same plan) → switch Wi-Fi↔cellular mid-session and reload → Hebrew/RTL on every screen (direction, alignment, mixed numbers, no clipping, one-handed tap targets, keyboard not hiding submit). After sign-in from a join link the learner returns to the join page and taps Join (explicit consent; fixed and Preview-verified in `04597b4`). Progress (Run 009 S2, Preview-verified; confirm on the pilot deployment once Production runs it): the third bottom-nav tab shows all three tabs on both phones → a fresh learner sees the empty state → after answering, Topics show לא התחלת / בתהליך / דורש חיזוק / מבוסס with "ניסית X מתוך Y שאלות" and no percentages → the back-to-Today link works.

### Instructor script (laptop; ideally while 5+ students answer)
Confirm PUBLISHED, join policy OPEN, Topics visible, only intended Questions PUBLISHED → show join QR/link; watch memberships → announce a group answering window (e.g. 3 minutes; same Questions), do NOT refresh analysis while answers trickle in → after the window open the analysis surface and refresh once; record what is shown, last-updated, and the insufficient-data state → privacy checks: no names/emails/IDs, no per-option distribution, no interpretive labels, learner account denied, signed-out rejected → record instructor value (did it reveal something not immediately obvious; would it change what they revisit; would they use UNLOCK again) → no re-publish or Topic reassignment mid-window. Run 009 S3 UI (Preview-verified): open the analysis via the Course page "ניתוח תשובות" link (shown only for PUBLISHED Courses); the page has a Topic section and a Question section, each showing a descriptive first-answer band (רוב התשובות הראשונות נכונות / תמונה מעורבת / רוב שגויות) or "אין עדיין מספיק נתונים לסיווג"; there are no counts, percentages or per-option data, and the two insufficient reasons look identical. With a small class or many small Topics most Topics will legitimately show insufficient data (each needs ≥5 distinct responders and ≥5 active learners) — expected, not a defect. At n=5 one answer can flip a band, so do not refresh mid-window. (Earlier evidence describing responder counts pre-dates S3; confirm the pilot deployment runs S3 before relying on these steps.)

### Evidence to record (per device)
Device/OS/browser, network, URL and commit, scan→first-question and scan→first-answer seconds, email delay, each failure/confusing moment, RTL/layout defects, double-tap/refresh outcome, Vercel Runtime Log errors (count and codes only); instructor: what was shown, refresh time, privacy results.

### Technical GO / NO-GO / BLOCKED
- **GO:** ≥2 physical devices, both networks: signup/login with real email confirmation, QR/link join, Today, answer, resume and double/refresh work; RTL/mobile usable; no auth/privacy/security defect; instructor authorization/privacy checks pass; no unrecorded 5xx; time to first answer recorded (no invented threshold).
- **NO-GO:** cannot sign up/log in; join or Today broken; answer lost or duplicated; auth/privacy leak; unusable RTL; repeated 5xx/timeouts.
- **BLOCKED:** a step stopped by something outside the app (SMTP limits, Deployment Protection, device unavailable). Record it; not a GO; resolve and repeat only the blocked steps.
- A known non-critical issue may be accepted only if written into the evidence note.

### Content GO / NO-GO (independent; content owner signs)
Checklist = §3 items 1–9. PASS: every box checked and sign-off recorded (name/date). FAIL: any wrong key, unclear Hebrew, misaligned Question, or visible test/draft content. BLOCKED: material or reviewer unavailable. Never infer PASS from a Course simply having questions.

### Pilot signals (record; no invented statistical threshold)
Activation (learners present, joined, reaching at least one accepted answer, technical-friction count/reasons); repeat behavior (learners completing Today on 3 distinct days in a week, from authoritative DailyPlanItem evidence); instructor value (did the analysis reveal something new, change what they revisit, will they use UNLOCK again). These are pilot learning signals, not production KPIs.

### Evidence-note template
`Target: … commit … | Devices/networks: … | Technical: GO/NO-GO/BLOCKED (reasons) | Content: GO/NO-GO/BLOCKED (owner, date) | First-answer times: … | Defects: … | Accepted non-critical issues: … | Analysis view: what shown/refresh/privacy result | Runtime Log errors: …`
