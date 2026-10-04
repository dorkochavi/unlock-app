#!/usr/bin/env node
/**
 * Local backup validate / restore drill. See docs/RESTORE_RUNBOOK.md.
 * Layouts: package (MANIFEST.json + 10-full.dump, Backup Procedure V1) and legacy 3-file (capped at PARTIAL).
 *
 *   node scripts/restore-local-backup.mjs validate <backup-dir>
 *   node scripts/restore-local-backup.mjs restore  <backup-dir> [--keep] [--image <local image>] [--publish 127.0.0.1:<port>:5432]
 *
 * validate: read-only file checks, never touches Docker.
 * restore : creates ONE disposable container (unlock-restore-*), --network none by default,
 *           backup mounted read-only, random throwaway password (never printed), always removed
 *           unless --keep. Ignores DATABASE_URL/SUPABASE_* env. Prints counts only.
 * Exit: FULL 0, FAIL 1, PARTIAL 2 (auth not recovered), usage/refusal 1.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_IMAGE,
  NAME_PREFIX,
  STAGE_SCHEMA,
  assertSafeRunOptions,
  buildAuthStageSql,
  buildMigrationsSql,
  assertLocalDockerEndpoint,
  assertSafeDockerEnv,
  classifyResult,
  makeCounter,
  extractTriggerSql,
  parseCopyBlocks,
  quoteIdent,
  repoMigrationVersions,
  sanitizedEnv,
  validateBackupDir,
} from "./lib/restore-local.mjs";
import { assertDockerLocal, assertImageLocal, readTocViaDocker } from "./lib/backup-docker.mjs";
import { isEncryptedPackageDir } from "./lib/backup-crypto.mjs";
import {
  MANIFEST_FILE, ROLES_FILE, DUMP_FILE, classifyPackageRestore, countWithinRange, parseRoleNames, validatePackage,
} from "./lib/backup-package.mjs";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = (s = "") => process.stdout.write(s + "\n");

function printValidate(r) {
  const s = r.summary;
  for (const [f, v] of Object.entries(s.files)) out(`file ${f}: ${v.exists ? `${v.bytes} bytes` : "MISSING"}`);
  out(`public tables in 01: ${s.schemaTables ?? "n/a"}; public COPY blocks in 02: ${s.publicBlocks}`);
  out(`auth COPY blocks in 03: ${s.authBlocks}; populated: ${s.authPopulated.length} (${s.authPopulated.join(", ") || "none"})`);
  out(`schema_migrations rows in 03: ${s.migrationRows}`);
  for (const n of r.notes) out(`note: ${n}`);
  for (const p of r.problems) out(`problem: ${p}`);
  out(r.ok ? "VALIDATE: backup files structurally complete (no restore performed)" : "VALIDATE: FAIL");
}

const args = process.argv.slice(2);
const mode = args[0];
const dir = args[1] && !args[1].startsWith("--") ? resolve(args[1]) : null;
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!["validate", "restore"].includes(mode) || !dir) {
  console.error("usage: restore-local-backup.mjs <validate|restore> <backup-dir> [--keep] [--image i] [--publish p]");
  process.exit(1);
}

// Unknown options are refused (never silently ignored): in particular --url / external targets.
const KNOWN_FLAGS = new Set(["--keep", "--image", "--publish"]);
// Exact match only: --keep=x / --image=x forms are refused too.
const badFlag = args.slice(2).find((a) => a.startsWith("--") && !KNOWN_FLAGS.has(a));
if (badFlag) {
  console.error(`restore refused: unsupported option ${badFlag.split("=")[0]}; external targets are not supported (only the script's own disposable container)`);
  process.exit(1);
}

// Docker-redirect env is checked before anything else (validate never uses docker, restore does).
try {
  assertSafeDockerEnv(process.env);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const isPackage = existsSync(join(dir, MANIFEST_FILE));
if (isPackage && isEncryptedPackageDir(dir)) {
  console.error("restore refused: package is encrypted at rest; run backup:decrypt into a temp dir outside the repo first");
  process.exit(1);
}
function printPackageValidate(r) {
  for (const n of r.notes) out(`note: ${n}`);
  for (const p of r.problems) out(`problem: ${p}`);
  for (const c of r.reasons) out(`reason: ${c}`);
  out(`VALIDATE: ${r.level}`);
}

if (mode === "validate" && isPackage) {
  let readToc = null;
  try {
    assertDockerLocal(process.env);
    assertImageLocal(DEFAULT_IMAGE);
    readToc = (p) => readTocViaDocker(p, DEFAULT_IMAGE);
  } catch {
    out("note: TOC verification unavailable; package cannot be FULL_CANDIDATE");
  }
  const r = await validatePackage(dir, { readToc });
  printPackageValidate(r);
  process.exit(r.exit);
}

if (mode === "validate") {
  const r = validateBackupDir(dir);
  printValidate(r);
  process.exit(r.ok ? 0 : 1);
}

// ---------------- restore ----------------
// Default env drops DOCKER_CONTEXT/DB redirectors; DOCKER_HOST was validated above.
const docker = (a, o = {}) => spawnSync("docker", a, { encoding: "utf8", env: o.env ?? sanitizedEnv(), input: o.input });
let name = `${NAME_PREFIX}${randomBytes(4).toString("hex")}`;
let created = false;
let cleaned = false;
const keep = args.includes("--keep");
const password = randomBytes(18).toString("hex"); // throwaway, never printed or stored

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  // Idempotent, own random name only: also covers a failed/interrupted `docker run` that left a Created container.
  if (!(keep && created)) docker(["rm", "-f", "-v", name]);
  if (keep && created) out(`kept container ${name} (remove with: docker rm -f -v ${name})`);
  const left = docker(["ps", "-a", "-q", "--filter", `name=${NAME_PREFIX}`]).stdout?.split("\n").filter(Boolean).length ?? "?";
  out(`cleanup: containers with prefix ${NAME_PREFIX} remaining: ${left}`);
}
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => (cleanup(), process.exit(1)));

function psql({ sql, file, stdin, tuples = false, superuser = false }) {
  const a = ["exec", "-i", "-u", "postgres", "-e", "PGPASSWORD", name, "psql", "-h", "127.0.0.1", "-U", superuser ? "supabase_admin" : "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"];
  if (tuples) a.push("-At", "-F", "|");
  if (sql) a.push("-c", sql);
  if (file) a.push("-f", file);
  const r = docker(a, { env: { ...sanitizedEnv(), PGPASSWORD: password }, input: stdin });
  // stderr may quote row values: never forward it, only expose the exit code.
  return { ok: r.status === 0, code: r.status, out: (r.stdout ?? "").trim() };
}
// NaN (never 0) when psql fails: every consumer treats NaN as a failed check.
const num = makeCounter(psql);

// Public FK integrity: orphan row count (NaN when any count query fails; never 0 by accident).
function fkOrphans() {
  const fkq = `select c.conrelid::regclass::text, c.confrelid::regclass::text,
    (select string_agg(quote_ident(a.attname), ',' order by k.o) from unnest(c.conkey) with ordinality k(n,o) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.n),
    (select string_agg(quote_ident(a.attname), ',' order by k.o) from unnest(c.confkey) with ordinality k(n,o) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.n)
    from pg_constraint c where c.contype='f' and c.connamespace='public'::regnamespace`;
  const fks = psql({ sql: fkq, tuples: true }).out.split("\n").filter(Boolean).map((l) => l.split("|"));
  let orphans = 0;
  for (const [child, parent, ccols, pcols] of fks) {
    const cc = ccols.split(","), pc = pcols.split(",");
    const nn = cc.map((c) => `c.${c} is not null`).join(" and ");
    const eq = cc.map((c, i) => `p.${pc[i]} = c.${c}`).join(" and ");
    orphans += num(`select count(*) from ${child} c where ${nn} and not exists (select 1 from ${parent} p where ${eq})`);
  }
  return { fks, orphans };
}

async function main() {
  const v = validateBackupDir(dir);
  printValidate(v);
  const validations = [];
  const check = (n, ok, detail = "") => {
    validations.push({ name: n, ok: !!ok });
    out(`check ${ok ? "ok  " : "FAIL"} ${n}${detail ? ` (${detail})` : ""}`);
  };
  let publicUsers = 0;
  let stagedAuthUsers = null;
  const finish = (extra = {}) => {
    const c = classifyResult({
      backupComplete: v.ok,
      validations,
      authBlockCount: v.summary.authBlocks,
      authPopulated: v.summary.authPopulated,
      authRestoredReal: [],
      publicUsers,
      stagedAuthUsers,
      legacyLayout: true,
      ...extra,
    });
    for (const l of c.lines) out(l);
    return c.exit;
  };
  if (!v.ok) return finish();

  const opts = assertSafeRunOptions({ image: opt("--image") ?? DEFAULT_IMAGE, name, publish: opt("--publish"), env: process.env, backupDir: dir });
  // Active (config) docker context must also be a local pipe/socket.
  const ctx = docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assertLocalDockerEndpoint(ctx.status === 0 ? ctx.stdout.trim() : "");
  if (docker(["image", "inspect", opts.image]).status !== 0) {
    check("image present locally (no pull)", false);
    return finish();
  }
  const run = ["run", "-d", "--pull", "never", "--name", name, "--label", "unlock-restore=1", "-e", "POSTGRES_PASSWORD", "-e", "PGPASSWORD", "--mount", `type=bind,source=${dir},target=/backup,readonly`];
  if (opts.publish) run.push("-p", opts.publish);
  else run.push("--network", "none");
  run.push(opts.image);
  const started = docker(run, { env: { ...sanitizedEnv(), POSTGRES_PASSWORD: password, PGPASSWORD: password } });
  created = started.status === 0;
  check("container started", created);
  if (!created) return finish();

  let ready = 0;
  for (let i = 0; i < 90 && ready < 3; i++) {
    ready = psql({ sql: "select 1", tuples: true }).out === "1" ? ready + 1 : 0;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check("engine ready", ready >= 3);
  if (ready < 3) return finish();

  check("01-schema.sql loaded", psql({ file: "/backup/01-schema.sql" }).ok);
  check("02-data-public.sql loaded", psql({ file: "/backup/02-data-public.sql" }).ok);

  const t3 = readFileSync(join(dir, "03-data-auth-migrations.sql"), "utf8");
  const blocks3 = parseCopyBlocks(t3, { keepRows: true });
  const authBlocks = blocks3.filter((b) => b.schema === "auth");
  const migBlock = blocks3.find((b) => b.schema === "supabase_migrations");
  check("auth staged (all-text, not real auth)", psql({ stdin: buildAuthStageSql(authBlocks) }).ok);
  check("migration history loaded", psql({ stdin: buildMigrationsSql(migBlock) }).ok);

  // Trigger only AFTER auth/staging data load (ordering hazard, see restore model).
  const trig = extractTriggerSql(readFileSync(join(REPO, "supabase/migrations/20260923000000_auth_user_provisioning.sql"), "utf8"));
  check("trigger on_auth_user_created created", psql({ sql: trig }).ok);

  // Validations (counts only).
  const t2 = parseCopyBlocks(readFileSync(join(dir, "02-data-public.sql"), "utf8"));
  for (const b of t2) {
    const got = num(`select count(*) from public.${quoteIdent(b.table)}`);
    check(`public.${b.table} rows`, Number.isFinite(got) && got === b.rows, `${got}/${b.rows}`);
  }
  for (const b of authBlocks) {
    const got = num(`select count(*) from ${quoteIdent(STAGE_SCHEMA)}.${quoteIdent(b.table)}`);
    check(`staged auth.${b.table} rows`, Number.isFinite(got) && got === b.rows, `${got}/${b.rows}`);
  }
  const migGot = num("select count(*) from supabase_migrations.schema_migrations");
  check("schema_migrations rows", Number.isFinite(migGot) && migGot === migBlock.rows, `${migGot}/${migBlock.rows}`);
  const versions = psql({ sql: "select version from supabase_migrations.schema_migrations order by 1", tuples: true }).out.split("\n").filter(Boolean);
  const repoV = repoMigrationVersions(join(REPO, "supabase/migrations"));
  check("migration versions == repo", JSON.stringify(versions) === JSON.stringify(repoV), `${versions.length} vs ${repoV.length}`);

  const { fks, orphans } = fkOrphans();
  check("public FK integrity", fks.length > 0 && Number.isFinite(orphans) && orphans === 0, `${fks.length} FKs, ${orphans} orphan rows`);

  const pu = num("select count(*) from public.users");
  const au = num(`select count(*) from ${STAGE_SCHEMA}.users`);
  publicUsers = pu;
  stagedAuthUsers = au;
  const pNoA = num(`select count(*) from public.users p where not exists (select 1 from ${STAGE_SCHEMA}.users a where a.id = p.id::text)`);
  const aNoP = num(`select count(*) from ${STAGE_SCHEMA}.users a where not exists (select 1 from public.users p where p.id::text = a.id)`);
  out(`info public.users=${pu}, staged auth.users=${au}, public without auth=${pNoA}, auth without public=${aNoP}`);

  check("trigger present", num("select count(*) from pg_trigger where tgname='on_auth_user_created' and not tgisinternal") === 1);
  check("function handle_new_auth_user present", psql({ sql: "select to_regprocedure('public.handle_new_auth_user()') is not null", tuples: true }).out === "t");
  return finish();
}

// ---------------- package layout (Backup Procedure V1) ----------------
const qIdent = (s) => '"' + String(s).replace(/"/g, '""') + '"';

async function mainPackage() {
  const validations = [];
  const check = (n, ok, detail = "") => {
    validations.push({ name: n, ok: !!ok });
    out("check " + (ok ? "ok  " : "FAIL") + " " + n + (detail ? " (" + detail + ")" : ""));
  };
  let level = "INVALID";
  let authRestoredReal = false;
  let triggerPresent = false;
  let skipped = 0;
  const finish = () => {
    const c = classifyPackageRestore({ level, validations, authRestoredReal, triggerPresent, skippedCounts: skipped });
    for (const l of c.lines) out(l);
    return c.exit;
  };

  const opts = assertSafeRunOptions({ image: opt("--image") ?? DEFAULT_IMAGE, name, publish: opt("--publish"), env: process.env, backupDir: dir });
  const ctx = docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assertLocalDockerEndpoint(ctx.status === 0 ? ctx.stdout.trim() : "");
  if (docker(["image", "inspect", opts.image]).status !== 0) {
    check("image present locally (no pull)", false);
    return finish();
  }
  const v = await validatePackage(dir, { readToc: (p) => readTocViaDocker(p, opts.image) });
  level = v.level;
  for (const n of v.notes) out("note: " + n);
  for (const p of v.problems) out("problem: " + p);
  for (const c of v.reasons) out("reason: " + c);
  out("package validation: " + v.level);
  if (v.level === "INVALID") return finish();
  const manifest = v.manifest;
  const toc = v.toc;

  const run = ["run", "-d", "--pull", "never", "--name", name, "--label", "unlock-restore=1", "-e", "POSTGRES_PASSWORD", "-e", "PGPASSWORD", "--mount", "type=bind,source=" + dir + ",target=/backup,readonly"];
  if (opts.publish) run.push("-p", opts.publish);
  else run.push("--network", "none");
  run.push(opts.image);
  created = docker(run, { env: { ...sanitizedEnv(), POSTGRES_PASSWORD: password, PGPASSWORD: password } }).status === 0;
  check("container started", created);
  if (!created) return finish();
  let ready = 0;
  for (let i = 0; i < 90 && ready < 3; i++) {
    ready = psql({ sql: "select 1", tuples: true }).out === "1" ? ready + 1 : 0;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check("engine ready", ready >= 3);
  if (ready < 3) return finish();

  // Roles named in 20-roles.sql must exist before the dump's owners/ACLs are applied (names only, no passwords).
  const wanted = existsSync(join(dir, ROLES_FILE)) ? parseRoleNames(readFileSync(join(dir, ROLES_FILE), "utf8")) : [];
  const have = new Set(psql({ sql: "select rolname from pg_roles", tuples: true }).out.split("\n").filter(Boolean));
  const missingRoles = wanted.filter((r) => !have.has(r));
  if (missingRoles.length > 0) {
    const ok = psql({ sql: missingRoles.map((r) => "create role " + qIdent(r) + " nologin;").join("\n"), superuser: true }).ok;
    check("roles from 20-roles.sql missing in image created minimally (NOLOGIN)", ok, missingRoles.length + " roles");
  }

  // The image ships a 5-table auth STUB. Drop it (own disposable container only) before restoring real auth DDL.
  const dumpHasAuth = !!toc?.schemas_present?.includes("auth");
  if (dumpHasAuth) {
    const hasAuth = psql({ sql: "select exists(select 1 from pg_namespace where nspname='auth')", tuples: true }).out;
    if (hasAuth === "t") {
      // Pristine image stub = exactly these 5 tables with an empty auth.users (the image seeds its own schema_migrations rows).
      const tables = psql({ sql: "select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema='auth'", tuples: true }).out;
      const stub = tables === "audit_log_entries,instances,refresh_tokens,schema_migrations,users" && num("select count(*) from auth.users") === 0;
      check("image auth schema is the pristine 5-table stub (users empty)", stub);
      if (!stub) return finish();
      check("image auth stub dropped before restore", psql({ sql: "drop schema auth cascade", superuser: true }).ok);
    } else if (hasAuth !== "f") {
      check("auth stub detection query", false);
      return finish();
    }
  }

  // The dump carries CREATE SCHEMA public when the source's public differs from the default: clear the image's own (disposable).
  if (toc?.schema_ddl_entries?.includes("public")) check("image public schema dropped (dump recreates it)", psql({ sql: "drop schema public cascade", superuser: true }).ok);

  // Data load must not fire on_auth_user_created (it would duplicate public.users): replica role for the whole restore.
  // Needs a true superuser: in this image "postgres" is not one, supabase_admin is (same throwaway password).
  const rr = docker(
    ["exec", "-u", "postgres", "-e", "PGPASSWORD", "-e", "PGOPTIONS", name, "pg_restore", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "--exit-on-error", "/backup/" + DUMP_FILE],
    { env: { ...sanitizedEnv(), PGPASSWORD: password, PGOPTIONS: "-c session_replication_role=replica" } },
  );
  check("pg_restore --exit-on-error 10-full.dump (replica role)", rr.status === 0);
  if (rr.status !== 0) return finish();

  // Counts: restored value must lie within the manifest's pre/post-dump range; failed queries are NaN, never 0.
  const before = { ...(manifest.row_counts?.before?.public ?? {}), ...(manifest.row_counts?.before?.auth ?? {}) };
  const after = { ...(manifest.row_counts_after?.public ?? {}), ...(manifest.row_counts_after?.auth ?? {}) };
  let tablesChecked = 0;
  for (const t of Object.keys(before).sort()) {
    const [s, n] = t.split(".");
    if (!Number.isInteger(before[t]) || !Number.isInteger(after[t])) {
      skipped++;
      continue;
    }
    const got = num("select count(*) from " + quoteIdent(s) + "." + quoteIdent(n));
    check("rows " + t, countWithinRange(got, before[t], after[t]), got + " in [" + Math.min(before[t], after[t]) + "," + Math.max(before[t], after[t]) + "]");
    tablesChecked++;
  }
  check("manifest row counts present", tablesChecked > 0);

  const sm = manifest.migrations?.supabase_migrations;
  const am = manifest.migrations?.auth;
  for (const [t, m] of [["supabase_migrations.schema_migrations", sm], ["auth.schema_migrations", am]]) {
    if (!m) {
      check("migration metadata for " + t + " in manifest", false);
      continue;
    }
    const got = num("select count(*) from " + t);
    const latest = psql({ sql: "select max(version) from " + t, tuples: true });
    check(t + " count/latest == manifest", got === m.count && latest.ok && latest.out === (m.latest ?? ""), got + "/" + m.count);
  }
  const versions = psql({ sql: "select version from supabase_migrations.schema_migrations order by 1", tuples: true });
  const restoredV = versions.out.split("\n").filter(Boolean);
  const repoV = repoMigrationVersions(join(REPO, "supabase/migrations"));
  const prefixOfRepo = restoredV.length > 0 && restoredV.every((x, i) => x === repoV[i]);
  check("migration versions == repo (or a strict prefix of it)", versions.ok && prefixOfRepo, restoredV.length + " vs " + repoV.length);
  if (prefixOfRepo && restoredV.length < repoV.length) out("note: backup predates " + (repoV.length - restoredV.length) + " repo migration(s)");

  const { fks, orphans } = fkOrphans();
  check("public FK integrity", fks.length > 0 && Number.isFinite(orphans) && orphans === 0, fks.length + " FKs, " + orphans + " orphan rows");

  const realAuth = psql({ sql: "select to_regclass('auth.users') is not null and to_regclass('auth.schema_migrations') is not null", tuples: true }).out === "t";
  check("auth restored into the real auth schema", realAuth);
  authRestoredReal = realAuth && dumpHasAuth;
  const pu = num("select count(*) from public.users");
  const au = realAuth ? num("select count(*) from auth.users") : NaN;
  const pNoA = realAuth ? num("select count(*) from public.users p where not exists (select 1 from auth.users a where a.id = p.id)") : NaN;
  const aNoP = realAuth ? num("select count(*) from auth.users a where not exists (select 1 from public.users p where p.id = a.id)") : NaN;
  out("info public.users=" + pu + ", auth.users=" + au + ", public without auth=" + pNoA + ", auth without public=" + aNoP);

  const trig = num("select count(*) from pg_trigger where tgname='on_auth_user_created' and not tgisinternal and tgenabled <> 'D'");
  triggerPresent = trig === 1;
  check("trigger on_auth_user_created present and enabled", triggerPresent);
  check("function handle_new_auth_user present", psql({ sql: "select to_regprocedure('public.handle_new_auth_user()') is not null", tuples: true }).out === "t");
  return finish();
}

let code = 1;
try {
  code = await (isPackage ? mainPackage() : main());
} catch (e) {
  out(`RESULT: FAIL\n  error: ${String(e.message).split("\n")[0].slice(0, 200)}`);
} finally {
  cleanup();
}
process.exit(code);
