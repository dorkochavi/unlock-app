/**
 * Backup Procedure V1: pure/safe helpers for scripts/backup-create.mjs, backup-validate.mjs and the
 * package layout of restore-local-backup.mjs. No Docker and no DB access in this file.
 * Output policy: names, codes and integer counts only; never URLs, credentials or row values.
 * Completeness never exceeds FULL_CANDIDATE: only a successful local restore drill can prove FULL.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, realpathSync, statSync, readdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const TOOL_NAME = "unlock-backup";
export const TOOL_VERSION = "1.0.0";
export const MANIFEST_SCHEMA_VERSION = 1;
export const MANIFEST_FILE = "MANIFEST.json";
export const DUMP_FILE = "10-full.dump";
export const ROLES_FILE = "20-roles.sql";
export const INFO_FILE = "30-server-info.txt";
export const PACKAGE_ARTIFACTS = [DUMP_FILE, ROLES_FILE, INFO_FILE];
export const DUMP_SCHEMAS = ["public", "auth", "supabase_migrations"];
export const COUNT_SCHEMAS = ["public", "auth"];
export const LEVEL_FULL_CANDIDATE = "FULL_CANDIDATE";
export const LEVEL_PARTIAL = "PARTIAL";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const isIdent = (s) => IDENT.test(s);

// ---------------------------------------------------------------- labels / retention
export const LABELS = ["daily", "pre-migration", "pre-auth-change", "pre-release", "pre-destructive", "monthly"];

/** Retention is metadata only (policy: daily 30d, event 90d, monthly 12 months). Enforcement is not done here. */
export function retentionFor(label) {
  if (label === "daily") return { class: "daily", days: 30, enforcement: "metadata-only" };
  if (label === "monthly") return { class: "monthly", months: 12, enforcement: "metadata-only" };
  if (LABELS.includes(label)) return { class: "event", days: 90, enforcement: "metadata-only" };
  throw new Error("unknown label");
}

export function timestampUtc(d = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

// ---------------------------------------------------------------- source URL guard
export const DEFAULT_SOURCE_ENV = "SUPA_DB_URL";
export const TEST_NAME_RE = /^unlock-bkptest-[a-z0-9][a-z0-9-]{0,40}$/;
const SSLMODES = new Set(["require", "verify-ca", "verify-full", "prefer", "disable", "allow"]);

export class BackupError extends Error {
  /** @param {string} code @param {string} [detail] */
  constructor(code, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}

function isUnreachableHost(h) {
  if (h === "localhost" || h === "[::1]" || h === "::1" || h === "0.0.0.0" || h === "host.docker.internal") return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  if (!h.includes(".") && !h.includes(":")) return true; // single-label names only resolve on a docker network
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return true;
  }
  return false;
}

/**
 * Strict source URL parse. Never echoes the raw value in errors.
 * Hosted mode (default) refuses loopback/private/single-label hosts. Test mode (explicit, see docs) accepts
 * only a host named unlock-bkptest-* (a disposable container on a disposable docker network).
 * @param {string} raw
 * @param {{testMode?: boolean}} [o]
 */
export function parseSourceUrl(raw, { testMode = false } = {}) {
  const bad = (code, why) => {
    throw new BackupError(code, why);
  };
  if (typeof raw !== "string" || raw.length === 0) bad("SOURCE_URL_INVALID", "empty");
  if (raw.includes(",")) bad("SOURCE_URL_INVALID", "multi-host list");
  if (/\s/.test(raw)) bad("SOURCE_URL_INVALID", "whitespace");
  if (!/^postgres(ql)?:\/\//.test(raw)) bad("SOURCE_URL_INVALID", "scheme must be postgres:// or postgresql://");
  let u;
  try {
    u = new URL(raw);
  } catch {
    return bad("SOURCE_URL_INVALID", "not parseable");
  }
  const authority = raw.replace(/^postgres(ql)?:\/\//, "").split("/")[0].split("?")[0];
  if (authority.split("@").length > 2) bad("SOURCE_URL_INVALID", "ambiguous userinfo");
  if (!u.hostname) bad("SOURCE_URL_INVALID", "no host");
  if (!u.username) bad("SOURCE_URL_INVALID", "userinfo (user) required");
  if (!u.password) bad("SOURCE_URL_INVALID", "userinfo (password) required");
  if (u.hash !== "") bad("SOURCE_URL_FORBIDDEN_PARAM", "fragment");
  /** @type {string | undefined} */
  let sslmode;
  for (const [k, v] of u.searchParams) {
    // host/hostaddr/service/passfile/options/... would redirect or alter the target: refuse all but sslmode.
    if (k !== "sslmode" || !SSLMODES.has(v) || sslmode !== undefined) bad("SOURCE_URL_FORBIDDEN_PARAM", `query parameter ${/^[A-Za-z_]{1,32}$/.test(k) ? k : "(invalid)"}`);
    sslmode = v;
  }
  const host = u.hostname.toLowerCase();
  const port = u.port ? Number(u.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) bad("SOURCE_URL_INVALID", "port");
  const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres";
  if (/[\0\r\n]/.test(database)) bad("SOURCE_URL_INVALID", "database name");
  if (testMode) {
    if (!TEST_NAME_RE.test(host)) bad("SOURCE_HOST_NOT_ALLOWED", "test mode requires an unlock-bkptest-* container host");
  } else if (isUnreachableHost(host) || TEST_NAME_RE.test(host)) {
    bad("SOURCE_HOST_NOT_ALLOWED", "loopback/private/single-label host is not a hosted source");
  }
  return { host, port, database, user: decodeURIComponent(u.username), sslmode };
}

export const hostFingerprint = (host) => createHash("sha256").update(String(host).trim().toLowerCase()).digest("hex");

/** Replace every occurrence of any secret fragment (and the encoded form) by a placeholder. */
export function redact(text, secrets) {
  let t = String(text);
  for (const s of secrets) {
    if (!s || s.length < 3) continue;
    for (const v of new Set([s, encodeURIComponent(s)])) t = t.split(v).join("[REDACTED]");
  }
  return t;
}

// ---------------------------------------------------------------- output path guard
function realpathLoose(p) {
  let cur = resolve(p);
  const rest = [];
  while (!existsSync(cur)) {
    rest.unshift(basename(cur));
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return join(realpathSync.native(cur), ...rest);
}
const fold = (s) => (process.platform === "win32" || process.platform === "darwin" ? s.toLowerCase() : s);
export function isInsideOrEqual(child, parent) {
  const rel = relative(fold(parent), fold(child));
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
}

/**
 * The backup output root must resolve (symlinks included) outside the repo working tree.
 * Returns the resolved real path. Throws OUTPUT_INSIDE_REPO / OUTPUT_PATH_UNSAFE.
 */
export function assertOutputOutsideRepo(outPath, repoRoot) {
  if (typeof outPath !== "string" || outPath.length === 0) throw new BackupError("OUTPUT_PATH_UNSAFE", "no output directory");
  if (/[,"\r\n\0]/.test(outPath)) throw new BackupError("OUTPUT_PATH_UNSAFE", "path must not contain commas, double quotes or newlines");
  const real = realpathLoose(outPath);
  const repoReal = realpathSync.native(repoRoot);
  if (isInsideOrEqual(real, repoReal)) throw new BackupError("OUTPUT_INSIDE_REPO", "backups must be written outside the repository");
  return real;
}

// ---------------------------------------------------------------- hashing / files
export function sha256File(p) {
  return new Promise((res, rej) => {
    const h = createHash("sha256");
    createReadStream(p)
      .on("error", rej)
      .on("data", (c) => h.update(c))
      .on("end", () => res(h.digest("hex")));
  });
}

// ---------------------------------------------------------------- parsing query / toc output
/** `key|value...` lines from the info psql run. Missing keys stay undefined (never defaulted to 0). */
export function parseInfoOutput(text) {
  const info = { server_version: null, extensions: [], tables: [], supabase_migrations: null, auth_migrations: null };
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/\r$/, "");
    const [k, ...r] = line.split("|");
    if (k === "server_version" && r.length === 1 && /^\d+(\.\d+)*/.test(r[0])) info.server_version = r[0];
    else if (k === "ext" && r.length === 2 && isIdent(r[0].replace(/-/g, "_"))) info.extensions.push({ name: r[0], version: r[1] });
    else if (k === "table" && r.length === 1 && /^[a-z_]+\.[A-Za-z_][A-Za-z0-9_]*$/.test(r[0])) info.tables.push(r[0]);
    else if ((k === "mig_supabase" || k === "mig_auth") && r.length === 2 && /^\d+$/.test(r[0])) {
      const v = { count: Number(r[0]), latest: r[1] === "" ? null : r[1] };
      if (k === "mig_supabase") info.supabase_migrations = v;
      else info.auth_migrations = v;
    }
  }
  info.extensions.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  info.tables = [...new Set(info.tables)].filter((t) => COUNT_SCHEMAS.includes(t.split(".")[0])).sort();
  return info;
}
export const serverMajor = (v) => (/^(\d+)/.exec(String(v ?? ""))?.[1] ? Number(/^(\d+)/.exec(String(v))[1]) : NaN);

/** Count lines `count|schema.table|N`. A table without a valid integer line is null, never 0. */
export function parseCountOutput(text, tables) {
  const got = new Map();
  for (const raw of String(text).split("\n")) {
    const m = /^count\|([a-z_]+\.[A-Za-z_][A-Za-z0-9_]*)\|(\d+)\r?$/.exec(raw);
    if (m && !got.has(m[1])) got.set(m[1], Number(m[2]));
  }
  const out = {};
  for (const t of tables) out[t] = got.has(t) ? got.get(t) : null;
  return out;
}

export function buildInfoSql() {
  return [
    "select 'server_version|'||current_setting('server_version');",
    "select 'ext|'||extname||'|'||extversion from pg_extension order by extname;",
    "select 'table|'||schemaname||'.'||tablename from pg_tables where schemaname in ('public','auth') order by 1;",
    "select 'mig_supabase|'||count(*)||'|'||coalesce(max(version),'') from supabase_migrations.schema_migrations;",
    "select 'mig_auth|'||count(*)||'|'||coalesce(max(version),'') from auth.schema_migrations;",
    "",
  ].join("\n");
}

export function buildCountSql(tables) {
  return (
    tables
      .filter((t) => t.split(".").every(isIdent))
      .map((t) => {
        const [s, n] = t.split(".");
        return `select 'count|${t}|'||count(*) from "${s}"."${n}";`;
      })
      .join("\n") + "\n"
  );
}

export function parseRoleNames(text) {
  const names = new Set();
  for (const line of String(text).split("\n")) {
    const m = /^CREATE ROLE (?:"((?:[^"]|"")+)"|([A-Za-z0-9_.$-]+));\s*$/.exec(line.replace(/\r$/, ""));
    if (m) names.add(m[1] ? m[1].replace(/""/g, '"') : m[2]);
  }
  return [...names].sort();
}

/** Parse `pg_restore -l` output. */
export function parseToc(text) {
  const t = { dumpedFrom: null, dumpedBy: null, entries: 0, schemas: new Set(), schemaEntries: new Set(), tables: new Set(), dataTables: new Set(), triggers: new Set(), functions: new Set() };
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/\r$/, "");
    let m;
    if ((m = /^;\s+Dumped from database version (\S+)/.exec(line))) t.dumpedFrom = m[1];
    else if ((m = /^;\s+Dumped by pg_dump version (\S+)/.exec(line))) t.dumpedBy = m[1];
    if (!/^\d+; \d+ \d+ /.test(line)) continue;
    t.entries++;
    if ((m = /^\d+; \d+ \d+ SCHEMA - (\S+)/.exec(line))) {
      t.schemas.add(m[1]);
      t.schemaEntries.add(m[1]);
    }
    else if ((m = /^\d+; \d+ \d+ TABLE DATA (\S+) (\S+)/.exec(line))) {
      t.dataTables.add(`${m[1]}.${m[2]}`);
      t.schemas.add(m[1]);
    } else if ((m = /^\d+; \d+ \d+ TABLE (\S+) (\S+)/.exec(line))) {
      t.tables.add(`${m[1]}.${m[2]}`);
      t.schemas.add(m[1]);
    } else if ((m = /^\d+; \d+ \d+ TRIGGER (\S+) (\S+) (\S+)/.exec(line))) t.triggers.add(`${m[1]}.${m[2]}.${m[3]}`);
    else if ((m = /^\d+; \d+ \d+ FUNCTION (\S+) (\S+?)\(/.exec(line))) t.functions.add(`${m[1]}.${m[2]}`);
  }
  return t;
}

export function summarizeToc(toc) {
  return {
    schemas_present: DUMP_SCHEMAS.filter((s) => toc.schemas.has(s)),
    schema_ddl_entries: DUMP_SCHEMAS.filter((s) => toc.schemaEntries.has(s)),
    auth_users_table: toc.tables.has("auth.users"),
    auth_schema_migrations_data: toc.dataTables.has("auth.schema_migrations"),
    supabase_migrations_data: toc.dataTables.has("supabase_migrations.schema_migrations"),
    auth_user_trigger: toc.triggers.has("auth.users.on_auth_user_created"),
    public_handle_new_auth_user: toc.functions.has("public.handle_new_auth_user"),
    entries: toc.entries,
  };
}

// ---------------------------------------------------------------- completeness (single source of truth)
/**
 * @param {{
 *  dumpPresent: boolean, rolesPresent: boolean, infoPresent: boolean,
 *  toc: ReturnType<typeof summarizeToc> | null,
 *  migrations: {supabase_migrations: {count: number, latest: string|null}|null, auth: {count: number, latest: string|null}|null},
 *  rowCounts: {public: Record<string, number|null>, auth: Record<string, number|null>} | null }} ev
 * @returns {string[]} stable reason codes; empty means FULL_CANDIDATE (never FULL).
 */
export function deriveReasons(ev) {
  const r = new Set();
  if (!ev.dumpPresent) r.add("missing");
  if (!ev.rolesPresent) r.add("roles-missing");
  if (!ev.infoPresent) r.add("server-info-missing");
  if (!ev.toc) r.add("toc-unverified");
  else {
    const t = ev.toc;
    if (!t.schemas_present.includes("public")) r.add("missing-public-artifact");
    if (!t.schemas_present.includes("auth") || !t.auth_users_table) r.add("missing-auth-artifact");
    if (!t.schemas_present.includes("supabase_migrations") || !t.supabase_migrations_data || !t.auth_schema_migrations_data) r.add("incomplete-migration-metadata");
    if (!t.auth_user_trigger) r.add("trigger-missing");
  }
  const m = ev.migrations ?? {};
  const okMig = (x) => !!x && Number.isInteger(x.count) && x.count > 0 && typeof x.latest === "string" && x.latest.length > 0;
  if (!okMig(m.supabase_migrations) || !okMig(m.auth)) r.add("incomplete-migration-metadata");
  const rc = ev.rowCounts;
  const allCounts = rc ? [...Object.values(rc.public ?? {}), ...Object.values(rc.auth ?? {})] : [];
  if (!rc || allCounts.length === 0 || allCounts.some((v) => !Number.isInteger(v)) || Object.keys(rc.auth ?? {}).length === 0) r.add("row-counts-unavailable");
  return [...r].sort();
}

// ---------------------------------------------------------------- manifest
export function repoMigrationInfo(dir) {
  const v = readdirSync(dir)
    .map((f) => /^(\d+)_.*\.sql$/.exec(f)?.[1])
    .filter(Boolean)
    .sort();
  return { count: v.length, latest: v.at(-1) ?? null, versions: v };
}

export function buildManifest(m) {
  const reasons = deriveReasons(m.evidence);
  const rows = (c) => Object.fromEntries(Object.entries(c ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    tool: { name: TOOL_NAME, version: TOOL_VERSION },
    created_at: m.createdAt,
    label: m.label,
    environment: m.environment,
    retention: retentionFor(m.label),
    source: { host_fingerprint_sha256: m.hostFingerprint, env_var_name: m.envVarName },
    server: { server_version: m.info.server_version, pg_dump_version: m.toc?.dumpedBy ?? null, extensions: m.info.extensions },
    docker_image: m.image,
    read_only_enforcement: m.readOnlyEnforcement,
    dump: { format: "custom", schemas: [...DUMP_SCHEMAS], roles: "pg_dumpall --roles-only --no-role-passwords" },
    toc: m.evidence.toc,
    migrations: {
      supabase_migrations: m.evidence.migrations.supabase_migrations,
      auth: m.evidence.migrations.auth,
      repo: { count: m.repo.count, latest: m.repo.latest },
    },
    row_counts_basis: "read-only counts taken before and after the dump; a restored count must lie within [min,max]; null = unavailable (never 0)",
    row_counts: { before: { public: rows(m.evidence.rowCounts?.public), auth: rows(m.evidence.rowCounts?.auth) } },
    row_counts_after: { public: rows(m.rowCountsAfter?.public), auth: rows(m.rowCountsAfter?.auth) },
    artifacts: [...m.artifacts].sort((a, b) => (a.file < b.file ? -1 : 1)),
    encryption: { status: "NONE_UNENCRYPTED_LOCAL" },
    completeness: { level: reasons.length === 0 ? LEVEL_FULL_CANDIDATE : LEVEL_PARTIAL, reasons },
  };
}

// ---------------------------------------------------------------- validate
/**
 * Validate a package directory. Integrity problems (missing/truncated/corrupt/hash-mismatch/
 * wrong-manifest-version/manifest-claim-mismatch) => level INVALID. Completeness gaps => PARTIAL.
 * Only a package with zero problems and zero reasons is FULL_CANDIDATE.
 * @param {string} dir
 * @param {{readToc?: ((dumpPath: string) => string) | null}} [o] readToc runs `pg_restore -l`; null/absent => TOC unverified (PARTIAL).
 */
export async function validatePackage(dir, { readToc = null } = {}) {
  const problems = [];
  const reasons = new Set();
  const notes = [];
  const result = (level, extra = {}) => ({ level, exit: level === LEVEL_FULL_CANDIDATE ? 0 : level === LEVEL_PARTIAL ? 2 : 1, problems: [...new Set(problems)].sort(), reasons: [...reasons].sort(), notes, manifest: null, toc: null, ...extra });

  const mp = join(dir, MANIFEST_FILE);
  if (!existsSync(mp) || !statSync(mp).isFile()) {
    problems.push("missing");
    notes.push(`${MANIFEST_FILE} missing`);
    return result("INVALID");
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(mp, "utf8"));
    if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) throw new Error("shape");
  } catch {
    problems.push("corrupt");
    notes.push(`${MANIFEST_FILE} is not valid JSON`);
    return result("INVALID");
  }
  if (manifest.schema_version !== MANIFEST_SCHEMA_VERSION) {
    problems.push("wrong-manifest-version");
    notes.push(`supported manifest schema_version is ${MANIFEST_SCHEMA_VERSION}`);
    return result("INVALID");
  }
  const listed = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const byFile = new Map(listed.map((a) => [a?.file, a]));
  const present = {};
  for (const f of PACKAGE_ARTIFACTS) {
    const a = byFile.get(f);
    const p = join(dir, f);
    const exists = existsSync(p) && statSync(p).isFile();
    if (!a) {
      present[f] = false;
      if (exists) {
        problems.push("unlisted-artifact");
        notes.push(`${f} exists but is not listed in the manifest`);
      } else if (f === DUMP_FILE) problems.push("missing");
      continue;
    }
    if (!/^[0-9a-f]{64}$/.test(String(a.sha256 ?? "")) || !Number.isInteger(a.bytes) || a.bytes <= 0) {
      problems.push("corrupt");
      notes.push(`${f}: manifest entry malformed`);
      present[f] = false;
      continue;
    }
    if (!exists) {
      problems.push("missing");
      notes.push(`${f} missing`);
      present[f] = false;
      continue;
    }
    const size = statSync(p).size;
    if (size === 0) {
      problems.push("truncated");
      notes.push(`${f} is empty`);
      present[f] = false;
      continue;
    }
    if (size < a.bytes) {
      problems.push("truncated");
      notes.push(`${f} is ${size} bytes, manifest says ${a.bytes}`);
      present[f] = false;
      continue;
    }
    if (size !== a.bytes || (await sha256File(p)) !== a.sha256) {
      problems.push("hash-mismatch");
      notes.push(`${f}: sha256/size differs from manifest`);
      present[f] = false;
      continue;
    }
    present[f] = true;
  }
  for (const f of readdirSync(dir)) if (f !== MANIFEST_FILE && !PACKAGE_ARTIFACTS.includes(f)) notes.push(`unlisted extra file ${f}`);
  if (problems.length > 0) return result("INVALID", { manifest });

  let toc = null;
  let tocSummary = null;
  if (readToc) {
    try {
      toc = parseToc(readToc(join(dir, DUMP_FILE)));
      if (toc.entries === 0) throw new Error("empty toc");
      tocSummary = summarizeToc(toc);
    } catch {
      problems.push("corrupt");
      notes.push("pg_restore -l could not read 10-full.dump");
      return result("INVALID", { manifest });
    }
  } else notes.push("TOC not verified (no pg_restore available)");

  const mig = manifest.migrations ?? {};
  const derived = deriveReasons({
    dumpPresent: present[DUMP_FILE],
    rolesPresent: present[ROLES_FILE],
    infoPresent: present[INFO_FILE],
    toc: tocSummary,
    migrations: { supabase_migrations: mig.supabase_migrations ?? null, auth: mig.auth ?? null },
    rowCounts: manifest.row_counts?.before ? { public: manifest.row_counts.before.public ?? {}, auth: manifest.row_counts.before.auth ?? {} } : null,
  });
  for (const r of derived) reasons.add(r);
  const claimed = manifest.completeness?.level;
  const claimedReasons = Array.isArray(manifest.completeness?.reasons) ? manifest.completeness.reasons : [];
  if (claimed !== LEVEL_FULL_CANDIDATE && claimed !== LEVEL_PARTIAL) {
    problems.push("corrupt");
    notes.push("manifest completeness.level is not recognised");
    return result("INVALID", { manifest });
  }
  // toc-unverified alone cannot refute a claim (it only prevents us from confirming it).
  if (claimed === LEVEL_FULL_CANDIDATE && derived.some((r) => r !== "toc-unverified")) {
    problems.push("manifest-claim-mismatch");
    notes.push("manifest claims FULL_CANDIDATE but the artifacts do not support it");
    return result("INVALID", { manifest, toc: tocSummary });
  }
  for (const r of claimedReasons) if (typeof r === "string" && /^[a-z-]{1,40}$/.test(r)) reasons.add(r);
  if (claimed === LEVEL_PARTIAL && claimedReasons.length === 0) reasons.add("manifest-partial");
  return result(reasons.size === 0 ? LEVEL_FULL_CANDIDATE : LEVEL_PARTIAL, { manifest, toc: tocSummary });
}

// ---------------------------------------------------------------- restore range check
/** null/NaN restored count or manifest bound never passes. */
export function countWithinRange(restored, before, after) {
  if (![restored, before, after].every((n) => Number.isInteger(n))) return false;
  return restored >= Math.min(before, after) && restored <= Math.max(before, after);
}

/**
 * Package-layout restore classification. FULL only when the package is FULL_CANDIDATE, every
 * validation passed, auth was restored into the real auth schema and the trigger is present.
 * @param {{level: string, validations: {name: string, ok: boolean}[], authRestoredReal: boolean, triggerPresent: boolean, skippedCounts: number}} o
 */
export function classifyPackageRestore({ level, validations, authRestoredReal, triggerPresent, skippedCounts = 0 }) {
  const failed = validations.filter((v) => !v.ok).map((v) => v.name);
  if (level === "INVALID") failed.unshift("package invalid");
  if (failed.length > 0) return { level: "FAIL", exit: 1, lines: ["RESULT: FAIL", ...failed.map((f) => `  failed: ${f}`)] };
  const why = [];
  if (level !== LEVEL_FULL_CANDIDATE) why.push("package is not FULL_CANDIDATE");
  if (!authRestoredReal) why.push("auth not restored into the real auth schema");
  if (!triggerPresent) why.push("trigger on_auth_user_created not present");
  if (skippedCounts > 0) why.push(`${skippedCounts} table counts unavailable in manifest`);
  if (why.length > 0) return { level: "PARTIAL", exit: 2, lines: ["RESULT: PARTIAL", ...why.map((w) => `  partial: ${w}`)] };
  return { level: "FULL", exit: 0, lines: ["RESULT: FULL (local drill: counts, migrations, auth and trigger verified)"] };
}
