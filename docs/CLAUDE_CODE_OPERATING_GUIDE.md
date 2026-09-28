# UNLOCK — Claude Code Operating Guide

Status: ACTIVE — human-facing field guide
Load level: not preloaded by default; read when you want a map of how DevOS pieces fit together.

This is an **index**, not a policy owner. It points at canonical files instead of restating them.
The single authoritative kernel is repo-root `CLAUDE.md`. When this guide and a canonical file
disagree, the canonical file wins.

## 1. Where DevOS knowledge lives

The repository is persistent technical truth (`CLAUDE.md` §1). One home per fact (`CLAUDE.md` §2):

- **Repository reality** — committed code, migrations, tests.
- **Accepted intent** — ADRs and canonical product/architecture docs.
- **Unresolved decisions** — `docs/OPEN_QUESTIONS.md`.
- **Current execution** — `docs/CHATGPT_PLAN.md`.
- **Current snapshot** — `docs/DEV_STATUS.md`.
- **Navigation** — `docs/CONTEXT_MAP.md`.
- **Historical execution** — Git + `docs/RUNS/**`.
- **Deferred work** — `docs/FOLLOW_UP_BACKLOG.md`.
- **Temporary continuity** — `scratch/development_checkpoint.md`.

See `CLAUDE.md` §2 for the authoritative list.

## 2. HOT / WARM / COLD / RESTRICTED

Context is tiered so you load only what a Slice actually needs: `CLAUDE.md`/current Plan/current
`DEV_STATUS` are HOT; `CONTEXT_MAP`/`OPEN_QUESTIONS` are WARM; `MASTER_SPEC`, ADRs, `.claude/rules/*`,
technical docs, and telemetry docs are COLD; historical Run Reports and superseded plans are
RESTRICTED. Don't preload WARM/COLD/RESTRICTED material merely because it exists. See `CLAUDE.md`
§3 for the authoritative tiers.

## 3. Slice lifecycle at a glance

`INSPECT → IMPLEMENT → TARGETED VERIFICATION → RISK REVIEW → FIX MATERIAL FINDINGS → FINAL RELEVANT VERIFICATION → EVIDENCE CHECKPOINT → COMMIT`

Orchestrated by `.claude/skills/implement-slice/SKILL.md`. Verification selection/freshness is
owned by `.claude/rules/testing.md`; reviewer selection by `.claude/skills/review-commit/SKILL.md`;
the evidence/readiness gate by `.claude/skills/checkpoint/SKILL.md`. See `CLAUDE.md` §7.

## 4. `/checkpoint` and `/review-commit`

- `/checkpoint` — evidence and repository-state validator, not a second test runner. Reuses fresh
  evidence, runs only what's missing/stale, and returns a verdict. See
  `.claude/skills/checkpoint/SKILL.md`.
- `/review-commit` — sole owner of risk-based reviewer selection (none / general / DB / security /
  a justified combination) and reviewer orchestration. See `.claude/skills/review-commit/SKILL.md`.

## 5. Run-close identity model

Runs are identified by three explicit fields instead of a self-citing "Final HEAD":

- `START_HEAD` — the commit the Run began from.
- `LAST_VERIFIED_HEAD` — the most recent commit actually verified at Run close.
- `RUN_STATUS` — the Run's current disposition (e.g. `COMPLETE`).

This replaced an older "Final HEAD" pattern that could never correctly cite the hash of the very
commit introducing it. A deterministic, zero-AI verifier checks these fields plus the matching
`docs/RUNS/<RUN_ID>.md` report:

```
node .claude/telemetry/verify-run-close.mjs [--pre-close]
```

Use `--pre-close` when checking Run-close doc edits before the closing commit exists. See the
script's own header comment for exact scope/behavior, and `docs/DEV_STATUS.md` /
`docs/CHATGPT_PLAN.md` for a live example of the fields in use.

## 6. Telemetry and KEEP / WATCH / CHANGE

Local execution metadata is collected under `.claude/telemetry/` (`collect.mjs`, `summarize.mjs`,
`statusline.mjs`, plus the Run-close verifier above). Telemetry is an observability layer, not
working context — don't load it or narrate it during normal implementation (`CLAUDE.md` §15).

When you do interpret telemetry, every efficiency signal is read beside its paired quality signal,
and an observation moves through `MEASURE → INTERPRET → COMPARE → ACT`, landing on `KEEP` (no
change), `WATCH` (noted, not yet acted on), or `CHANGE` (promoted to an actual policy/process
change) — never `measure → immediately optimize`. Full model: `docs/DEVOS_OBSERVABILITY.md`.

## 7. `/clear` vs `/compact` vs `/rename` + `/clear` + `/resume`

Practical, not prescriptive:

- **`/clear`** — start a new session with empty context. Use at a clean Slice/Run boundary once
  durable state (`DEV_STATUS.md`, the Plan, a Run report, or a scratch checkpoint) already captures
  what the next session needs to resume from. Cheapest option when you don't need this session's
  transcript again.
- **`/compact`** — shrink the current session's context in place while staying in the same session.
  Use mid-Slice when context has grown large but you still want this session's live state (partial
  edits, open questions) rather than a resume packet.
- **`/rename` + `/clear` + `/resume`** — give the current session a durable name before clearing it,
  so you (or another agent) can find and resume it later instead of losing it to the session list.
  Use this instead of a bare `/clear` when the session itself (not just its written artifacts) is
  worth being able to come back to.

When in doubt, prefer writing durable state to the repository (Git, `DEV_STATUS`, scratch checkpoint)
over relying on session memory at all — see `CLAUDE.md` §16, Handoff Model.

## 8. Long Autonomous Runs (current shape, not a formal policy)

Some Runs are driven by a thin parent orchestrator that never does the implementation work itself:
it dispatches each Slice to a fresh, sequential, scoped worker (no inherited context except a
compact handoff), consumes that worker's short structured report, updates a Run-local
`scratch/development_checkpoint.md` (Run goal, Slice queue, completed Slices, blockers, current
Slice, uncommitted work, last verification), and dispatches the next Slice. Reviewers are likewise
fresh agents invoked per `.claude/skills/review-commit/SKILL.md` only when a Slice's risk warrants
one. Workers run one at a time (single writer), not in parallel.

This is an observed working pattern as of this Run, not yet a packaged skill. If a formal reusable
skill for it exists, look for it under `.claude/skills/` (e.g. `.claude/skills/autonomous-run/`) and
prefer that over reconstructing the pattern from scratch.
