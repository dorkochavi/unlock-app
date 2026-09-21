# UNLOCK — Operational Testing & Evidence Rule

Status: ACTIVE
Owner: verification selection, freshness, invalidation, escalation

Conceptual testing strategy lives in `docs/TESTING.md`.
This rule answers: **what evidence must be produced or refreshed now?**

## 1. Default

Use the smallest relevant evidence set that can prove the changed behavior safely.

During implementation, prefer targeted tests for fast feedback.
After review-driven fixes, run the final relevant verification set.
Do not automatically run every suite at every Slice or Run boundary.

## 2. Freshness Model

Evidence remains fresh while no later change materially affects what it proves.

Algorithm:
1. Is this evidence required for the current risk?
2. Does suitable evidence already exist?
3. Did a relevant change occur after it?
   - no → reuse it;
   - yes → stale; rerun the affected evidence only.
4. If relevance cannot be determined safely → treat as stale.

Examples:
- schema PASS + Markdown-only change → reuse schema evidence;
- schema PASS + migration/SQL mapping change → stale;
- security review + CSS/copy change → reuse;
- security review + auth/authorization change → stale;
- typecheck PASS + docs-only change → reuse;
- unit PASS + shared domain logic change → stale for affected unit evidence.

## 3. Change-Class Guidance

### Documentation / governance only
Normally require:
- structural/reference checks;
- syntax/frontmatter/JSON validation where executable config changed;
- focused diff review.

Do not run product full suites by default.

### UI/presentation only
Use relevant component/browser/type/lint evidence as warranted by the actual change.
No schema/DB reviewer merely because the project has a database.

### Domain/application behavior
Use focused unit/application tests for the changed logic.
Escalate to broader unit coverage when shared behavior or cross-cutting risk makes it useful.

### API/auth/trust boundary
Use focused route/application tests and relevant auth-ordering/security evidence.
Security review is chosen by `review-commit`, not this rule.

### PostgreSQL/migration/repository
Use focused persistence tests plus schema/PGlite evidence as relevant.
Real PostgreSQL/hosted/manual evidence is required only for claims that local evidence cannot prove.

### Build/tooling/config
Run the smallest syntax/build/tool validation capable of proving the configuration change.

## 4. Evidence Categories

Use as relevant:
- focused unit/application tests;
- broader/full unit suite;
- schema/PGlite suite;
- typecheck;
- lint;
- production build;
- browser E2E;
- hosted/manual verification;
- structural/reference checks;
- reviewer evidence.

No category is universally mandatory for every Slice.

## 5. Full Unit Suite

Run the full unit suite when it provides distinct confidence, for example:
- shared domain/application primitives changed;
- many test surfaces may be affected;
- a Run-level integration claim lacks broader regression evidence;
- targeted tests reveal uncertainty suggesting wider impact.

Do not rerun it solely because a Slice/Run is ending if a fresh suitable result already exists.

## 6. Schema / PGlite

Run schema/PGlite evidence for DB-relevant changes such as:
- migrations;
- schema contracts;
- repository SQL/mapping;
- transaction behavior covered by those tests.

Do not rerun after unrelated UI/docs changes.

State PGlite limits honestly; it does not prove all real PostgreSQL/Supabase/concurrency behavior.

## 7. Typecheck / Lint / Build

Use them when the changed surface can affect what they prove.

Typical guidance:
- TypeScript/code changes → typecheck often relevant;
- lint-sensitive source/config changes → lint may be relevant;
- Next.js/build configuration, route composition, or production compilation risk → build may be relevant;
- Markdown-only changes → normally none of these are required.

Evidence freshness still applies.

## 8. Browser E2E

Use browser evidence for meaningful user journeys or browser/session/UI integration that lower layers cannot prove adequately.

Do not execute browser tests automatically for unrelated backend/docs work.

Do not manufacture unsafe hosted fixtures merely to satisfy a generic E2E requirement.

## 9. Hosted / Manual Verification

Use hosted verification only when the claim depends on hosted behavior.

Never imply that local tests prove:
- hosted migration application;
- Supabase managed-auth behavior;
- production network/deployment behavior;
- true multi-connection concurrency not exercised locally.

## 10. Reviewer-Driven Changes

After review fixes:
- invalidate only evidence affected by the fix;
- rerun the relevant final evidence;
- keep unrelated fresh evidence.

Reviewer selection belongs exclusively to `review-commit`.

## 11. Run-End Acceptance

Run completion should verify only missing/unproven integration behavior.

Do not automatically replay:
- full unit;
- schema;
- build;
- browser E2E;
- specialist review;

when valid Slice evidence already proves the required behavior and no later relevant change occurred.

## 12. Background Tasks

Do not repeatedly poll long-running tests.
Start once; do useful independent work; otherwise wait for completion notification.

## 13. Evidence Record

When reporting evidence, include only what is useful:
- evidence/check name;
- result;
- scope/environment if material;
- freshness basis when reusing prior evidence.

Avoid inflating reports with every incidental command.

## 14. Failures

If required verification fails:
- determine whether failure is caused by the current change;
- fix current-scope regressions;
- do not silently broaden scope to repair unrelated failures;
- report unrelated pre-existing blockers accurately.

## 15. Commands

Canonical script names live in `package.json`.
Inspect it rather than duplicating a long command catalog here.

## 16. Stop Condition

Verification is sufficient when all evidence required for the actual changed-risk surface exists, is fresh, and is green at the strongest appropriate environment.
