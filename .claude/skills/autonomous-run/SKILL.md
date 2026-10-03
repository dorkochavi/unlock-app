---
name: autonomous-run
description: Run a multi-Slice Long Autonomous Run — a thin parent orchestrator dispatching sequential fresh scoped workers, one Slice at a time, with compact handoffs and a Run-local checkpoint — without duplicating testing, review, or checkpoint policy.
---

# /autonomous-run

Purpose: orchestrate a bounded multi-Slice Run with a thin parent and fresh sequential workers, so parent context stays small and each Slice gets independent, undistracted attention.

This skill owns orchestration mechanics only. It does not define a Run's goal, invariants, or Slice
plan — those are supplied by the Run's own initiating prompt. It does not own verification selection
(`.claude/rules/testing.md`), reviewer selection (`.claude/skills/review-commit/SKILL.md`), or the
evidence gate (`.claude/skills/checkpoint/SKILL.md`); it tells the parent and workers when to invoke
those, not how they decide.

Use this skill only when a Run's initiating prompt says to use it, or the current mode is explicitly
a Long Autonomous Run. It is not part of ordinary single-Slice work — see
`.claude/skills/implement-slice/SKILL.md` for that.

## 1. What the Run Prompt Must Supply

The invoking prompt owns:
- RUN_ID;
- RUN_GOAL (the actual outcome the Run exists to produce);
- the Run's own invariant set (what must not change/break/leak/push, etc.);
- the Slice queue/order;
- any special STOP conditions specific to this Run.

This skill does not invent any of the above. If the invoking prompt is missing one of them, that is
a preflight gap — see §2.

## 2. Phase 0 — Orchestration Preflight

Before dispatching any worker, the parent verifies repository truth directly (not from memory or a
prior conversation):
- current branch;
- `git status` — working tree state;
- current HEAD and recent log;
- relationship to the intended base/origin, when that matters for the Run.

HARD STOP if the tree contains unexpected local work that the Run did not itself produce. Never
discard, reset, stash, or otherwise silently resolve unknown changes — surface them and stop.

Then establish the Run identity, still BEFORE any worker dispatch: set `RUN_ID` / `START_HEAD` /
`RUN_STATUS` / title in the header of `docs/CHATGPT_PLAN.md` (a deliberate Plan-only edit or commit;
`CLAUDE.md` §5), and verify telemetry now attributes to the new RUN_ID (a hook event after the edit
appears under `scratch/telemetry/<new RUN_ID>/`). Telemetry files events under whatever Plan RUN_ID is
current at event time; a Plan identity left stale until Run close misfiles the whole Run under the
previous one (`docs/DEVOS_OBSERVABILITY.md` §11). Run identity fields and their owners:
`CLAUDE.md` §2 / `docs/CONTEXT_MAP.md` — not restated here.

Also confirm at Phase 0:
- RUN_ID/RUN_GOAL/invariants/Slice queue are all present per §1;
- a materially equivalent worker-isolation mechanism is actually available (see §4). If not, do not
  begin — see §4's STOP clause.

Only proceed to Slice dispatch once Phase 0 is clean.

## 3. Thin Parent Responsibilities

The parent orchestrator:
- owns and restates the Run goal, invariant set, and Slice queue;
- tracks current HEAD and the compact outcome of each completed Slice;
- makes STOP/ESCALATE calls between Slices;
- performs the final Run-close synthesis.

The parent does **not**:
- perform substantial implementation itself;
- carry full worker transcripts in its own context;
- reread large repository areas directly;
- become the main coding context for the Run.

If the parent finds itself doing meaningful implementation work directly, that is a sign the Run has
stopped being a thin-parent Run — treat it as a drift signal (§7) rather than continuing silently.

## 4. Fresh Scoped Worker Boundaries

Each Slice is dispatched to a fresh, non-context-inheriting worker (a new agent invocation with no
memory of prior Slices except what the compact handoff/checkpoint gives it). Do not use a
context-inheriting variant for Slice workers — inherited context defeats the isolation this pattern
depends on.

Rules:
- workers run **sequentially**, one at a time;
- never run two workers as concurrent writers against the same working tree;
- a worker's job ends with one compact handoff (§5) back to the parent; the parent does not read the
  worker's full internal transcript.

**Dispatch packet.** A worker packet is a minimal execution boundary, built from the §7 pre-Slice
record. Include only what the Slice needs:
- RUN_ID, SLICE_ID, Slice goal;
- START_HEAD (or current grounded baseline);
- expected / smallest useful change;
- exact relevant paths and/or canonical pointers;
- MUST_REMAIN_UNCHANGED constraints, PROOF_REQUIRED, known RISKS;
- a compact PRIOR_HANDOFF only when genuinely needed.

Do not include full Run history, transcripts, raw telemetry/logs, broad doc dumps, unrelated source
context, or large raw diffs where a targeted pointer suffices. The worker starts from the supplied
paths/pointers and does not reread already-summarized context unless repository evidence requires it.
Do not spawn a worker merely to parallelize trivial reads/searches the parent can do cheaply.

If no materially equivalent isolation mechanism is available in the current environment, STOP the
autonomous-Run experiment rather than silently collapsing into one monolithic session pretending to
be multiple Slices. Record why in the Run-local checkpoint (§6).

## 5. Compact Handoff Contract

Each worker returns exactly this structure at the end of its Slice (nothing more, unless a case
below requires narrative):

```
SLICE: <id>
STATUS: KEEP / FIX / STOP / ESCALATE
START_HEAD: <hash>
END_HEAD: <hash, or "not committed" + why>
FILES_CHANGED: <list>
TESTS: <what was run, result>
REVIEW: <reviewer outcome, or rationale for none>
INVARIANTS_CHECKED: <confirm the Run's declared invariants held>
UNEXPECTED: <surprises, or "none">
DEFERRED: <intentionally unsolved items>
NEXT: <what should happen next>
```

Long narrative is warranted only for: a contradiction, an architecture/policy issue, a failed
invariant, a STOP or ESCALATE, or a security/reliability concern. Otherwise keep the handoff to the
structure above — the parent should not need to read prose to know what happened.

## 6. Run-Local Checkpoint

Use the existing `scratch/development_checkpoint.md` temporary-continuity file (per `CLAUDE.md` §11,
§16) — do not create a new permanent file for this. Keep it overwritten, not an append-only diary.

Track:
- RUN_ID / RUN_GOAL;
- START_HEAD / CURRENT_HEAD;
- COMPLETED_SLICES (compact per-Slice summary, not full transcripts);
- CURRENT_SLICE / NEXT_SLICE;
- BLOCKERS;
- STOP_ESCALATE_EVENTS;
- UNCOMMITTED_WORK;
- LAST_VERIFICATION.

Never copy canonical policy (testing/review/checkpoint/rules content) into this file — reference it
by path instead.

## 7. Pre-Slice / Post-Slice Control Loop

**Grounding first.** A Slice that might create or rewrite policy first searches the narrowest canonical
owners — `docs/CONTEXT_MAP.md`, accepted ADR/design docs, `docs/OPEN_QUESTIONS.md` if decision-related,
`docs/FOLLOW_UP_BACKLOG.md` if deferred-work-related, current Plan/`DEV_STATUS` — narrowly, without
preloading, so policy is not invented or duplicated.

**Before dispatching each Slice**, the parent records:
- Goal — what this Slice is actually for;
- Expected change — the concrete change anticipated;
- Smallest useful change — the minimum that satisfies the goal;
- Must remain unchanged — the invariants/surfaces this Slice must not touch;
- Proof — what evidence would show the Slice succeeded;
- Risks — what could go wrong.

**After each Slice returns**, the parent records:
- Expected vs. Observed;
- Unexpected — anything not anticipated;
- Regression check — did anything the Run must preserve get disturbed;
- Decision — KEEP / FIX / STOP / ESCALATE.

**Drift Check** (every Slice, before dispatching the next one):
- does the completed change directly advance RUN_GOAL?
- did scope expand beyond what was declared for this Slice?
- was a new architecture/policy decision introduced that the Run did not already have authority for?
- did any declared invariant change?
- did permanent (non-scratch) context increase, and was that increase justified?
- is the next queued Slice still justified given everything observed so far?

A "no" on justification, or a "yes" on unjustified drift, is a STOP/ESCALATE trigger, not something
to note and continue past.

**Scope mutation.** If scope changes mid-Slice, revalidate the whole control record together — Goal,
Expected change, Smallest useful change, Must remain unchanged, Proof, Risks — then update the
checkpoint and the worker instruction consistently. Never patch one field and leave the rest stale.

### Gate Policy (canonical definitions)

The Plan's Slice queue declares one gate per Slice; this skill owns what each gate means:
- **AUTO** — after KEEP, continue if the Slice's invariants and proof pass.
- **REVIEW_GATE** — risk-based review runs per §11; continue automatically unless review or the
  worker reports material divergence or an unexpected product/architecture decision.
- **HUMAN_DECISION_GATE** — always stop for an explicit human decision.
- **FINAL_GATE** — stop after integrated verification and Run close for human review.

Do not pause after a Slice merely because it ended; pause only as its gate, a STOP/ESCALATE, or the
Drift Check requires.

## 8. Goal Lock / Goal vs. Proxy

Keep RUN_GOAL explicit and locked for the duration of the Run. A proxy metric — token usage, cache
efficiency, line-count reduction, Slice count, or similar — must never silently substitute for or
override the actual goal or correctness. If a Slice would improve a proxy metric at the expense of
the real goal or an invariant, that is a drift signal (§7), not progress.

## 9. Invariants

This skill does not define a fixed universal invariant list — invariants belong to each Run's own
initiating prompt (e.g. no push, no product-code changes, no schema changes, whatever that specific
Run declares). This skill's responsibility is procedural: make sure the declared invariant set is
checked at every Slice (§5's `INVARIANTS_CHECKED` field, §7's post-Slice regression check), not to
invent or expand what those invariants are.

## 10. STOP / ESCALATE Discipline

If a Slice surfaces a missing product/architecture/policy decision that the Run does not already
have authority to make, STOP or ESCALATE rather than inventing the decision. This mirrors
`CLAUDE.md` §4/§17 `PLAN_CONFLICT`/Stop Conditions — this skill does not create a separate standard,
it applies the existing one at Slice granularity throughout an autonomous Run.

## 11. Risk-Based Independent Review

Reviewer selection is owned exclusively by `.claude/skills/review-commit/SKILL.md`. Each worker
applies that skill's own criteria per Slice; this skill does not restate or duplicate its risk
classes or selection logic — it only requires that the step not be skipped.

## 12. Run-Close Protocol

1. Confirm implementation for the Run's approved scope is complete.
2. Confirm verification is complete per `.claude/rules/testing.md` (only missing/unproven Run-level
   behavior, not a blanket suite replay — see `CLAUDE.md` §12).
3. Update the closing identity (the Run identity itself was established at Phase 0, §2) using the START_HEAD / LAST_VERIFIED_HEAD / RUN_STATUS model
   (see `docs/DEV_STATUS.md` and `docs/CHATGPT_PLAN.md` for the live shape of these fields, and
   `.claude/telemetry/verify-run-close.mjs` for the deterministic, zero-AI gate that checks them).
4. Write Run-close docs (`docs/DEV_STATUS.md`, `docs/RUNS/<RUN_ID>.md`) per `CLAUDE.md` §11/§12.
5. Commit.
6. Derive the actual closing HEAD from Git after the commit exists — never author a doc that cites
   the hash of the very commit it is part of (a Run-close doc cannot correctly self-cite its own
   commit's hash; this is the specific trap the START_HEAD/LAST_VERIFIED_HEAD/RUN_STATUS model
   replaced).
7. Run the verifier and require a PASS.
8. Confirm a clean tree.
9. STOP. Do not push.

## 13. Experiment/Telemetry Hooks

Run close: generate the summary (`node .claude/telemetry/summarize.mjs [RUN_ID]`); verify attribution
sanity with the deterministic `.claude/telemetry/verify-run-close.mjs` (its attribution WARNs); report
the mechanism evidence compactly. Never dump raw telemetry into durable docs. Telemetry figures are
runtime session/context measurements, not billed tokens; event semantics (subagent metrics, `slice_id`)
are owned by `docs/DEVOS_OBSERVABILITY.md` §11. Slices are attributed via the `CURRENT_SLICE:` line of
the §6 checkpoint (first token, e.g. `CURRENT_SLICE: C`) — keep it current when dispatching each Slice.


At Run close, a Run using this skill should report available evidence about the *mechanism itself*
(not the product change), for example: how the parent's context behaved over the Run, worker count
and whether isolation actually held, how many times context needed compaction, how many
STOP/ESCALATE events occurred and why, and whether reviewer dispatch was useful where it was used.

Use this evidence to support a KEEP / WATCH / CHANGE call on the mechanism (per the
MEASURE → INTERPRET → COMPARE → ACT model this repository already uses for telemetry). Do not
invent a single productivity/efficiency score to stand in for this evidence, and do not promote the
mechanism to universal/default policy from a small number of Runs — a KEEP/WATCH call is provisional
until it has been observed enough times to justify wider adoption.

## 14. Interruption Recovery

Interruptions (rate limit, classifier failure, worker crash, session restart, `/clear`) must not lose
or discard work:
- do not discard uncommitted interrupted worker work; inspect the tree and HEAD first;
- a fresh recovery worker evaluates the inherited diff against the original Slice contract, then
  completes/fixes/tests it; commit only after coherent proof;
- refresh the §6 checkpoint before and after.

`/clear` protects context health but does not by itself reduce total Run cost; prefer fewer, cheaper
resumptions and better handoffs.

## 15. Failure Classification

Verification findings state whether a failure is: pre-existing at Slice START; pre-existing at Run
START; introduced in the current Slice; or introduced earlier in the current Run. At Run close, compare
against Run START (`START_HEAD`), not only the prior Slice. Handling of unrelated pre-existing
failures stays with `.claude/rules/testing.md` §14.
