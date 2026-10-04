#!/usr/bin/env node
/**
 * Backup Procedure V1: create a canonical backup package from a Postgres source (read-only).
 * See docs/RESTORE_RUNBOOK.md "Procedure V1 commands".
 *
 *   npm run backup:create -- --label daily --out <dir outside repo> --confirm-read-only-source [--source-env SUPA_DB_URL]
 *        [--environment <name>] [--image <supabase/postgres tag>] [--no-pgoptions] [--dry-run]
 *
 * The source URL is read ONLY from the env var named by --source-env (default SUPA_DB_URL), is split into PGHOST/PGPORT/
 * PGUSER/PGPASSWORD/PGDATABASE/PGSSLMODE for a throwaway container (docker gets variable NAMES only, never the URL or any
 * value in argv), and is never printed or stored. Hosted sources require TLS (sslmode require|verify-ca|verify-full or,
 * when absent, PGSSLMODE=require).
 * Exit: 0 FULL_CANDIDATE written, 2 PARTIAL written (reasons listed), 1 refused/failed (nothing is left behind).
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, rmSync, statSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizedEnv } from "./lib/restore-local.mjs";
import { DEFAULT_IMAGE, IMAGE_RE, assertDockerLocal, assertImageLocal, buildSourceRunArgs, imageMajor, readTocViaDocker } from "./lib/backup-docker.mjs";
import {
  BackupError, DEFAULT_SOURCE_ENV, DUMP_FILE, DUMP_SCHEMAS, INFO_FILE, LABELS, MANIFEST_FILE, ROLES_FILE, TEST_NAME_RE,
  SOURCE_ENV_NAMES, assertOutputOutsideRepo, buildCountSql, buildInfoSql, buildManifest, buildMigrationStateSql, buildRelationshipSql, hostFingerprint, parseCountOutput,
  parseInfoOutput, parseMigrationState, parseRelationshipCounts, parseSourceUrl, sourceContainerEnv, parseToc, redact, repoMigrationInfo, retentionFor, serverMajor, sha256File, summarizeToc, timestampUtc,
} from "./lib/backup-package.mjs";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = (s = "") => process.stdout.write(s + "\n");

const VALUE_FLAGS = new Set(["--label", "--out", "--source-env", "--environment", "--image", "--test-local-source"]);
const BOOL_FLAGS = new Set(["--confirm-read-only-source", "--dry-run", "--no-pgoptions"]);

function parseArgs(argv) {
  const o = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (BOOL_FLAGS.has(a)) o.flags.add(a);
    else if (VALUE_FLAGS.has(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new BackupError("USAGE", `${a} needs a value`);
      o.values[a] = v;
    } else throw new BackupError("USAGE", `unsupported argument ${a.startsWith("--") ? a.split("=")[0] : "(positional)"}`);
  }
  return o;
}

let backupDir = null;
let created = false;
let containerName = null;
const secrets = [];
const docker = (a, o = {}) => spawnSync("docker", a, { encoding: "utf8", env: o.env, input: o.input, maxBuffer: 512 * 1024 * 1024 });
function cleanupContainer() {
  if (containerName) docker(["rm", "-f", "-v", containerName], { env: sanitizedEnv() });
  containerName = null;
}
function cleanupDir() {
  if (created && backupDir) {
    try {
      rmSync(backupDir, { recursive: true, force: true });
    } catch {
      /* best effort; reported by the caller as an incomplete cleanup */
    }
  }
}
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => (cleanupContainer(), cleanupDir(), process.exit(1)));

async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2));
  const label = values["--label"];
  if (!label || !LABELS.includes(label)) throw new BackupError("USAGE", `--label must be one of ${LABELS.join("|")}`);
  const environment = values["--environment"] ?? "unspecified";
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(environment)) throw new BackupError("USAGE", "--environment must match [a-z0-9-]{1,32}");
  const image = values["--image"] ?? DEFAULT_IMAGE;
  if (!IMAGE_RE.test(image)) throw new BackupError("IMAGE_INVALID", "image must be a supabase/postgres tag");

  const testNet = values["--test-local-source"];
  if (testNet !== undefined) {
    // TEST-ONLY path (documented): a disposable local source container on a disposable docker network.
    if (process.env.UNLOCK_BACKUP_TEST_MODE !== "1") throw new BackupError("TEST_MODE_REQUIRED", "--test-local-source needs UNLOCK_BACKUP_TEST_MODE=1");
    if (!TEST_NAME_RE.test(testNet)) throw new BackupError("TEST_MODE_REQUIRED", "test network must be named unlock-bkptest-*");
  }

  const outRoot = values["--out"] ?? process.env.BACKUP_DIR;
  const outReal = assertOutputOutsideRepo(outRoot, REPO);

  const envName = values["--source-env"] ?? DEFAULT_SOURCE_ENV;
  if (!/^[A-Z_][A-Z0-9_]{0,63}$/.test(envName)) throw new BackupError("USAGE", "--source-env must be an upper-case env var NAME");
  const raw = process.env[envName];
  if (!raw) throw new BackupError("SOURCE_ENV_MISSING", `env var ${envName} is not set`);
  const src = parseSourceUrl(raw, { testMode: testNet !== undefined });
  secrets.push(raw, src.password);
  try {
    secrets.push(new URL(raw).password);
  } catch {
    /* parseSourceUrl already validated */
  }
  const fp = hostFingerprint(src.host);

  const ts = timestampUtc();
  const dirName = `${label}-${ts}`;
  const target = join(outReal, dirName);
  assertOutputOutsideRepo(target, REPO);

  if (flags.has("--dry-run")) {
    out("DRY-RUN: nothing is read from or written to any database or disk");
    out(`label: ${label}  retention: ${JSON.stringify(retentionFor(label))}`);
    out(`environment: ${environment}`);
    out(`output dir: ${target}`);
    out(`source env var: ${envName} (value never printed)`);
    out(`source: host fingerprint sha256=${fp.slice(0, 16)}... port=${src.port} database=${src.database} sslmode=${src.sslmode ?? (testNet ? "(default)" : "(absent => PGSSLMODE=require)")} user=[redacted] password=[redacted]`);
    out(`image: ${image} (local only, --pull never)${testNet ? `  [TEST MODE network ${testNet}]` : ""}`);
    out(`read-only: PGOPTIONS=-c default_transaction_read_only=on${flags.has("--no-pgoptions") ? " DISABLED (--no-pgoptions)" : ""}; pg_dump is read-only by construction`);
    out(`container env (names only, values never printed): ${SOURCE_ENV_NAMES.join(" ")}; no URL in argv or container config`);
    out("container: --cap-drop ALL --security-opt no-new-privileges --memory 2g --pids-limit 512");
    out(`1. psql -X -At (PG* env) < info/migrations/relationship/row-count queries (SELECT only)`);
    out(`2. pg_dump -w -Fc ${DUMP_SCHEMAS.map((s) => `--schema=${s}`).join(" ")} -f ${DUMP_FILE}`);
    out(`3. pg_dumpall -l <database> -w --roles-only --no-role-passwords -f ${ROLES_FILE}`);
    out(`4. migration state + row counts again, pg_restore -l ${DUMP_FILE} (network none), then ${INFO_FILE} and ${MANIFEST_FILE}`);
    out("RESULT: DRY-RUN (no backup created)");
    return 0;
  }

  if (!flags.has("--confirm-read-only-source")) throw new BackupError("CONFIRM_FLAG_REQUIRED", "pass --confirm-read-only-source to confirm the source is read through a read-only procedure");

  assertDockerLocal(process.env);
  assertImageLocal(image);
  if (!existsSync(outReal)) mkdirSync(outReal, { recursive: true, mode: 0o700 }); // NTFS relies on directory ACLs, not mode bits
  if (assertOutputOutsideRepo(outReal, REPO) !== outReal) throw new BackupError("OUTPUT_PATH_UNSAFE");
  mkdirSync(target, { mode: 0o700 }); // fails if it exists: never overwrite a backup
  backupDir = target;
  created = true;

  const baseEnv = sanitizedEnv(process.env);
  // PG* values exist only in the docker CLIENT's env; docker gets their NAMES (-e NAME). No URL anywhere in argv/config.
  const srcEnv = sourceContainerEnv(src, { testMode: testNet !== undefined, pgoptions: !flags.has("--no-pgoptions") });
  const runEnv = { ...baseEnv, ...srcEnv };
  const envNames = SOURCE_ENV_NAMES.filter((n) => n in srcEnv);
  const sh = (script, { input, mount = true } = {}) => {
    containerName = `unlock-backup-${randomBytes(4).toString("hex")}`;
    // umask 077: anything the container writes into the bind mount is owner-only.
    const a = buildSourceRunArgs({ containerName, image, network: testNet, targetDir: target, withInput: input !== undefined, withMount: mount, envNames, script: mount ? `umask 077; ${script}` : script });
    const r = docker(a, { env: runEnv, input });
    cleanupContainer();
    return { ok: r.status === 0, out: r.stdout ?? "" }; // stderr intentionally dropped
  };
  const psqlRun = (sql) => sh("psql -X -A -t -q -w -F '|' -v ON_ERROR_STOP=0", { input: sql, mount: false });

  const info = psqlRun(buildInfoSql());
  const parsed = parseInfoOutput(info.out);
  if (!info.ok || !parsed.server_version) throw new BackupError("INFO_QUERY_FAILED", "could not read server information from the source");
  const sMajor = serverMajor(parsed.server_version);
  if (!(sMajor <= imageMajor(image))) throw new BackupError("CLIENT_TOO_OLD", `source major ${sMajor} is newer than the image's pg client`);

  const before = parseCountOutput(psqlRun(buildCountSql(parsed.tables)).out, parsed.tables);
  const relationships = parseRelationshipCounts(psqlRun(buildRelationshipSql()).out);

  const dump = sh(`pg_dump -w -Fc ${DUMP_SCHEMAS.map((s) => `--schema=${s}`).join(" ")} -f /out/${DUMP_FILE}`);
  if (!dump.ok || !existsSync(join(target, DUMP_FILE)) || statSync(join(target, DUMP_FILE)).size === 0) throw new BackupError("DUMP_FAILED", "pg_dump did not complete");
  const roles = sh(`pg_dumpall -l "$PGDATABASE" -w --roles-only --no-role-passwords -f /out/${ROLES_FILE}`);
  const rolesPath = join(target, ROLES_FILE);
  for (const f of [join(target, DUMP_FILE), rolesPath]) {
    try {
      chmodSync(f, 0o600); // best effort (no-op on NTFS; on POSIX the container already ran with umask 077)
    } catch {
      /* file missing or not owned by this user */
    }
  }
  const rolesOk = roles.ok && existsSync(rolesPath) && statSync(rolesPath).size > 0;
  if (!rolesOk && existsSync(rolesPath)) unlinkSync(rolesPath);

  const after = parseCountOutput(psqlRun(buildCountSql(parsed.tables)).out, parsed.tables);
  // The info/migration state above was read BEFORE the dump: re-read it so a migration that landed mid-dump is detected.
  const migrationsAfter = parseMigrationState(psqlRun(buildMigrationStateSql()).out);

  let tocText;
  try {
    tocText = readTocViaDocker(join(target, DUMP_FILE), image);
  } catch {
    throw new BackupError("TOC_FAILED", "pg_restore -l could not read the new dump");
  }
  const toc = parseToc(tocText);
  const tocSummary = summarizeToc(toc);

  const infoText =
    [`server_version: ${parsed.server_version}`, "extensions (name version):", ...parsed.extensions.map((e) => `${e.name} ${e.version}`)].join("\n") + "\n";
  writeFileSync(join(target, INFO_FILE), infoText, { flag: "wx", mode: 0o600 });

  const split = (c) => ({
    public: Object.fromEntries(Object.entries(c).filter(([k]) => k.startsWith("public."))),
    auth: Object.fromEntries(Object.entries(c).filter(([k]) => k.startsWith("auth."))),
  });
  const artifacts = [];
  for (const f of [DUMP_FILE, ROLES_FILE, INFO_FILE]) {
    const p = join(target, f);
    if (existsSync(p)) artifacts.push({ file: f, sha256: await sha256File(p), bytes: statSync(p).size });
  }
  const repo = repoMigrationInfo(join(REPO, "supabase", "migrations"));
  const evidence = {
    dumpPresent: true,
    rolesPresent: rolesOk,
    infoPresent: true,
    toc: tocSummary,
    migrations: { supabase_migrations: parsed.supabase_migrations, auth: parsed.auth_migrations },
    migrationsAfter,
    relationships,
    rowCounts: split(before),
  };
  const manifest = buildManifest({
    createdAt: new Date().toISOString(),
    label,
    environment,
    hostFingerprint: fp,
    envVarName: envName,
    info: parsed,
    toc,
    image,
    readOnlyEnforcement: flags.has("--no-pgoptions") ? "pg_dump-read-only-transaction-only" : "PGOPTIONS-default_transaction_read_only+pg_dump-read-only-transaction",
    repo,
    evidence,
    rowCountsAfter: split(after),
    artifacts,
  });
  const text = JSON.stringify(manifest, null, 2) + "\n";
  if (redact(text, secrets) !== text) throw new BackupError("MANIFEST_SECRET_GUARD", "manifest would contain a secret; aborted");
  writeFileSync(join(target, MANIFEST_FILE), text, { flag: "wx", mode: 0o600 });

  out(`backup dir: ${target}`);
  for (const a of artifacts) out(`artifact ${a.file}: ${a.bytes} bytes sha256=${a.sha256.slice(0, 16)}...`);
  out(`retention class: ${manifest.retention.class}`);
  out(`encryption: ${manifest.encryption.status} (encrypt before storing off-device; Slice D)`);
  created = false; // keep the package
  if (manifest.completeness.level === "FULL_CANDIDATE") {
    out("RESULT: FULL_CANDIDATE (not proven FULL until a local restore drill passes)");
    return 0;
  }
  out(`RESULT: PARTIAL reasons=${manifest.completeness.reasons.join(",")}`);
  return 2;
}

let code = 1;
try {
  code = await main();
} catch (e) {
  cleanupContainer();
  cleanupDir();
  if (e instanceof BackupError) {
    process.stderr.write(`backup-create refused: code=${e.code}${e.message !== e.code ? ` (${redact(e.message.slice(e.code.length + 2), secrets)})` : ""}\n`);
  } else {
    process.stderr.write("backup-create failed: code=UNEXPECTED_ERROR\n");
  }
  code = 1;
}
process.exit(code);
