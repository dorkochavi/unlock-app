# UNLOCK — Backup / Disaster Recovery Policy (V1)

Status: APPROVED (human-owned policy; recorded 2026-10-04, Run BACKUP-DR-V1-IMPLEMENTATION-001 Slice A).
Owner: Dor Kochavi (accountable). Backup policy only; this is not Product Data Retention.
Companions: `docs/RESTORE_RUNBOOK.md` (local restore tool), `docs/FOLLOW_UP_BACKLOG.md` FUB-009 (status), `docs/PILOT_READINESS.md` §3 item 13c.

## Roles
Dor Kochavi is accountable. Agents execute and verify the documented procedure but do not change retention, RPO/RTO, encryption policy, hosted backup settings, destructive recovery, or external access policy.

## Frequency
- Daily Production-state backup.
- Extra backup before: a hosted migration, a significant Auth change, a significant release, a destructive/irreversible data operation.
- Restore drills run on a separate cadence.

## FULL scope
A FULL backup covers database schema/state, business (public) data, Auth, and migration metadata/state. A public-only backup is NOT FULL.

## Objectives (internal, not an SLA)
- RPO: <= 24h routine; approximately 0 around planned significant changes via the pre-change backup.
- RTO: <= 12h from detection/owner awareness to restoration. No 24/7 detection or response is promised.

## Retention (backups only)
Daily backups 30 days; event-driven backups 90 days; one monthly backup kept 12 months.

## Storage and encryption
Storage location and encryption are not in the repo. Required: an encrypted local copy and an encrypted off-device copy; Auth/PII backups encrypted at rest; access limited to the owner and explicitly authorized people; encryption keys are not stored beside the backup; the manifest holds metadata/hashes/counts and no secrets.

## Pilot DR gate
Before real Pilot users: at least one backup made with the new FULL procedure, a disposable LOCAL restore drill, and FULL recovery proven for database + Auth + migration state. An Auth-aware FULL restore is a Pilot gate.

## Procedure V1
Create -> Validate -> Store -> Restore-drill -> Retain.
Artifacts (approximate; exact format may change per tooling evidence): public schema, public data, Auth schema/state, Auth data, migration state, roles/grants, triggers/functions, manifest.
Manifest where available: timestamp, environment, versions, migration count/latest, row counts, SHA-256 per artifact, tool version, scope/completeness, no secrets.

## NOT proven / not claimed
Point-in-time recovery (PITR) and the Supabase plan's managed backups are unverified; no 24/7 detection/response; no hosted restore or hosted DR exercised; a faithful Auth restore is not yet proven (current backups lack Auth DDL and GoTrue version; local drill is PARTIAL); sign-in usability after restore, storage objects, vault secrets and project settings are not covered.
