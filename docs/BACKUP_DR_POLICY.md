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

### Operating model (Slice D, Run BACKUP-DR-V1-IMPLEMENTATION-001)
Status per policy element: encrypted local copy = IMPLEMENTED (`backup:encrypt`); encrypted off-device copy = DOCUMENTED procedure, destination/provider = HUMAN_CONFIGURATION_REQUIRED (the owner chooses; no provider is assumed or configured); key separation = IMPLEMENTED guard (key refused inside repo/backup dir) + DOCUMENTED custody; access restriction = DOCUMENTED, owner-enforced (OS/provider permissions are not verifiable from the repo); retention = DOCUMENTED checklist + read-only `backup:retention` report, deletion is manual by the owner.
- Tool choice (evidence: this Windows host has Git-bundled openssl 3.5.7 and gpg 2.4.9 only, neither a supported standalone install; no age, no 7z; BitLocker status needs admin and was not readable): Node built-in crypto, no install. `openssl enc` has no authenticated (AEAD) streaming mode, so a documented chunked AES-256-GCM construction is used instead of a hand-rolled one. If the owner prefers age/gpg, an independently produced encrypted copy is acceptable for the off-device step; this format is for the local copy and drill.
- Format `UBKENC01` (`scripts/lib/backup-crypto.mjs`, one `<artifact>.enc` per artifact): header 36 bytes = magic | chunk_size | key_id | file_salt; records = random 96-bit nonce | length | ciphertext | 16-byte tag. AES-256-GCM, per-file key = HKDF-SHA256(master, file_salt). AAD binds header, artifact name, chunk index and a final-chunk flag, so truncation, dropped/reordered/appended chunks and file swaps fail closed. Streamed (4 MiB chunks), so large dumps work.
- Key: 32 random bytes in a key file (`npm run backup:keygen -- --key-file <path>`, never overwrites, prints only the non-secret key_id). Passphrase mode is not implemented (deferred). `MANIFEST.json` stays readable (no secrets) and is bound to the key by an HMAC-SHA256 (`encryption.manifest_hmac_sha256`); it records `encryption: {status: ENCRYPTED, algorithm, format_version, key_id, chunk_size, artifacts[{encrypted_file, encrypted_sha256, encrypted_bytes}]}` and keeps the plaintext sha256 per artifact. `backup:validate` on an encrypted dir checks ciphertext hashes without the key and is at most PARTIAL (`encrypted-requires-decrypt-for-toc`); `backup:decrypt` verifies every chunk, the plaintext hashes and the MAC.
- Key custody: the owner (Dor Kochavi) holds the key. It must never be stored in the repo, in the backup directory, or next to the off-device copy. Keep a second copy in separate offline custody (e.g. a password manager or printed/offline media the owner controls). Key loss means every backup encrypted with it is unrecoverable; there is no recovery path. Rotating means creating a new key and re-encrypting retained backups (decrypt with the old key, encrypt with the new).
- Access: owner only by default. Anyone else needs the owner's explicit authorization for BOTH the encrypted backup location and, separately, the key; record who and when in the owner's own records (not in the repo). Decrypted output is plaintext PII: create it only in a fresh directory outside the repo, use it for the drill, then delete it (`Remove-Item -Recurse -Force <dir>`). `--remove-plaintext` is a plain unlink, not a secure erase on SSD/NTFS/snapshots; do not rely on it as sanitisation.
- Retention / cleanup checklist: (1) `npm run backup:retention -- <backups-root>` lists `EXPIRED-CANDIDATE` packages by manifest class and created_at (daily 30 days, event 90 days, monthly 12 months). It is read-only and never deletes. (2) The owner confirms each candidate is not the one monthly backup they are keeping, and that a newer verified backup exists. (3) The owner deletes the encrypted package at BOTH the local and the off-device location by hand. (4) Delete any leftover plaintext/decrypted directories regardless of age. UNKNOWN entries are never assumed expired.

## Pilot DR gate
Before real Pilot users: at least one backup made with the new FULL procedure, a disposable LOCAL restore drill, and FULL recovery proven for database + Auth + migration state. An Auth-aware FULL restore is a Pilot gate.

## Procedure V1
Create -> Validate -> Store -> Restore-drill -> Retain.
Artifacts (approximate; exact format may change per tooling evidence): public schema, public data, Auth schema/state, Auth data, migration state, roles/grants, triggers/functions, manifest.
Commands/layout: `docs/RESTORE_RUNBOOK.md` "Procedure V1 commands" (`npm run backup:create|backup:validate`, `restore:local`). Manifest where available: timestamp, environment, versions, migration count/latest, row counts, SHA-256 per artifact, tool version, scope/completeness, no secrets.

## NOT proven / not claimed
Proven so far: the V1 MECHANICS (create -> validate -> encrypt/decrypt -> restore drill) on a SYNTHETIC GoTrue-replay local source. A real hosted V1 backup plus a drill of it are still required (Pilot DR gate).
Not proven / not claimed: point-in-time recovery (PITR) and the Supabase plan's managed backups; 24/7 detection/response; any hosted restore or hosted DR; hosted `pg_dump`/`pg_dumpall` privileges of the `postgres` role over `auth`/`supabase_migrations`; hosted GoTrue version equality (FULL = package restored into a real local Auth schema only); sign-in usability after restore; pooler behavior; role attributes/memberships/default privileges, publications, event triggers and extension version drift; sequence values (only row counts are checked); storage objects, vault secrets and project settings. The restore drill's `drop schema auth/public cascade` also removes dependents in other schemas of the disposable container. Plaintext manifests are not authenticated (only encrypted packages are MAC-bound), so anyone who can modify a plaintext package can also modify its hashes.
