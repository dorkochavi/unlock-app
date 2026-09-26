# Global Today — Doc Consistency Audit

Status: AUDIT ONLY.

**Edits made by this document: NONE.** Every existing doc reviewed below
was left byte-for-byte unchanged. Per this task's own instructions, an
edit is only justified when a statement is BOTH (a) actively contradicted
by an accepted rule right now, not merely superseded-eventually, AND
(b) would concretely mislead a future implementer working before any
Global Today ADR exists. After reading every candidate below in full
surrounding context (not just grep hits), no existing statement in any of
the twelve reviewed documents meets that bar. This matches the outcome the
task instructions predicted as most likely, and this document explains,
file by file, why each candidate falls short of "contradiction" rather
than asserting that conclusion without evidence.

Primary reference used throughout: `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
(read in full first, as instructed) — status "PRODUCT DIRECTION ACCEPTED
BY DOR — NOT YET AN ADR, NOT IMPLEMENTED."

## Genuine contradictions found: 0

No statement in any reviewed document actively asserts something that is
now false under the accepted Global Today rules while ALSO being currently
presented as settled fact that would mislead someone building against
today's repository. Every Today-related statement found in the canonical
docs is either (a) generic/scope-agnostic and equally true under both the
current V1 model and a future Global Today model, (b) explicitly marked
TBD/open already, or (c) an accurate description of the CURRENT, still-
authoritative V1 behavior (ADR-011) that does not claim permanence.

## File-by-file findings

### `docs/PRODUCT.md` — no contradiction

§5 ("The Primary Experience: Today") and §6 ("Persistent Today Sessions"),
lines 103-154, describe Today generically ("Today is the learner's adaptive
daily study plan") with no Course-scoping claim at all, no fixed-size
claim, no auto-carry-over claim. Fully compatible with Global Today as
written; this is a gap (silent on multi-Course scope), not a contradiction.

### `docs/MASTER_SPEC.md` — no contradiction

Targeted review of every "Today"/"session"/"course"/"exam"/"skip" hit
(over 90 matches; representative sections read in full context):

- §28-29 ("Today → Quiz contract", "Session composition", lines 1057-1101):
  explicitly says "The exact composition algorithm is **TBD**" and lists
  candidate signals (overdue review, weak items, misconceptions,
  exam-driven priorities, new learning) without asserting a quota model —
  already compatible with `GLOBAL_TODAY_PRODUCT_SPEC.md` §7's "no
  quota/fairness/floor" rule, not contradicting it.
- §36 Home mockup (lines 1260-1288): "Today's plan: 12 questions" is an
  illustrative UI example inside a mockup block, not a stated rule that
  Today must always be exactly 12 items. Not a fixed-size assertion.
- §81 "Open decisions" (lines 2431-2448) explicitly lists "Today session
  size" and "Today composition mix" as still-open items — consistent with
  `GLOBAL_TODAY_PRODUCT_SPEC.md` §6/§20 leaving exact sizing undecided.
- No occurrence of "skip" in this file at all (grepped) — no stale skip
  semantics to contradict.

### `docs/ARCHITECTURE.md` — no contradiction

§9 "Today Planning" (lines 246-272) describes a generic
NBA-ranking → session-constraints → Today Session flow with no Course-
scoping assertion and no fixed-N/time-budget claim. Compatible as-is.

### `docs/DOMAIN_GLOSSARY.md` — no contradiction

§17-19 ("Today", "Today Session", "Today Session Item", lines 289-344)
define these terms generically ("a persisted instance of a learner's Today
plan for the applicable learning period") with no Course-scoping or
fixed-size claim baked into the definition itself. A future Global Today
implementation does not require redefining these terms, only their key
shape — which lives in ADR-011/schema, not the glossary.

### `docs/archive/ROADMAP.md` — no contradiction

§10 "Phase 8 — Today V1" (lines 342-357) is a V1 delivery-scope
description ("Turn Next Best Action into a simple persistent daily plan"),
not a claim about permanent architecture. No conflicting assertion found.

### `docs/DATABASE.md` — describes current, still-accurate V1 schema; no contradiction

Line 442 (`today_sessions` section) and line 1158 (open-decisions table)
both state: "UNLOCK V1 Today is course-scoped ... Global cross-course
Today is deferred beyond V1." This is a factual, present-tense description
of ADR-011's actual accepted schema, explicitly framed as "deferred beyond
V1" (i.e., not built now) rather than "impossible" or "permanently single-
Course." It does not assert that a cross-Course view can never exist. This
squarely matches the task's own suggested distinction: it "just describes
the current, still-accurate V1 schema without commenting on the future" as
permanently closed. No edit warranted.

Separately worth noting (not a contradiction, a point of confirmed
alignment): `docs/DATABASE.md` §18 already documents a genuine `pending` /
`completed` / `skipped` status on `today_session_items`
(`docs/PERSISTENCE_SCHEMA_V1.md` line 463 — see below), which already
matches `GLOBAL_TODAY_PRODUCT_SPEC.md` §13's "Skip is a real
resolved-but-not-completed/incorrect state" rule. The existing schema does
NOT conflate skip with completion or with incorrect — this is good news,
not a gap.

### `docs/PERSISTENCE_SCHEMA_V1.md` — describes current, still-accurate V1 schema; no contradiction

Lines 423-429 (`today_sessions` table): identical framing to
`docs/DATABASE.md` above — "Global cross-course Today is deferred beyond
V1," presented as a current-schema fact, not a permanent architectural
ceiling. No edit warranted, same reasoning as `docs/DATABASE.md`.

Line 463 (`today_session_items.status`): `pending`/`completed`/`skipped`,
default `pending` — confirmed compatible with, not contradicting, the
accepted Skip semantics (§13 of the product spec). No stale claim that
skip equals failure or equals completion.

### `docs/API_V1_DRAFT.md` — no contradiction

This document is route-shape planning for the CURRENT (course-scoped)
`submitAnswer`/`getOrCreateTodaySession` functions. It makes no claim about
permanent single-Course scope; it simply routes today's actual function
signatures. A future Global Today endpoint would be new/additional route
work, not a correction of anything stated here. One unrelated, already-
stale claim in this document's own line 4 ("it is still the default
Next.js scaffold") was investigated as part of a parallel Learning Engine
audit in this same session (`docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md`
§5) — out of scope for this Global-Today-specific audit, noted here only
for cross-reference, not edited by this document.

### `docs/LEARNING_ENGINE.md` — no contradiction (one superseded-but-not-yet-updated spot)

Targeted grep + full-context read of §34-39 (lines 895-1024):

- §36 "Today Composition" (lines 935-960) explicitly says: "Avoid rigid
  quota logic such as: 30% weak / 30% review / 20% misconception / 20%
  exam ... as the sole decision mechanism... Use ranking + constraints."
  This already anticipates and is fully compatible with
  `GLOBAL_TODAY_PRODUCT_SPEC.md` §7's "no per-Course quota/fairness/floor"
  rule — not a contradiction, an early instance of the same principle,
  just at the category (weak/review/misconception) axis rather than the
  Course axis.
- §37 "Session Duration vs Question Count" (lines 963-979) says: "V1 can
  still use a simple Question cap if duration estimates are not yet
  trustworthy." This is presented as a V1-appropriate simplification, not
  a permanent rule — it does not say Today must always be a fixed count.
  **Flagged as superseded-but-not-yet-contradictory**: the current
  `TodayPlannerPolicy.maxItems` implementation (`src/domain/learning/today-planner.ts`)
  is in fact still a fixed-cap model, and `GLOBAL_TODAY_PRODUCT_SPEC.md`
  §6 proposes moving to dynamic, need-driven sizing as a *future*
  direction with bounds "explicitly NOT decided." Since ADR-011-era V1 is
  still the accepted, currently-built behavior and no sizing ADR has
  superseded it, this line remains literally accurate today — it is not
  wrong, only due for revisiting once/if a Global Today sizing ADR is
  accepted. No edit made.

### ADR-011 (`docs/DECISIONS/011-today-is-course-scoped-v1.md`) — still valid today, NOT edited, flagged only

Explicitly out of scope for editing per this task's own instruction. Full
read confirms: ADR-011 states its own scope precisely ("this ADR only
fixes the session identity key, not ranking or planning logic," line 61)
and explicitly anticipates its own possible future revision ("if the
product later wants a single combined view, that is new work on top of
this... not a reason to revisit this key," lines 63-66; "a future
cross-course Today remains an available extension, not a closed door,"
line 47). ADR-011 does not claim permanence or exclusivity — it is
self-aware that it may be superseded later. Per the task's own guidance,
this is "still valid today, will need future amendment," not "currently
contradictory." No flag beyond this note; no edit made or suggested to
this ADR.

### `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` — no contradiction (superseded exploration, self-labeled as such)

Full read of the relevant sections (§1 "Product interpretation," lines
19-60; §6-9 "risks/migration/persistence model options," lines 280-450).
This document is explicitly self-labeled "DESIGN IMPACT ANALYSIS ONLY —
NOT AN ADR, NOT DECIDED, NOT IMPLEMENTED" (line 3) and its own §9
presents two competing persistence-model options (Option A: Global Today
as its own separate persisted entity; Option B: Global Today as a pure
read-time composition over existing per-Course sessions) as an explicitly
OPEN choice, without picking one. Early framing language in §1 ("The
learner can also open a Course-specific Today... independently of Global
Today," "it has a fixed set of items") reads, in isolation, as leaning
toward a "two separate plans" mental model that `GLOBAL_TODAY_PRODUCT_SPEC.md`
§3 later explicitly resolves the other way ("views over the same
underlying Daily Plan, not separate plans"). However, in full context this
section is exploratory framing that the same document's own §6 ("Plan-
membership double-counting... a genuine gap a Global Today implementation
must close explicitly") and §9 (both options given, pros/cons for each,
no conclusion) already treat as an open, unresolved design question, not
an asserted fact. This document does not claim to have decided the "one
plan vs. two plans" question — it surfaces it as a risk to be resolved,
which `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (produced later, in the same
session) then resolves. This is genuinely "superseded, not contradictory":
the draft's own uncertainty language matches its DRAFT status; a future
implementer who reads only §1 without §6/§9 could get the wrong initial
impression, but the document does not present that impression as decided.
**No edit made** — the bar requires the OLD statement to be "clearly,
actively contradicted... not merely superseded-eventually," and here the
document's own explicit options-analysis already flags the exact ambiguity
rather than asserting a wrong conclusion as settled.

### `docs/archive/V1_VERTICAL_SLICE_PLAN.md` — no contradiction

Read in full for Today-scope references. This document plans checkpoints
against the CURRENT (course-scoped) `TodaySessionKey`/`getOrCreateTodaySession`
shape and does not assert anything about permanent single-Course scope —
it is building against today's actual code, which is accurate. (A
separate, unrelated staleness in this same document — the "`src/app/` is
still the default Next.js scaffold" / "no `src/messages/` usage" claim at
lines 47-51 — is investigated in the companion
`docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` §5, out of this
audit's Global-Today-specific scope, not edited here.)

## `docs/OPEN_QUESTIONS.md` #34 — judged: superseded, not currently misleading

Full text read (lines 821-848). Resolution text: "V1 answer: generated
separately per Course... Global cross-course Today remains a possible
future extension, **not decided or built now**."

Judgment: this is now **imprecise** in one narrow sense — a product-level
direction toward Global Today HAS been accepted by Dor
(`docs/GLOBAL_TODAY_PRODUCT_SPEC.md`'s own status line), so "not decided"
slightly overstates how open the product direction still is. But the
document's own next words are "not decided **or built**" — and it remains
true that no ADR has superseded ADR-011 and nothing has been built. Read
as a whole, the sentence is still accurate about IMPLEMENTATION status,
which is what actually matters to someone deciding whether they can rely
on today's course-scoped behavior. This is a genuine instance of
"superseded-but-not-yet-updated" (the product-direction half of the
sentence is now stale) rather than "actively misleading" (the
build/decided-for-real half is still true and is the operative claim for
anyone writing code today). Per the task's own explicit framing of this
exact example, this is judged **not** to cross the edit bar. No edit made.

## Superseded-but-not-yet-contradictory list (for future reference, once a Global Today ADR is accepted)

These are NOT contradictions today. They are the concrete list of spots
that will need a real update once/if a Global Today ADR is formally
accepted and supersedes ADR-011:

1. `docs/OPEN_QUESTIONS.md` #34 — "not decided" language should be updated
   to reflect that a product direction has been accepted (even though
   implementation/ADR status is unchanged) once that ADR lands.
2. `docs/DATABASE.md` line 442 and `docs/PERSISTENCE_SCHEMA_V1.md` lines
   423-429 — "Global cross-course Today is deferred beyond V1" will need a
   schema-section rewrite (not just a footnote) once a real Global Today
   persistence model (Option A or B from `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`
   §9) is actually implemented.
3. `docs/LEARNING_ENGINE.md` §37 (lines 963-979) — the "simple Question cap"
   V1 fallback language will need revisiting once/if dynamic, need-driven
   Today sizing (`GLOBAL_TODAY_PRODUCT_SPEC.md` §6) is actually built.
4. `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §1's early framing (lines 26-34) —
   worth tightening to explicitly point at
   `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §3's "one plan, filtered views" once
   that becomes the accepted model, so a future reader of §1 in isolation
   doesn't have to reach §6/§9 to find the resolution.
5. ADR-011 itself — explicitly anticipates its own future amendment (its
   own text, not new information from this audit); will need a formal
   superseding ADR once Global Today is actually decided/built, per its own
   "Alternatives Considered" section.

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (primary reference for "accepted" in
  this audit)
- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011, not edited)
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`
- `docs/OPEN_QUESTIONS.md` (#34)
- `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` (companion audit,
  unrelated task, cross-referenced above only for the shared `src/app/`
  staleness note)
