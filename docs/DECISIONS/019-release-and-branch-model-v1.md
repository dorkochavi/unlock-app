# ADR-019: Release and Branch Model V1

Status: ACCEPTED

## Context

Until 2026-09-26 all development lived on one long-lived branch (`feature/project-foundation`) while `main` was the
repository's "Initial commit" and Production ran a feature-branch commit. There was no CI and no tag. The environment
model (Local → Vercel Preview → Production, one application, no Staging) lives in `docs/PILOT_READINESS.md` §2; nothing
recorded how code reaches Production. The first real promotion (Run 009 work plus a minimal CI) has now worked end to
end, so this ADR records the model that was actually proven. It does not restate the environment model.

## Decision

1. **`main` is Production truth.** Vercel's Production Branch is `main`; what is on `main` is what Production should run.
   `main` advances only by fast-forward to a commit that has been verified in Preview.
2. **Short-lived branches.** Work happens on bounded `feature/*` and `fix/*` branches, not on a permanent development
   branch. A Preview deployment of the branch is the pre-promotion verification surface.
3. **CI gate.** A minimal GitHub Actions workflow (`.github/workflows/ci.yml`: install, typecheck, lint, fast unit
   tests; no secrets, database, hosted access or deployment) must pass on the commit before it is promoted. The schema
   suite is not part of it and stays a pre-release manual/on-demand check. Making the check a required status check is
   deferred until pull requests become the normal merge path.
4. **Migrations.** When a change includes a schema migration, database compatibility must be verified before
   promotion to Production: the schema must be applied and compatible with the code being promoted (and with the code
   still running until the deployment completes). Applying a migration is a human action (`.claude/rules/postgres.md`).
5. **Production verification.** After the deployment is Ready, the promoted behavior is verified in Production by a
   human before the baseline is considered verified.
6. **Tags.** An annotated tag (`v0.N.0`; `v0.N.x` for fixes) is created on `main` only after a promotion has been
   verified in Production. Tags mark deployable, verified runtime baselines, not every Run or every commit. Docs-only
   commits may advance `main` (and therefore the deployed Git SHA) past the last tag without a new tag, provided runtime
   behavior is unchanged. The Run report and the commit ledger continue to own per-Run traceability.
7. **No GitHub Release requirement yet.** Annotated tags are sufficient until a named pilot baseline needs release notes.
8. **Agents never push or deploy.** Consistent with `CLAUDE.md` §6: pushing `main`, promoting, changing Vercel
   settings, and creating or pushing tags are human actions.

## Consequences

- A verified Production baseline is not a pilot approval; pilot gates stay owned by `docs/PILOT_READINESS.md`.
- Force pushes and deletion of `main` should be blocked and linear history required (GitHub branch protection,
  configured by the human; not enforced by code in this repository).
- The first Linux CI run exposed a real defect class: generated Next types (`LayoutProps`) are gitignored, so
  `npm run typecheck` now runs `next typegen` first. Windows-only assumptions can still surface in CI.
- Run reports and the Plan's Run-start contract name the working branch of their own Run; they do not redefine this model.

## Alternatives Considered

### Keep one long-lived development branch
Rejected: `main` could not represent Production, promotion had no defined step, and rollback points were unnamed.

### Required pull requests and required status checks now
Deferred: no reviewer other than the author exists, and GitHub enforces required checks only through pull requests.
Revisit with more contributors or higher release frequency.

### Tag every Run or every Preview
Rejected: Run reports and commit hashes already give that traceability; tags would dilute the meaning of "verified baseline".

## Related Documents

- `docs/PILOT_READINESS.md` §2 (environment model, pilot gates); `docs/DEV_STATUS.md` (current release state)
- `.github/workflows/ci.yml`; `.claude/rules/postgres.md`; `CLAUDE.md` §6 (agent safety boundaries)
- ADR-013 (PostgreSQL + Supabase provider)
