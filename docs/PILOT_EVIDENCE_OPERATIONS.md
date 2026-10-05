# UNLOCK — Pilot Evidence & Runtime-Visibility Operations (items 13a / 13b)

Status: ACTIVE (operating contract + human packets; created by Run `2026-10-04-PILOT-MINIMUM-EVIDENCE-PREP-001`)

Load level: COLD

Scope: how PILOT_READINESS §3 item 13(a) (basic product-event evidence) and 13(b) (runtime/error visibility during
class windows) are met with **no new service, no analytics store and no Roadmap Run 012 scope**. It does not decide
OQ-039 and does not declare any item READY. Gates stay owned by `docs/PILOT_READINESS.md`.

## 1. Decision summary

| Item | Meets-the-minimum approach | Engineering state | Open (human) |
| --- | --- | --- | --- |
| 13(a) | Derive from authoritative records with read-only aggregate SQL (`scripts/pilot-evidence-aggregates.sql`); Vercel request log for "was Today opened" if retained | IMPLEMENTED + tested (queries valid on the migrated schema; identity-free shape) | **Resolved 2026-10-05 (Run `2026-10-05-PILOT-CLOSURE-OVERNIGHT-001`): derivation satisfies 13(a); no `today_opened` added** (see §3.1). Sharing small-cohort aggregates stays OQ-039-dependent |
| 13(b) | Vercel Runtime Logs (status per request) + sanitized error-level lines for every unexpected fault, operated by a named person per §3 | IMPLEMENTED + tested (`src/lib/ops-log.ts`; every unexpected-fault log in API handlers and UoW rollback paths goes through the sanitizer, with no raw console.error left in production code except inside it; expected 4xx not error-level) | **Resolved 2026-10-05 [HUMAN_REPORTED]: watcher = Dor; cadence = start/middle/end of class + immediately on an issue report; Hobby plan Runtime Logs show a "Last day" window, which covers the class-window horizon. 13(b) READY.** Longer retention not claimed |

Hypotheses tested: **H1 confirmed** (every handler already logged unexpected faults with a constant route label; the
real gap was *what* was logged, not *whether*). **H2 confirmed** (authoritative records already answer the funnel; no
new event vocabulary was needed, so none was invented). **H3 confirmed** (OQ-039 is about ownership/retention/notice;
nothing built here persists or exposes learner-level data).

## 2. 13(b) — class-window operating contract

What the platform gives for free: Vercel records, per request, path, HTTP status, time and duration, and a request id
(`x-vercel-id` response header). App code adds one **error-level** line per unexpected fault.

| Class | How it looks in Runtime Logs | Meaning |
| --- | --- | --- |
| Success | 2xx, no app log line | normal |
| Expected outcome | 400/401/403/404/409/422, no `error` level line | client/auth/state outcome — not a fault |
| Rejected-but-unexpected input | `warn` level, constant text `…INVALID_SELECTED_ANSWER` | UI should not send this; look only if frequent |
| **Unexpected server fault** | 5xx **and** an `error` level line `<METHOD> <route>: unexpected …` with `{errorName, errorCode?, constraint?, table?, column?, message?, stackFrames[]}` | investigate now |

Procedure (class window):
1. Before: Vercel → project → Logs (Runtime); pin filters `Level = Error` and `Status = 5xx`. Note start time.
2. During: glance at the 5xx/Error view at a fixed cadence (the named operator decides the cadence). Any 5xx = write
   down time, route, `errorCode`, and what the learner was doing.
3. After: record **counts and codes only** (the PILOT_READINESS evidence template field "Runtime Log errors").
4. A learner-reported problem is correlated by **time window + route** — logs deliberately carry no learner identity.

Honest limits: no alerting and no trace/latency tooling (Run 012 / FUB-008); log retention depends on the Vercel plan
(checklist V2) so evidence must be written down during or right after the window; a quiet log proves absence of
*logged* faults, not absence of client-side failure.

## 3. 13(a) — flow → evidence map

| Question | Evidence | Caveat |
| --- | --- | --- |
| Did learners join? | query `joins_per_day` (`course_memberships`) | counts, per course/day |
| Did Today generate? | `plans_generated_per_day` | marks the first request of a learner-local day only |
| Was Today *opened*? | Vercel request log `GET /api/daily-plan/today` 200 (page + API) — retention-limited; no DB record | FUB-023 gap stays open (decision above) |
| Were answers accepted? Plan vs Practice? | `accepted_answers_per_day` (attempts exist only on acceptance; split by `daily_plan_item_id`) | rejections (409/400) are visible only in Runtime Logs |
| Did Today complete / get skipped? | `plan_items_resolution_per_day` (item status; **not** `daily_plans.status`) | |
| Repeat behavior (≥3 days/week) | `repeat_behavior_last_7_days` (single count) | UTC day buckets |
| Instructor authoring | `courses`, `question_versions` row counts (existing records) | no new query added |
| Sign-up / sign-in success | Supabase Auth logs (dashboard) — not observable from app code | human read only |

All queries are read-only, aggregate-only and UTC-bucketed. Small cohorts: `distinct_*` counts of 1–4 identify
individuals to anyone who knows the roster, so **operator-only** use is assumed; sharing beyond the operator is
OQ-039-dependent (§4).

### 3.1 13(a) closure review (2026-10-05, repository evidence; no new telemetry)

Canonical wording (`PILOT_READINESS` §3 item 13a): "funnel/usage answerable, derived from authoritative records where they
suffice (FUB-023 lists what they cannot show)"; "how each item is met is decided when it is executed". It does not require
page-open proof; FUB-023 itself only asks whether the pilot KPI needs `today_opened` "at all".

| Question | Answer (existing records + the five aggregate queries) |
| --- | --- |
| Plan created for a learner-local day? | Yes: `plans_generated_per_day`. Caveat: `getOrCreateDailyPlanForToday` is also called by Practice batch selection and Practice answer, so a plan row proves "first Today-or-Practice activity of the local day", not specifically a Today page request |
| Accepted answers tied to Today? | Yes: `accepted_answers_per_day`, `via_daily_plan = true` (attempts exist only on acceptance) |
| Today vs Practice distinguishable? | Yes: `daily_plan_item_id is not null` (Today) vs null (Practice) |
| Item resolution/completion? | Yes: `plan_items_resolution_per_day` (completed vs skipped from item status; pending not counted) |
| Repeat use across days? | Yes: `repeat_behavior_last_7_days` (completed items on ≥3 distinct UTC days; single count) |
| NOT provable | Today rendered/opened with no persisted action (no DB row); repeat opens within a day; rejected (409/400) answers (Runtime Logs only); sign-up/sign-in success (Supabase Auth logs) |

Result: **13(a) satisfied by derivation** (HUMAN decision not required; the missing fact is not part of the canonical wording).
Vercel Runtime Logs for `GET /api/daily-plan/today` remain an optional, retention-limited cross-check, not a requirement.
Not added: `today_opened`, any event store, learner drill-down. Queries stay aggregate-only and operator-only (OQ-039 for sharing).
Proof: `supabase/tests/postgres/pilot-evidence-aggregates.test.ts` (schema + seeded semantics, PGlite; not hosted data).

## 4. Privacy classification of logged / derived fields

| Class | Fields |
| --- | --- |
| SAFE_NOW | constant route label; HTTP status; outcome code; error class name; SQLSTATE / Node error code; constraint, table, column names; bounded (≤300 chars) single-line message of **application** errors (not database, parse or Node-system-code errors); (consistency-fault log lines are now constant text with no ids); ≤8 stack frames (≤200 chars each); Vercel timestamp and request id; course ids and counts in the aggregate SQL |
| REQUIRES_OQ039_DECISION | sharing/exporting small-cohort aggregates; any persisted event store carrying a learner id (also OQ-026); log retention/deletion promises to learners |
| FORBIDDEN_FOR_PILOT_MINIMUM | credentials, cookies, tokens, connection strings; email, name; selected answers; request bodies; question/option/explanation or course text; DB `detail` / `where` / `hint` / `query` / `parameters`; raw error objects and `cause` chains; text of thrown primitives; `message` of PostgreSQL (SQLSTATE), Node-system-code (`ECONNREFUSED`…; host/port) and `SyntaxError` errors; learner ids (the two provisioning-fault logs no longer carry `userId`) |

Known residual (accepted, narrow): messages of *application* errors are logged as-is (bounded, single-line). Thrown application messages no longer interpolate learner ids (`submit-answer.ts`); the remaining interpolations are non-learner content/record ids (`questionId`/`courseId` in `generate-daily-plan-for-resolved-inputs.ts` consistency faults, `dailyPlanItemId` in one `submit-answer.ts` fault — the item id is already in the request path in Vercel logs). This is the only identifier exception; it is not broadened, and "no identifier can ever appear in a log" is NOT claimed. A few domain errors interpolate values (e.g. `exam-urgency.ts`); none was found to be request-derived, and the one that echoes a submitted option id (`InvalidSelectedAnswerError`) is mapped to a 400 before any logging.

Mechanics (`src/lib/ops-log.ts`): allow-list summary only; stack frames come only from the frame-shaped contiguous tail after the header (message text cannot pass as a frame; regression-tested); unhandled-outcome faults log only a fixed UPPER_SNAKE `kind`/`outcome` value (`logUnhandledOutcome`); logging never throws (falls back to the label); control characters/newlines collapsed (no log injection);
every field length-bounded; non-object throws reduced to a type tag.

## 5. Human dashboard checklist (for Dor; no secrets — report values/categories only)

| # | Where | Report back | Why it matters | Class |
| --- | --- | --- | --- | --- |
| S1 | Supabase → Authentication → Rate Limits | the numeric limits shown (emails per hour; sign-ups/sign-ins per IP) | item 11 / matrix row 18: a class-size signup burst can hit the email limit (a 429 was seen once) | **BLOCKER** (item 11) |
| S2 | Supabase → Authentication → Emails → SMTP Settings | custom SMTP enabled yes/no; provider **name** only | default sender is very tightly rate-limited; decides whether item 11 needs custom SMTP | **BLOCKER** (item 11) |
| S3 | Supabase → Authentication → URL Configuration | Site URL (origin); Redirect URL entries; whether any bare wildcard exists; whether `<origin>/login?next=…` shapes match | matrix row 17: failure mode is losing join intent after email confirmation, not a security hole | NON_BLOCKER (check before a rehearsal) |
| S4 | Supabase → Project Settings → Billing (plan name) and Database → Backups | plan name; scheduled backups on/off; PITR on/off; retention days | matrix row 7 / FUB-009: managed backups and PITR are unproven; also whether the plan can pause an idle project | NON_BLOCKER (DR gate already SATISFIED by restore-proof) |
| V1 | Vercel → project → Settings → Deployment Protection | protection mode applied to Production | the pilot URL must open without a Vercel login (PILOT_READINESS prep 3); otherwise a step is BLOCKED | **BLOCKER** if enabled for Production |
| V2 | Vercel → team/project plan; project → Logs | plan name; the Runtime Logs retention window shown; whether Log Drains are offered | decides whether §2 evidence can be reviewed after a class or must be captured live | ~~BLOCKER for claiming 13(b) READY~~ — reported 2026-10-05 [HUMAN_REPORTED]: Hobby plan; windows 30 min / 1 h / 12 h / 1 day visible (3 days / 1 week / 2 weeks under "Observability Plus"); Log Drains not checked |
| H1 | decision, not a dashboard | name of the person who watches Runtime Logs per class window, and cadence | §2 needs a named operator | ~~BLOCKER~~ resolved 2026-10-05 [HUMAN_REPORTED]: Dor; start/middle/end of class + immediately on an issue |

Not requested (already tracked or proven): Production env var presence (`DATABASE_SSL_CA`, `DATABASE_POOL_MAX` —
exercised by S3/S4 hosted evidence); Vercel failed-build behavior (matrix row 37, existing open gate).

## 6. OQ-039 decision packet (DECIDED 2026-10-05: Option C; canonical record `docs/DECISIONS/021-pilot-learner-data-notice-v1.md`; analysis below kept as history)

**Open question (verbatim scope):** for instructor/class pilots, who owns or controls uploaded Materials,
authored/generated Questions, edits, learner Attempts, aggregate class insights, exports, and deletion requests — and
what are learners told (PILOT_READINESS 13d).

**What the code does today:** learners' Attempts, memberships and DailyPlans live in the Supabase project (Frankfurt) with no
learner-facing export or deletion path (none of the 26 API routes provide one); instructors see only banded aggregate
insights with a ≥5-responder disclosure gate (ADR-019/Run 009); backups are encrypted FULL copies held off-device by
the owner (`docs/BACKUP_DR_POLICY.md`), so any deletion promise must state how backups are treated. After this Run,
application logs contain no learner content and, by construction and tests, no learner id in the sanitizer paths and no learner id in the handler-level messages; application-error messages are bounded text with the narrow non-learner id exception in section 4.

**What the Pilot minimum needs:** one short learner-facing statement of purpose, data held, who can see what, and who to
ask; and one internal statement of who the data controller is. Nothing technical blocks either.

| Option | Controller of learner Attempts | Implication |
| --- | --- | --- |
| A | The institution/instructor (UNLOCK acts for them) | needs an institution-side agreement; deletion/export become operator-run on the institution's request; strongest fit for an instructor pilot |
| B | UNLOCK / its owner | owner takes direct obligations (notice, deletion, retention); instructor owns authored content under a licence note |
| C | No ownership claim; notice-only "pilot / limited-trial" statement; ownership, export and deletion deferred to Run 012 | fastest; leaves the written promise thin and defers the hard questions to after real data exists |

No option is recommended: canonical evidence does not favour one, and the choice carries legal/institutional weight
(legal review is advisable before the notice text is final; this document is not legal advice).

**Implementation implications once chosen:** notice text + where it is shown (sign-up/join page); whether aggregates may be shared beyond the operator; any export/deletion
procedure (manual/operator-run is enough for the Pilot); log and backup retention statement.
**Can stay deferred to Run 012:** self-service export/deletion, retention automation, analytics provider (OQ-026),
`today_opened` instrumentation, alerting.
