# Today Timezone Edge Cases (Historical Design Analysis)

Status: **HISTORICAL DESIGN ANALYSIS.** The original greenfield analysis below is intentionally preserved as reasoning history; do not use its old "nothing implemented / #3 and #35 open" statements as current repository truth.

## Current-state reconciliation (2026-09-20)

The foundation this document originally analyzed is now implemented:

- `users.timezone` stores the learner's IANA timezone.
- the persisted timezone is the server-side source of truth for DailyPlan local-day derivation.
- `deriveLocalDateString` deterministically derives `YYYY-MM-DD`.
- `getOrCreateDailyPlanForToday` uses that learner-local date and reuses the same persisted plan on same-day reopen.
- ADR-016 is authoritative for the qualitative midnight rule: an actively continuing session is not forcibly interrupted at exactly 00:00, while a fresh open after midnight uses the new local day's plan.

What may still need future product/UX work is narrower: travel/timezone-change behavior, explicit timezone editing UX, and any richer definition of a continuously active pre-midnight browser session across midnight.

The body below reflects the pre-implementation reasoning state and may mention now-resolved Open Question IDs. It remains useful as analysis, not as current status.

---

## 1. A recurring theme: what should "continuation" be judged by?

Before the individual cases, one structural choice recurs in nearly all
of them, so it is worth stating once as the organizing proposal this
document leans on throughout:

**PROPOSAL:** judge whether an already-open Today session continues by
**session-activity state** (an explicit "this session is currently the
active one" marker plus recency of interaction), not by **recomputing the
learner's current local calendar day against wall-clock time on every
read.** Concretely: once a `TodaySession` is generated and the learner is
actively engaged with it, treat it as the current session until either
(a) the learner explicitly finishes it (all items resolved, §7 of the
product spec's "real finish line"), or (b) it has been inactive long
enough that a fresh open is unambiguously a *new* visit, not a
continuation — a decision, not a live "is it still `plannedForDate` in
timezone X right now" recomputation.

This is explored, not decided, because it has a real cost: it requires
defining "inactive long enough," which is itself a new undecided
threshold (paralleling `docs/TODAY_ADAPTATION_MODEL.md`'s stance on
undecided numeric calibration — this document does not propose a number
either). The justification for exploring this direction rather than
live wall-clock recomputation is that recomputing "what is today, right
now, in this learner's timezone" at every read is exactly what breaks
under timezone *changes mid-session* (§2, §7, §11 below) — the moment the
"current timezone" input itself becomes unstable during a session, any
rule that re-derives the local day from it on every read can flip
mid-read. A rule anchored to session state avoids that class of problem
by construction, at the cost of needing its own (undecided) inactivity
threshold. Each case below is evaluated against this proposal explicitly,
including where it does NOT resolve the case cleanly.

## 2. User changes timezone mid-day

**Ambiguity/risk:** the learner flies from Tel Aviv to New York mid-
session (or simply changes a device setting), and their "local day" by
wall-clock definition changes out from under an in-progress or freshly-
completed plan. Naively recomputing "today" from the new timezone
mid-session could show a *different* calendar date than the one the plan
was generated for, potentially triggering an unwanted regeneration
mid-session — exactly what §15/OQ#3 prohibit ("do not silently regenerate
an active Today Session").

**PROPOSED V1 rule:** the timezone used to determine `plannedForDate` is
captured **once, at session-generation time** (call it the session's
"anchor timezone"), and is not re-evaluated against a live/current
timezone for the lifetime of that session. A mid-session timezone change
does not, by itself, end or regenerate the session — it only affects
which local day a *future* first-open (after this session naturally
concludes) is evaluated against. This is a direct extension of §15's
existing rule ("a session started before local midnight is not
interrupted at exactly 00:00") generalized from "midnight" specifically to
"any wall-clock-day-boundary-affecting event," including a timezone
change, on the reasoning that both are the same underlying failure mode:
a live recomputation of "current local day" disagreeing with the day the
session was actually generated for.

## 3. Travel across a date line

**Ambiguity/risk:** an international date-line crossing can make "local
day" jump forward or backward by a full day almost instantaneously (a
more extreme version of §2), and can even make two consecutive
wall-clock readings show the *same* local date twice, or skip a date
entirely, depending on direction and DST interactions at the boundary.

**PROPOSED V1 rule:** identical to §2's proposal — the session's anchor
timezone (and therefore its `plannedForDate`) is fixed at generation time
and does not re-derive from a live "where is the learner right now"
signal mid-session. The *next* session generated after this one
concludes naturally uses whatever timezone is current at that later
first-open. This avoids needing any special-case date-line logic at all,
because the rule never asks "what day is it *right now* in the learner's
current location" for an already-open session in the first place.

## 4. DST forward transition (a local day "loses" an hour, e.g. 02:00→03:00)

**Ambiguity/risk:** if `plannedForDate`-boundary logic were ever
implemented as "midnight plus 24 hours" rather than "the next calendar
date in the IANA timezone," a DST-forward jump could make a day exactly
23 hours long, and any code path measuring session validity by a raw
24-hour duration (one of the four literal options OQ#3 lists: "rolling
24-hour period") would end the day early relative to true local midnight,
contradicting the accepted local-calendar-day framing.

**PROPOSED V1 rule:** whatever eventually resolves OQ#3, this document
recommends explicitly ruling out "rolling 24-hour period" as the
underlying definition of a day boundary, in favor of a true IANA-
timezone-aware calendar-date computation (this is a recommendation about
*which* of OQ#3's four listed options to avoid, not a resolution of OQ#3
itself, which also depends on OQ#35's timezone-source question). Given
that, a DST-forward transition is a non-event for this design: the
calendar date is still computed correctly by proper timezone-aware date
arithmetic (e.g. any standard IANA-timezone library), it simply has one
fewer wall-clock hour in it. Session continuation (§1's proposal) is
judged by activity, not elapsed wall-clock hours, so a short DST day does
not risk prematurely ending an active session either.

## 5. DST backward transition (a local day "gains" an hour, e.g. 02:00→01:00 repeats)

**Ambiguity/risk:** the mirror case — a repeated wall-clock hour. A naive
"has it been >= 24 hours since session start" check could let a session
appear to span an unexpectedly long wall-clock duration, or — worse — a
timestamp comparison that does not account for the repeated hour could
misorder two events that actually occurred in the correct sequence
(01:30 first-occurrence vs. 01:30 second-occurrence).

**PROPOSED V1 rule:** same reasoning as §4 — proper timezone-aware
date/time libraries store instants in UTC internally and only render to
local wall-clock for display/day-boundary computation, so a repeated
local hour is not actually ambiguous in UTC terms, only in a naive
string-based local-time comparison. This document recommends that any
future implementation store all instants (Attempt timestamps, session
`started_at`, etc. — already true today per the schema) in UTC, and
compute the *local calendar date* only as a derived, display/boundary
value from a UTC instant plus an IANA timezone identifier — never by
manipulating local wall-clock strings directly. This is consistent with
existing practice (`docs/PERSISTENCE_SCHEMA_V1.md` uses `timestamptz`
throughout) and requires no new schema decision — only a rule about how
day-boundary code, whenever written, must derive dates.

## 6. Browser-reported timezone differs from stored profile timezone

**Ambiguity/risk:** OQ#35 lists both "account setting" and
"browser-derived timezone" as candidate sources, without resolving which
wins. If both exist and disagree (traveler using a laptop from home
while physically elsewhere, or simply a stale profile setting), which one
determines `plannedForDate`?

**PROPOSED V1 rule:** this document does not resolve OQ#35 (out of
scope — explicitly a still-open product/data-source question), but
proposes a *structural* rule for whichever source(s) end up existing:
prefer whichever timezone was used to **anchor the currently-active
session** (§1/§2) over a live re-read of either source, for the lifetime
of that session. For a *new* session's first-open, if both a stored
profile timezone and a browser-reported timezone exist and disagree, this
document recommends the browser-reported value take precedence *only if*
no explicit stored profile timezone exists yet — once a learner has an
explicit stored preference, an ambient browser signal should not silently
override it without the learner's awareness, since a browser timezone can
be transiently wrong (VPN, misconfigured OS, temporary travel) in ways an
explicit account setting is not. This is a proposal for whoever resolves
OQ#35, not a resolution of it.

## 7. No profile timezone captured yet (new user)

**Ambiguity/risk:** a first-time learner has no stored timezone at all.
Some source must be used for their very first Today plan's
`plannedForDate`.

**PROPOSED V1 rule:** fall back to browser/device-reported timezone at
first Today open, and — this document recommends, though it does not
decide the mechanism — persist it as the stored profile timezone at that
moment (turning an ambient signal into an explicit one going forward,
which then makes §6's "prefer explicit stored value" rule apply to every
subsequent session). Absent any browser signal at all (e.g. a
server-rendered or non-browser context), `docs/OPEN_QUESTIONS.md` #35's
"fixed pilot timezone" option is the only remaining fallback this
document can point to without inventing a new one — but this document
does not decide which fixed value, since that is squarely OQ#35's
question.

## 8. Plan created at 23:59 local

**Ambiguity/risk:** this is almost the direct trigger case for §15's own
rule. A plan generated one minute before midnight, then actively studied
through and past midnight, must not be interrupted or replaced by day
D+1's plan mid-session — this is explicitly accepted product behavior
(§15, and §19's worked example: "Learner starts Today at 23:50 on day D.
At 00:05 they are still actively in that session... continue working
through day D's plan without it being interrupted").

**PROPOSED V1 rule:** directly covered by §1's session-activity-anchored
continuation proposal — this is the case that proposal exists to handle.
No additional rule needed beyond correctly implementing §1: the session
generated for day D, still actively engaged, remains "the current
session" regardless of what the wall clock says, until it naturally
concludes or the inactivity threshold (§1, undecided) is crossed.

## 9. A session continuing past local midnight (the general case of §8)

**Ambiguity/risk:** same as §8, generalized — any session, not only ones
started right before midnight, that happens to still be open when local
midnight passes.

**PROPOSED V1 rule:** identical to §8 — §1's proposal is deliberately
general, not special-cased to "started shortly before midnight." Any
actively-continuing session, regardless of how long before midnight it
started, is judged by activity/explicit-conclusion, not by a live
recomputation of "what day is it now."

## 10. App crash at 00:01 — does the session belong to yesterday or today on reconnect?

**Ambiguity/risk:** this is the hardest case, and the task is right to
flag it as high-risk. Unlike §8/§9, there is no continuous "actively
engaged" signal to anchor to across the crash — the client disappeared at
00:01 and reappears later with no way, from the server's perspective
alone, to distinguish "the learner was still actively mid-session and
just crashed" from "the learner had already finished/abandoned day D's
session hours earlier, and this reconnect is really the start of a fresh
day D+1 visit that merely happens to be reconnecting from an old client
state." A wrong guess in either direction violates an accepted rule: guess
"still day D" for a learner who was actually done and gone, and day D+1's
plan is wrongly delayed; guess "now day D+1" for a learner who really was
mid-session, and their day D plan is wrongly abandoned/regenerated
mid-session — precisely what §15/OQ#3 forbid.

**PROPOSED V1 rule (lowest confidence of any in this document, flagged as
needing the most product input):** resolve using the **last recorded
server-side activity timestamp for that session** (e.g. the most recent
Attempt's `answeredAt`, or an explicit session heartbeat if one is ever
added) compared against a bounded grace window from the crash-adjacent
moment — not the crash instant itself, which the server cannot observe
directly. If that last-activity timestamp is recent enough (within the
undecided grace window), treat the reconnect as continuing day D's
session; if it is not, treat the reconnect as an ordinary first-open,
subject to day D+1's plan being generated normally under §5 of the
product spec ("first-open generation"). This document explicitly does
NOT propose a grace-window duration — that is exactly the kind of
calibration number this document is scoped to flag, not invent — and
explicitly flags that **any** fixed grace window is a heuristic that will
misclassify some real crash timing, which is why this is called out as
the riskiest case in this document.

## 11. Two devices open simultaneously in two different timezones

**Ambiguity/risk:** a desktop client configured for one timezone and a
phone reporting a different one (via OS/browser) open Today at
"the same" wall-clock instant, but each could independently compute a
different `plannedForDate` if the day-boundary computation is done
client-side or independently per-request using each device's own
ambient timezone signal.

**PROPOSED V1 rule:** the day-boundary computation must be a **single
server-side decision per session**, not something each device computes
independently from its own local signal. Once a `TodaySession` exists for
a given anchor timezone/date (§1, §2), every device simply reads and acts
on *that* session — it does not re-derive its own notion of "today" and
compare. This directly parallels ADR-010's `getOrCreateTodaySession`
"`INSERT ... ON CONFLICT DO NOTHING RETURNING` with a fallback `SELECT`"
pattern already used to make session resumption reliable across
concurrent callers for the *same* purpose (never a check-then-insert
race) — the same reasoning applies to two devices racing to open Today:
whichever reaches the server first anchors the session/date, and the
second device's request should resolve to the same already-created
session rather than independently deciding it disagrees. This does not
resolve *which* device's timezone should anchor a brand-new session if
both requests arrive close enough to race for a first-open — that
reduces to §6/§7's open source-of-truth question, not a new problem
introduced by having two devices.

## 12. Timezone change occurring between plan creation and later resume of the same plan

**Ambiguity/risk:** the learner opens Today in the morning (timezone A),
does not finish, travels, and resumes the same not-yet-completed plan
later that day from timezone B. Should the resumed session still be
"the same session," and if so, under which timezone's notion of "still
today" (if that even needs to be re-checked at all)?

**PROPOSED V1 rule:** this is precisely what §1's anchor-timezone
proposal is designed for — the session's anchor timezone/date was fixed
at generation time (morning, timezone A) and is not re-evaluated against
timezone B on resume. The learner resumes the same session, sees the same
frozen plan (ADR-010's freeze guarantee, unaffected by any of this), and
the "is this session still valid" check (§1's inactivity threshold, still
undecided) is judged by elapsed activity/time, not by whether timezone
B's "today" agrees with timezone A's. The *next* session, generated after
this one concludes, would naturally use whatever timezone is current at
that later first-open (most likely timezone B, per §6/§7's fallback
logic) — this document does not see a need for the resumed session itself
to ever re-derive its date.

## 13. Summary: cases fully covered by the anchor-timezone + activity-based-continuation proposal vs. genuinely unresolved

- **Cleanly covered by §1's proposal:** §2, §3, §8, §9, §11, §12 — all
  reduce to "don't re-derive an active/resumed session's day from a live
  timezone read; anchor it once at generation and let activity, not
  wall-clock recomputation, govern continuation."
- **Covered by a UTC-storage + IANA-aware-boundary discipline, not by the
  anchor-timezone proposal specifically:** §4, §5 — these are computation-
  correctness issues (how to compute a calendar date at all), not
  continuation-identity issues.
- **Explicitly NOT resolved by this document, flagged for product/data
  decision:** §6, §7 (timezone *source* precedence — squarely OQ#35);
  §10 (the crash-reconnect grace window — flagged as this document's
  single riskiest open point, per §10's own discussion).

## 14. Explicitly deferred / not decided by this document

- Resolution of `docs/OPEN_QUESTIONS.md` #3 (Today Session Boundary) or
  #35 (Learner Time Zone) — this document only analyzes edge cases
  against the accepted qualitative rule (§15 of the product spec), it
  does not resolve either Open Question.
- The exact session-inactivity threshold used to decide when an
  open-but-quiet session stops counting as "the active one" (§1).
- The exact crash-reconnect grace window (§10).
- Which timezone source (account setting vs. browser-derived vs. fixed
  pilot vs. stored IANA) is authoritative (§6, §7 — OQ#35's own question).
- Any schema change to support an "anchor timezone" field, a session
  heartbeat, or a last-activity timestamp — this document proposes the
  *concepts* these edge cases would need, not their persisted shape.

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (§15, §19 "Pre-midnight active
  session")
- `docs/OPEN_QUESTIONS.md` (#3 Today Session Boundary, #35 Learner Time
  Zone)
- `src/domain/learning/today-planner.ts` (`plannedForDate` format-only
  validation, no timezone logic)
- `docs/API_V1_DRAFT.md` (§2 — `plannedForDate` opaque string contract)
- `docs/DECISIONS/010-answer-submission-transaction-model.md` (Today
  Session freeze model; `getOrCreateTodaySession`'s race-safe pattern,
  cited in §11 above)
- `docs/PERSISTENCE_SCHEMA_V1.md` (`timestamptz` usage, cited in §5 above)
