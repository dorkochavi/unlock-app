#!/usr/bin/env node
/**
 * Local backup validate / restore drill. See docs/RESTORE_RUNBOOK.md.
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
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_IMAGE,
  NAME_PREFIX,
  STAGE_SCHEMA,
  assertSafeRunOptions,
  buildAuthStageSql,
  buildMigrationsSql,
  classifyResult,
  extractTriggerSql,
  parseCopyBlocks,
  quoteIdent,
  repoMigrationVersions,
  sanitizedEnv,
  validateBackupDir,
} from "./lib/restore-local.mjs";

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

if (mode === "validate") {
  const r = validateBackupDir(dir);
  printValidate(r);
  process.exit(r.ok ? 0 : 1);
}

// ---------------- restore ----------------
const docker = (a, o = {}) => spawnSync("docker", a, { encoding: "utf8", env: o.env, input: o.input });
let name = `${NAME_PREFIX}${randomBytes(4).toString("hex")}`;
let created = false;
let cleaned = false;
const keep = args.includes("--keep");
const password = randomBytes(18).toString("hex"); // throwaway, never printed or stored

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (created && !keep) docker(["rm", "-f", "-v", name]);
  if (keep && created) out(`kept container ${name} (remove with: docker rm -f -v ${name})`);
  const left = docker(["ps", "-a", "-q", "--filter", `name=${NAME_PREFIX}`]).stdout?.split("\n").filter(Boolean).length ?? "?";
  out(`cleanup: containers with prefix ${NAME_PREFIX} remaining: ${left}`);
}
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => (cleanup(), process.exit(1)));

function psql({ sql, file, stdin, tuples = false }) {
  const a = ["exec", "-i", "-u", "postgres", "-e", "PGPASSWORD", name, "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"];
  if (tuples) a.push("-At", "-F", "|");
  if (sql) a.push("-c", sql);
  if (file) a.push("-f", file);
  const r = docker(a, { env: { ...sanitizedEnv(), PGPASSWORD: password }, input: stdin });
  // stderr may quote row values: never forward it, only expose the exit code.
  return { ok: r.status === 0, code: r.status, out: (r.stdout ?? "").trim() };
}
const num = (sql) => Number(psql({ sql, tuples: true }).out);

async function main() {
  const v = validateBackupDir(dir);
  printValidate(v);
  const validations = [];
  const check = (n, ok, detail = "") => {
    validations.push({ name: n, ok: !!ok });
    out(`check ${ok ? "ok  " : "FAIL"} ${n}${detail ? ` (${detail})` : ""}`);
  };
  const finish = (extra = {}) => {
    const c = classifyResult({
      backupComplete: v.ok,
      validations,
      authBlockCount: v.summary.authBlocks,
      authPopulated: v.summary.authPopulated,
      authRestoredReal: [],
      ...extra,
    });
    for (const l of c.lines) out(l);
    return c.exit;
  };
  if (!v.ok) return finish();

  const opts = assertSafeRunOptions({ image: opt("--image") ?? DEFAULT_IMAGE, name, publish: opt("--publish"), env: process.env });
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
    check(`public.${b.table} rows`, got === b.rows, `${got}/${b.rows}`);
  }
  for (const b of authBlocks) {
    const got = num(`select count(*) from ${quoteIdent(STAGE_SCHEMA)}.${quoteIdent(b.table)}`);
    check(`staged auth.${b.table} rows`, got === b.rows, `${got}/${b.rows}`);
  }
  const migGot = num("select count(*) from supabase_migrations.schema_migrations");
  check("schema_migrations rows", migGot === migBlock.rows, `${migGot}/${migBlock.rows}`);
  const versions = psql({ sql: "select version from supabase_migrations.schema_migrations order by 1", tuples: true }).out.split("\n").filter(Boolean);
  const repoV = repoMigrationVersions(join(REPO, "supabase/migrations"));
  check("migration versions == repo", JSON.stringify(versions) === JSON.stringify(repoV), `${versions.length} vs ${repoV.length}`);

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
  check("public FK integrity", fks.length > 0 && orphans === 0, `${fks.length} FKs, ${orphans} orphan rows`);

  const pu = num("select count(*) from public.users");
  const au = num(`select count(*) from ${STAGE_SCHEMA}.users`);
  const pNoA = num(`select count(*) from public.users p where not exists (select 1 from ${STAGE_SCHEMA}.users a where a.id = p.id::text)`);
  const aNoP = num(`select count(*) from ${STAGE_SCHEMA}.users a where not exists (select 1 from public.users p where p.id::text = a.id)`);
  out(`info public.users=${pu}, staged auth.users=${au}, public without auth=${pNoA}, auth without public=${aNoP}`);

  check("trigger present", num("select count(*) from pg_trigger where tgname='on_auth_user_created' and not tgisinternal") === 1);
  check("function handle_new_auth_user present", psql({ sql: "select to_regprocedure('public.handle_new_auth_user()') is not null", tuples: true }).out === "t");
  return finish();
}

let code = 1;
try {
  code = await main();
} catch (e) {
  out(`RESULT: FAIL\n  error: ${String(e.message).split("\n")[0].slice(0, 200)}`);
} finally {
  cleanup();
}
process.exit(code);
