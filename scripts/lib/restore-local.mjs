/**
 * Pure/safe helpers for scripts/restore-local-backup.mjs (no Docker here).
 * Requires Node >= 22.18 (native .ts import of the shared URL guard).
 * Output policy: counts and names only, never row values.
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assertLocalPgUrl } from "../../supabase/tests/real-pg/local-pg-url.ts";

export const BACKUP_FILES = ["01-schema.sql", "02-data-public.sql", "03-data-auth-migrations.sql"];
export const DEFAULT_IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.166";
export const NAME_PREFIX = "unlock-restore-";
export const EXPECTED = { publicTables: 12, authTables: 26 };
export const STAGE_SCHEMA = "auth_dump_stage";

/**
 * Hardening for every container this tooling starts. The postgres entrypoint needs a small capability set to chown the data
 * dir and drop to the postgres user; everything else is dropped. (Verified by the opt-in e2e, see docs/RESTORE_RUNBOOK.md.)
 */
export const CONTAINER_HARDENING = Object.freeze(["--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", "2g", "--pids-limit", "512"]);
export const POSTGRES_ENTRYPOINT_CAPS = Object.freeze(["CHOWN", "SETUID", "SETGID", "DAC_OVERRIDE", "FOWNER"]);

/** argv for the disposable restore container (bind mount is read-only; --network none unless a localhost publish is requested). */
export function buildRestoreRunArgs({ name, image, mountSource, publish }) {
  const a = ["run", "-d", "--pull", "never", "--name", name, "--label", "unlock-restore=1", ...CONTAINER_HARDENING, ...POSTGRES_ENTRYPOINT_CAPS.flatMap((c) => ["--cap-add", c]), "-e", "POSTGRES_PASSWORD", "-e", "PGPASSWORD", "--mount", `type=bind,source=${mountSource},target=/backup,readonly`];
  if (publish) a.push("-p", publish);
  else a.push("--network", "none");
  a.push(image);
  return a;
}

/**
 * Strict trigger check (restored DB): exactly one trigger named on_auth_user_created ON auth.users, enabled-origin ("O":
 * not disabled "D", not replica-only "R", not always "A"), executing public.handle_new_auth_user, and not internal.
 * A same-named trigger on another table, a disabled/replica trigger or one running another function does not count.
 * auth.users missing => the query errors => the count is NaN => fails closed.
 */
export const TRIGGER_CHECK_SQL =
  "select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created' and tgenabled = 'O' and tgfoid = 'public.handle_new_auth_user'::regproc and not tgisinternal";
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function quoteIdent(s) {
  if (!IDENT.test(s)) throw new Error("unsafe identifier in backup file");
  return `"${s}"`;
}

const COPY_RE = /^COPY "?([A-Za-z_][A-Za-z0-9_]*)"?\."?([A-Za-z_][A-Za-z0-9_]*)"? \((.*)\) FROM stdin;$/;

/** Parse COPY blocks. Rows are only counted (kept as raw lines when keepRows). */
export function parseCopyBlocks(text, { keepRows = false } = {}) {
  const blocks = [];
  let cur = null;
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop(); // EOF artifact, not a row
  for (const raw of lines) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (cur) {
      if (line === "\\.") {
        cur.terminated = true;
        blocks.push(cur);
        cur = null;
      } else {
        cur.rows++;
        if (keepRows) cur.rowLines.push(line);
      }
      continue;
    }
    const m = COPY_RE.exec(line);
    if (m) {
      const columns = m[3].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      cur = { schema: m[1], table: m[2], columns, rows: 0, terminated: false, rowLines: [] };
    }
  }
  if (cur) blocks.push(cur); // unterminated => truncated
  return blocks;
}

/** Rewrite the schema of a COPY header line; other lines unchanged. */
export function rewriteCopyTarget(line, fromSchema, toSchema) {
  const m = COPY_RE.exec(line);
  if (!m || m[1] !== fromSchema) return line;
  return line.replace(/^COPY "?[A-Za-z_][A-Za-z0-9_]*"?\./, `COPY ${quoteIdent(toSchema)}.`);
}

/** SQL stream that stages auth COPY blocks into all-text tables; never touches disk. */
export function buildAuthStageSql(authBlocks) {
  const out = ["SET session_replication_role = replica;", `CREATE SCHEMA ${quoteIdent(STAGE_SCHEMA)};`];
  for (const b of authBlocks) {
    const cols = b.columns.map((c) => `${quoteIdent(c)} text`).join(", ");
    out.push(`CREATE TABLE ${quoteIdent(STAGE_SCHEMA)}.${quoteIdent(b.table)} (${cols});`);
  }
  for (const b of authBlocks) {
    const header = `COPY "auth"."${b.table}" (${b.columns.map(quoteIdent).join(", ")}) FROM stdin;`;
    out.push(rewriteCopyTarget(header, "auth", STAGE_SCHEMA), ...b.rowLines, "\\.");
  }
  return out.join("\n") + "\n";
}

export function buildMigrationsSql(block) {
  const cols = block.columns.map(quoteIdent).join(", ");
  return [
    "SET session_replication_role = replica;",
    'CREATE SCHEMA IF NOT EXISTS "supabase_migrations";',
    'CREATE TABLE "supabase_migrations"."schema_migrations" (version text PRIMARY KEY, statements text[], name text);',
    `COPY "supabase_migrations"."schema_migrations" (${cols}) FROM stdin;`,
    ...block.rowLines,
    "\\.",
    "",
  ].join("\n");
}

/** Extract the on_auth_user_created statement from the repo migration file text. */
export function extractTriggerSql(migrationText) {
  const m = /create trigger on_auth_user_created[\s\S]*?;/i.exec(migrationText);
  if (!m) throw new Error("trigger statement not found in repo migration");
  return m[0];
}

export function repoMigrationVersions(dir) {
  return readdirSync(dir)
    .map((f) => /^(\d+)_.*\.sql$/.exec(f)?.[1])
    .filter(Boolean)
    .sort();
}

/** Read-only structural check of a backup directory. Counts only. */
export function validateBackupDir(dir, expect = EXPECTED) {
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const notes = [];
  const files = {};
  const text = {};
  for (const f of BACKUP_FILES) {
    const p = join(dir, f);
    const size = existsSync(p) ? statSync(p).size : -1;
    files[f] = { exists: size >= 0, bytes: Math.max(size, 0) };
    if (size < 0) problems.push(`missing file ${f}`);
    else if (size === 0) problems.push(`empty file ${f}`);
    else text[f] = readFileSync(p, "utf8");
  }
  const s = { files, publicBlocks: 0, authBlocks: 0, authPopulated: [], migrationRows: 0, publicCounts: {}, authCounts: {} };
  const t1 = text["01-schema.sql"];
  if (t1 !== undefined) {
    const tables = (t1.match(/^CREATE TABLE /gm) ?? []).length;
    s.schemaTables = tables;
    if (tables !== expect.publicTables) problems.push(`01 has ${tables} CREATE TABLE (expected ${expect.publicTables})`);
    if (!t1.includes("handle_new_auth_user")) problems.push("01 lacks handle_new_auth_user function");
    notes.push(
      /on_auth_user_created/.test(t1)
        ? "trigger present in 01"
        : "trigger on_auth_user_created absent from backup (recreated from repo migration)",
    );
    notes.push(
      /(CREATE TABLE|CREATE SCHEMA)[^\n]*"?auth"?[."]/i.test(t1)
        ? "auth DDL present in 01"
        : "auth DDL absent from backup (auth can only be staged)",
    );
  }
  const t2 = text["02-data-public.sql"];
  if (t2 !== undefined) {
    if (!/session_replication_role = replica/.test(t2)) problems.push("02 lacks replica role marker");
    if (!t2.includes("PostgreSQL database dump complete")) problems.push("02 lacks dump-complete marker (truncated?)");
    const blocks = parseCopyBlocks(t2);
    s.publicBlocks = blocks.length;
    for (const b of blocks) {
      s.publicCounts[b.table] = b.rows;
      if (!b.terminated) problems.push(`02 block ${b.table} unterminated`);
      if (b.schema !== "public") problems.push(`02 block ${b.schema}.${b.table} is not public`);
    }
    if (blocks.length !== expect.publicTables) problems.push(`02 has ${blocks.length} COPY blocks (expected ${expect.publicTables})`);
  }
  const t3 = text["03-data-auth-migrations.sql"];
  if (t3 !== undefined) {
    if (!/session_replication_role = replica/.test(t3)) problems.push("03 lacks replica role marker");
    if (!t3.includes("PostgreSQL database dump complete")) problems.push("03 lacks dump-complete marker (truncated?)");
    const blocks = parseCopyBlocks(t3);
    const auth = blocks.filter((b) => b.schema === "auth");
    const mig = blocks.filter((b) => b.schema === "supabase_migrations" && b.table === "schema_migrations");
    for (const b of blocks) if (!b.terminated) problems.push(`03 block ${b.schema}.${b.table} unterminated`);
    s.authBlocks = auth.length;
    for (const b of auth) {
      s.authCounts[b.table] = b.rows;
      if (b.rows > 0) s.authPopulated.push(b.table);
    }
    if (auth.length !== expect.authTables) problems.push(`03 has ${auth.length} auth COPY blocks (expected ${expect.authTables})`);
    if (mig.length !== 1 || mig[0].rows === 0) problems.push("03 lacks populated supabase_migrations.schema_migrations block");
    s.migrationRows = mig[0]?.rows ?? 0;
    notes.push("auth.schema_migrations (GoTrue version) absent from backup");
  }
  return { ok: problems.length === 0, problems, notes, summary: s };
}

/**
 * @param {{backupComplete: boolean, validations: {name: string, ok: boolean}[], authBlockCount: number, authPopulated: string[], authRestoredReal?: string[], publicUsers?: number, stagedAuthUsers?: number | null, legacyLayout?: boolean}} o
 * Result level. FULL only if the backup is complete, every validation passes,
 * and no populated auth table is omitted from the real auth schema.
 */
export function classifyResult({ backupComplete, validations, authBlockCount, authPopulated, authRestoredReal = [], publicUsers = 0, stagedAuthUsers = null, legacyLayout = false }) {
  const failed = validations.filter((v) => !v.ok).map((v) => v.name);
  // Non-finite counts (e.g. NaN from a failed psql) can never support PARTIAL/FULL.
  if (!Number.isFinite(publicUsers)) failed.push("public.users count unavailable");
  if (stagedAuthUsers !== null && !Number.isFinite(stagedAuthUsers)) failed.push("staged auth.users count unavailable");
  if (!backupComplete) failed.unshift("backup incomplete");
  if (authBlockCount > 0 && authBlockCount < EXPECTED.authTables) failed.push("auth COPY blocks incomplete");
  if (failed.length > 0) {
    return { level: "FAIL", exit: 1, omitted: [], lines: ["RESULT: FAIL", ...failed.map((f) => `  failed: ${f}`)] };
  }
  const omitted = authPopulated.filter((t) => !authRestoredReal.includes(t));
  if (authBlockCount === 0) omitted.push("(auth data absent from backup)");
  // Auth emptied/absent while learners exist => never FULL (Drill D regression).
  if (publicUsers > 0 && stagedAuthUsers === 0) omitted.push("(auth.users empty but public.users populated)");
  if (omitted.length > 0) {
    return {
      level: "PARTIAL",
      exit: 2,
      omitted,
      lines: [
        "RESULT: PARTIAL (public + migration history verified)",
        "AUTH NOT RECOVERED (staged for integrity only)",
        `omitted populated auth tables: ${omitted.join(", ")}`,
      ],
    };
  }
  // The legacy 3-file layout has no auth DDL / GoTrue version / manifest: never FULL, whatever the counts say.
  if (legacyLayout) {
    return { level: "PARTIAL", exit: 2, omitted: ["(legacy 3-file layout)"], lines: ["RESULT: PARTIAL (legacy 3-file layout is capped at PARTIAL)", "AUTH NOT RECOVERED (legacy layout carries no Auth DDL or GoTrue version)"] };
  }
  return { level: "FULL", exit: 0, omitted: [], lines: ["RESULT: FULL"] };
}

/** Refuse anything that is not a disposable local container run. Throws. */
/** @param {{image?: string, name?: string, publish?: string | null, url?: string, env?: Record<string, string | undefined>, backupDir?: string}} o */
export function assertSafeRunOptions({ image = DEFAULT_IMAGE, name, publish, url, env = process.env, backupDir }) {
  const refuse = (why) => {
    throw new Error(`restore refused: ${why}`);
  };
  if (!/^(public\.ecr\.aws\/)?supabase\/postgres:[A-Za-z0-9._-]+$/.test(image)) refuse("image must be a supabase/postgres image tag");
  if (name !== undefined && !/^unlock-restore-[a-z0-9][a-z0-9-]{0,40}$/.test(name)) refuse(`container name must match ${NAME_PREFIX}<id>`);
  if (publish !== undefined && publish !== null) {
    const m = /^127\.0\.0\.1:([1-9]\d{3,4}):5432$/.exec(publish);
    if (!m || Number(m[1]) > 65535) refuse("publish must be 127.0.0.1:<port>:5432");
  }
  // Env redirectors (reuses the shared guard's PGHOSTADDR/PGSERVICE/PGSERVICEFILE check).
  assertLocalPgUrl("postgres://u@127.0.0.1:5432/postgres", env);
  if (env.PGHOST && !LOCAL_HOSTS.has(env.PGHOST)) refuse("PGHOST is set to a non-local host");
  assertSafeDockerEnv(env);
  // --mount is a comma-separated key=value list: these characters would inject mount options.
  if (backupDir !== undefined && /[,"\r\n\0]/.test(backupDir)) refuse("backup dir path must not contain commas, double quotes or newlines");
  if (url !== undefined) {
    assertLocalPgUrl(url, env);
    refuse("external targets are not supported; only the script's own disposable container");
  }
  return { image, name, publish: publish ?? null };
}

/** Refuse env that could point docker at a remote daemon. Pure; runs before any docker use. Throws. */
/** @param {Record<string, string | undefined>} [env] */
export function assertSafeDockerEnv(env = process.env) {
  if (env.DOCKER_HOST && !/^(npipe|unix):\/\//.test(env.DOCKER_HOST)) throw new Error("restore refused: DOCKER_HOST is not a local socket/pipe");
  if (env.DOCKER_CONTEXT && env.DOCKER_CONTEXT !== "default") throw new Error("restore refused: DOCKER_CONTEXT is set to a non-default context");
}

/** Refuse a docker context whose endpoint is not a local pipe/socket. Pure. Throws. */
export function assertLocalDockerEndpoint(host) {
  if (typeof host !== "string" || !/^(npipe|unix):\/\//.test(host.trim())) throw new Error("restore refused: active docker context endpoint is not a local socket/pipe");
}

/** psql result -> integer count; NaN (never 0) when psql failed or output is not an integer. */
export function parseCount(r) {
  const t = String(r?.out ?? "").trim();
  return r && r.ok && /^\d+$/.test(t) ? Number(t) : NaN;
}

/** Count-query helper over an injectable psql function. */
export const makeCounter = (psqlFn) => (sql) => parseCount(psqlFn({ sql, tuples: true }));

/** Child-process env: drops anything that could carry a hosted target. */
/** @param {Record<string, string | undefined>} [env] */
export function sanitizedEnv(env = process.env) {
  /** @type {Record<string, string | undefined>} */
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (/^(DATABASE_URL|SUPABASE_|PG|POSTGRES|NEXT_PUBLIC_SUPABASE|DOCKER_CONTEXT$)/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}
