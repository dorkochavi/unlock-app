/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed manifest/evidence fixtures for negative tests */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  FULL_CAVEAT,
  LABELS,
  VOLATILE_TABLES,
  assertOutputOutsideRepo,
  assertSafeMountSource,
  buildManifest,
  buildMigrationStateSql,
  buildRelationshipSql,
  checkTableCount,
  classifyPackageRestore,
  compareTableSets,
  countWithinRange,
  deriveReasons,
  hostFingerprint,
  parseCountOutput,
  parseInfoOutput,
  parseMigrationState,
  parseRelationshipCounts,
  parseRoleNames,
  parseSourceUrl,
  parseToc,
  redact,
  relationshipCheck,
  retentionFor,
  sourceContainerEnv,
  summarizeToc,
  timestampUtc,
  validatePackage,
} from "../../../scripts/lib/backup-package.mjs";
import { CONTAINER_HARDENING, POSTGRES_ENTRYPOINT_CAPS, TRIGGER_CHECK_SQL, buildRestoreRunArgs, classifyResult, makeCounter } from "../../../scripts/lib/restore-local.mjs";
import { buildSourceRunArgs, buildTocArgs } from "../../../scripts/lib/backup-docker.mjs";

const REPO = process.cwd();
const CANARY = "Canary-Pw-9f3a7c1e5b2d";
const HOSTED = `postgresql://postgres.abcdefgh:${CANARY}@db.abcdefgh.supabase.co:5432/postgres`;
const createScript = join(REPO, "scripts", "backup-create.mjs");

const dirs: string[] = [];
const mk = () => {
  const d = mkdtempSync(join(tmpdir(), "unlock-bkp-test-"));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function runCreate(args: string[], env: Record<string, string | undefined> = {}) {
  const e: Record<string, string | undefined> = { ...process.env, ...env };
  delete e.SUPA_DB_URL;
  Object.assign(e, env);
  return spawnSync(process.execPath, [createScript, ...args], { encoding: "utf8", env: e as NodeJS.ProcessEnv });
}

describe("backup:create guards (no Docker is reached)", () => {
  it("rejects an output path inside the repo (and a not-yet-existing subdir of it)", () => {
    for (const out of [join(REPO, "backups-test-xyz"), join(REPO, "src"), REPO]) {
      const r = runCreate(["--label", "daily", "--out", out, "--confirm-read-only-source"], { SUPA_DB_URL: HOSTED });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("OUTPUT_INSIDE_REPO");
      expect(r.stdout + r.stderr).not.toContain(CANARY);
    }
    expect(existsSync(join(REPO, "backups-test-xyz"))).toBe(false);
  });
  it("rejects an output path that is a symlink/junction into the repo", () => {
    const base = mk();
    const link = join(base, "link");
    symlinkSync(join(REPO, "src"), link, "junction");
    expect(() => assertOutputOutsideRepo(join(link, "deeper"), REPO)).toThrow(/OUTPUT_INSIDE_REPO/);
    const r = runCreate(["--label", "daily", "--out", join(link, "deeper"), "--confirm-read-only-source"], { SUPA_DB_URL: HOSTED });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("OUTPUT_INSIDE_REPO");
    expect(readdirSync(join(REPO, "src")).includes("deeper")).toBe(false);
  });
  it("missing source env var => SOURCE_ENV_MISSING (default and custom name, never DATABASE_URL implicitly)", () => {
    const out = mk();
    let r = runCreate(["--label", "daily", "--out", out, "--confirm-read-only-source"], { DATABASE_URL: HOSTED });
    expect([r.status, r.stderr.includes("SOURCE_ENV_MISSING")]).toEqual([1, true]);
    r = runCreate(["--label", "daily", "--out", out, "--confirm-read-only-source", "--source-env", "MY_SRC"], {});
    expect([r.status, r.stderr.includes("SOURCE_ENV_MISSING")]).toEqual([1, true]);
    expect(readdirSync(out)).toEqual([]);
  });
  it.each([
    ["host query", `${HOSTED}?host=evil.example.com`],
    ["hostaddr query", `${HOSTED}?hostaddr=1.2.3.4`],
    ["service query", `${HOSTED}?service=x`],
    ["passfile query", `${HOSTED}?passfile=/tmp/x`],
    ["sslmode + host", `${HOSTED}?sslmode=require&host=evil.example.com`],
    ["multi host", `postgresql://u:${CANARY}@a.supabase.co,b.supabase.co:5432/postgres`],
    ["no userinfo", "postgresql://db.abcdefgh.supabase.co:5432/postgres"],
    ["no password", "postgresql://u@db.abcdefgh.supabase.co:5432/postgres"],
    ["not postgres scheme", `https://u:${CANARY}@db.abcdefgh.supabase.co/postgres`],
    ["ambiguous userinfo", `postgresql://u:${CANARY}@127.0.0.1@db.abcdefgh.supabase.co/postgres`],
  ])("refuses hosted-looking/redirecting source URL: %s", (_n, url) => {
    const out = mk();
    const r = runCreate(["--label", "daily", "--out", out, "--confirm-read-only-source"], { SUPA_DB_URL: url });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/SOURCE_URL_(INVALID|FORBIDDEN_PARAM)/);
    expect(r.stdout + r.stderr).not.toContain(CANARY);
    expect(readdirSync(out)).toEqual([]);
  });
  it("refuses loopback/private/single-label hosts outside the explicit test mode", () => {
    for (const h of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.2", "host.docker.internal", "mydb", "unlock-bkptest-abc"]) {
      expect(() => parseSourceUrl(`postgres://u:pw1234@${h}:5432/postgres`)).toThrow(/SOURCE_HOST_NOT_ALLOWED/);
    }
    expect(parseSourceUrl("postgres://u:pw1234@db.abc.supabase.co:5432/postgres?sslmode=require").sslmode).toBe("require");
    expect(parseSourceUrl("postgres://u:pw1234@unlock-bkptest-abc-src:5432/postgres", { testMode: true }).host).toBe("unlock-bkptest-abc-src");
    expect(() => parseSourceUrl("postgres://u:pw1234@db.abc.supabase.co/postgres", { testMode: true })).toThrow(/SOURCE_HOST_NOT_ALLOWED/);
  });
  it("test-only network flag is refused without the explicit test-mode env", () => {
    const r = runCreate(["--label", "daily", "--out", mk(), "--confirm-read-only-source", "--test-local-source", "unlock-bkptest-x"], { SUPA_DB_URL: HOSTED });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("TEST_MODE_REQUIRED");
  });
  it("requires --confirm-read-only-source (and a known label, no unknown flags)", () => {
    let r = runCreate(["--label", "daily", "--out", mk()], { SUPA_DB_URL: HOSTED });
    expect([r.status, r.stderr.includes("CONFIRM_FLAG_REQUIRED")]).toEqual([1, true]);
    r = runCreate(["--label", "weekly", "--out", mk(), "--confirm-read-only-source"], { SUPA_DB_URL: HOSTED });
    expect([r.status, r.stderr.includes("USAGE")]).toEqual([1, true]);
    r = runCreate(["--label", "daily", "--out", mk(), "--url", HOSTED], { SUPA_DB_URL: HOSTED });
    expect([r.status, r.stderr.includes("USAGE")]).toEqual([1, true]);
    expect(r.stdout + r.stderr).not.toContain(CANARY);
  });
  it("--dry-run prints a redacted plan, creates nothing and never prints the URL/password/host", () => {
    const out = mk();
    const r = runCreate(["--label", "pre-migration", "--out", out, "--dry-run"], { SUPA_DB_URL: HOSTED });
    expect(r.status).toBe(0);
    const all = r.stdout + r.stderr;
    expect(all).toContain("DRY-RUN");
    expect(all).toContain("class\":\"event\"");
    expect(all).not.toContain(CANARY);
    expect(all).not.toContain("abcdefgh");
    expect(all).not.toContain("supabase.co");
    expect(readdirSync(out)).toEqual([]);
  });
});

describe("labels / retention / names", () => {
  it("maps labels to retention classes as metadata", () => {
    expect(retentionFor("daily")).toMatchObject({ class: "daily", days: 30 });
    expect(retentionFor("monthly")).toMatchObject({ class: "monthly", months: 12 });
    for (const l of LABELS.filter((x) => x !== "daily" && x !== "monthly")) expect(retentionFor(l)).toMatchObject({ class: "event", days: 90 });
    expect(() => retentionFor("weekly")).toThrow();
  });
  it("timestamps are UTC YYYYMMDD-HHMMSS", () => {
    expect(timestampUtc(new Date(Date.UTC(2026, 9, 4, 1, 2, 3)))).toBe("20261004-010203");
  });
  it("host fingerprint is sha256 of the normalized host only", () => {
    expect(hostFingerprint(" DB.Example.COM ")).toBe(createHash("sha256").update("db.example.com").digest("hex"));
  });
  it("redact removes secret fragments in raw and encoded form", () => {
    expect(redact(`x ${CANARY} y ${encodeURIComponent("a b+c")}`, [CANARY, "a b+c"])).toBe("x [REDACTED] y [REDACTED]");
  });
});

const TOC_FULL = [
  ";     dbname: postgres",
  ";     Dumped from database version 17.6",
  ";     Dumped by pg_dump version 17.6",
  "10; 2615 16400 SCHEMA - auth postgres",
  "11; 2615 16401 SCHEMA - supabase_migrations postgres",
  "200; 1259 16500 TABLE public users postgres",
  "201; 1259 16501 TABLE auth users supabase_auth_admin",
  "202; 1259 16502 TABLE auth schema_migrations supabase_auth_admin",
  "203; 1259 16503 TABLE supabase_migrations schema_migrations postgres",
  "300; 0 16500 TABLE DATA public users postgres",
  "301; 0 16501 TABLE DATA auth users supabase_auth_admin",
  "302; 0 16502 TABLE DATA auth schema_migrations supabase_auth_admin",
  "303; 0 16503 TABLE DATA supabase_migrations schema_migrations postgres",
  "400; 2620 16999 TRIGGER auth users on_auth_user_created supabase_auth_admin",
  "210; 1255 16401 FUNCTION public handle_new_auth_user() postgres",
].join("\n");
const TOC_NO_AUTH = TOC_FULL.split("\n").filter((l) => !/ auth /.test(l)).join("\n");

const baseEvidence = (): any => ({
  dumpPresent: true,
  rolesPresent: true,
  infoPresent: true,
  toc: summarizeToc(parseToc(TOC_FULL)),
  migrations: { supabase_migrations: { count: 15, latest: "20260929020000" }, auth: { count: 75, latest: "20260101000000" } },
  migrationsAfter: { supabase_migrations: { count: 15, latest: "20260929020000" }, auth: { count: 75, latest: "20260101000000" } },
  relationships: { public_without_auth: 0, auth_without_public: 0 },
  rowCounts: { public: { "public.users": 2 }, auth: { "auth.users": 2, "auth.schema_migrations": 75 } },
});

function makePackage(opts: { evidence?: ReturnType<typeof baseEvidence>; dump?: string; roles?: string | null; mutate?: (m: Record<string, any>) => void } = {}) {
  const d = mk();
  const dump = Buffer.from(opts.dump ?? "PGDMP-fake-custom-dump-bytes-0123456789");
  const roles = opts.roles === undefined ? "CREATE ROLE anon;\n" : opts.roles;
  const info = "server_version: 17.6\n";
  writeFileSync(join(d, "10-full.dump"), dump);
  if (roles !== null) writeFileSync(join(d, "20-roles.sql"), roles);
  writeFileSync(join(d, "30-server-info.txt"), info);
  const art = (file: string, b: Buffer | string) => ({ file, sha256: createHash("sha256").update(b).digest("hex"), bytes: Buffer.byteLength(b) });
  const artifacts = [art("10-full.dump", dump), art("30-server-info.txt", info), ...(roles !== null ? [art("20-roles.sql", roles)] : [])];
  const m = buildManifest({
    createdAt: "2026-10-04T00:00:00.000Z",
    label: "daily",
    environment: "test",
    hostFingerprint: hostFingerprint("db.example.com"),
    envVarName: "SUPA_DB_URL",
    info: { server_version: "17.6", extensions: [{ name: "pgcrypto", version: "1.3" }], tables: [], supabase_migrations: null, auth_migrations: null },
    toc: parseToc(TOC_FULL),
    image: "public.ecr.aws/supabase/postgres:17.6.1.166",
    readOnlyEnforcement: "test",
    repo: { count: 15, latest: "20260929020000" },
    evidence: opts.evidence ?? baseEvidence(),
    rowCountsAfter: { public: { "public.users": 2 }, auth: { "auth.users": 2, "auth.schema_migrations": 75 } },
    artifacts,
  }) as Record<string, any>;
  opts.mutate?.(m);
  writeFileSync(join(d, "MANIFEST.json"), JSON.stringify(m));
  return { d, m };
}
const toc = (t: string) => () => t;

describe("validatePackage", () => {
  it("complete package => FULL_CANDIDATE exit 0 (never FULL)", async () => {
    const { d, m } = makePackage();
    const r = await validatePackage(d, { readToc: toc(TOC_FULL) });
    expect([r.level, r.exit, r.problems, r.reasons]).toEqual(["FULL_CANDIDATE", 0, [], []]);
    expect(m.completeness).toEqual({ level: "FULL_CANDIDATE", reasons: [] });
    expect(JSON.stringify(m)).not.toMatch(/"FULL"/);
    expect(m.encryption).toEqual({ status: "NONE_UNENCRYPTED_LOCAL" });
  });
  it("truncated dump fails validate (code truncated), also when emptied", async () => {
    const { d } = makePackage();
    writeFileSync(join(d, "10-full.dump"), "PGDMP-fake");
    let r = await validatePackage(d, { readToc: toc(TOC_FULL) });
    expect([r.level, r.exit, r.problems]).toEqual(["INVALID", 1, ["truncated"]]);
    writeFileSync(join(d, "10-full.dump"), "");
    r = await validatePackage(d, { readToc: toc(TOC_FULL) });
    expect([r.exit, r.problems]).toEqual([1, ["truncated"]]);
  });
  it("same-size corrupted dump => hash-mismatch", async () => {
    const { d } = makePackage({ dump: "A".repeat(40) });
    writeFileSync(join(d, "10-full.dump"), "B".repeat(40));
    const r = await validatePackage(d, { readToc: toc(TOC_FULL) });
    expect([r.exit, r.problems]).toEqual([1, ["hash-mismatch"]]);
  });
  it("bad sha256 in manifest fails", async () => {
    const { d } = makePackage({ mutate: (m) => (m.artifacts[0].sha256 = "0".repeat(64)) });
    const r = await validatePackage(d, { readToc: toc(TOC_FULL) });
    expect([r.exit, r.problems]).toEqual([1, ["hash-mismatch"]]);
  });
  it("wrong manifest version fails", async () => {
    for (const v of [2, 0, "1", undefined]) {
      const { d } = makePackage({ mutate: (m) => (m.schema_version = v) });
      const r = await validatePackage(d, { readToc: toc(TOC_FULL) });
      expect([r.level, r.exit, r.problems]).toEqual(["INVALID", 1, ["wrong-manifest-version"]]);
    }
  });
  it("missing manifest / unparseable manifest / missing dump => invalid", async () => {
    const e = mk();
    expect((await validatePackage(e, { readToc: toc(TOC_FULL) })).problems).toEqual(["missing"]);
    const { d } = makePackage();
    writeFileSync(join(d, "MANIFEST.json"), "{not json");
    expect((await validatePackage(d, { readToc: toc(TOC_FULL) })).problems).toEqual(["corrupt"]);
    const p2 = makePackage();
    rmSync(join(p2.d, "10-full.dump"));
    expect((await validatePackage(p2.d, { readToc: toc(TOC_FULL) })).problems).toEqual(["missing"]);
  });
  it("missing auth artifact in the dump TOC can never be FULL_CANDIDATE", async () => {
    const ev = baseEvidence();
    ev.toc = summarizeToc(parseToc(TOC_NO_AUTH));
    const { d, m } = makePackage({ evidence: ev });
    expect(m.completeness.level).toBe("PARTIAL");
    expect(m.completeness.reasons).toContain("missing-auth-artifact");
    const r = await validatePackage(d, { readToc: toc(TOC_NO_AUTH) });
    expect([r.level, r.exit]).toEqual(["PARTIAL", 2]);
    expect(r.reasons).toContain("missing-auth-artifact");
  });
  it("a manifest that claims FULL_CANDIDATE over an auth-less dump is rejected (claim is re-derived)", async () => {
    const { d } = makePackage();
    const r = await validatePackage(d, { readToc: toc(TOC_NO_AUTH) });
    expect([r.level, r.exit, r.problems]).toEqual(["INVALID", 1, ["manifest-claim-mismatch"]]);
  });
  it("empty/incomplete migration metadata can never be FULL_CANDIDATE", async () => {
    const cases: [string, (e: ReturnType<typeof baseEvidence>) => void][] = [
      ["auth count 0", (e) => (e.migrations.auth = { count: 0, latest: null as any })],
      ["supabase count 0", (e) => (e.migrations.supabase_migrations = { count: 0, latest: null as any })],
      ["auth null", (e) => (e.migrations.auth = null as any)],
      ["no latest", (e) => (e.migrations.supabase_migrations = { count: 3, latest: "" })],
    ];
    for (const [, f] of cases) {
      const ev = baseEvidence();
      f(ev);
      const { d, m } = makePackage({ evidence: ev });
      expect(m.completeness.level).toBe("PARTIAL");
      const r = await validatePackage(d, { readToc: toc(TOC_FULL) });
      expect([r.level, r.exit]).toEqual(["PARTIAL", 2]);
      expect(r.reasons).toContain("incomplete-migration-metadata");
    }
    // a forged manifest that claims FULL_CANDIDATE with empty metadata is invalid
    const { d } = makePackage({ mutate: (m) => (m.migrations.auth = { count: 0, latest: null }) });
    expect((await validatePackage(d, { readToc: toc(TOC_FULL) })).problems).toEqual(["manifest-claim-mismatch"]);
  });
  it("missing roles file / no TOC verification => PARTIAL, never FULL_CANDIDATE", async () => {
    const a = makePackage({ roles: null, evidence: { ...baseEvidence(), rolesPresent: false } });
    const ra = await validatePackage(a.d, { readToc: toc(TOC_FULL) });
    expect([ra.level, ra.reasons]).toEqual(["PARTIAL", ["roles-missing"]]);
    const b = makePackage();
    const rb = await validatePackage(b.d, { readToc: null });
    expect([rb.level, rb.reasons]).toEqual(["PARTIAL", ["toc-unverified"]]);
  });
  it("unreadable dump TOC => corrupt/invalid", async () => {
    const { d } = makePackage();
    const r = await validatePackage(d, {
      readToc: () => {
        throw new Error("boom");
      },
    });
    expect([r.exit, r.problems]).toEqual([1, ["corrupt"]]);
  });
  it("unlisted required artifact on disk is invalid", async () => {
    const { d } = makePackage({ mutate: (m) => (m.artifacts = m.artifacts.filter((a: { file: string }) => a.file !== "20-roles.sql")) });
    expect((await validatePackage(d, { readToc: toc(TOC_FULL) })).problems).toEqual(["unlisted-artifact"]);
  });
});

describe("manifest secrecy", () => {
  it("never contains the URL, password, user or raw host (canary)", () => {
    const { m } = makePackage();
    const text = JSON.stringify(m);
    for (const s of [CANARY, "postgresql://", "postgres.abcdefgh", "db.example.com", "supabase.co"]) expect(text).not.toContain(s);
    expect(m.source.host_fingerprint_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic in key and table ordering", () => {
    const a = makePackage({ evidence: { ...baseEvidence(), rowCounts: { public: { "public.b": 1, "public.a": 2 }, auth: { "auth.users": 2, "auth.schema_migrations": 75 } } } }).m;
    expect(Object.keys(a.row_counts.before.public)).toEqual(["public.a", "public.b"]);
  });
});

describe("failed SQL never becomes zero", () => {
  it("count output with errors/garbage/missing lines yields null, never 0", () => {
    const out = parseCountOutput("count|public.users|5\nERROR: permission denied\ncount|auth.users|\ncount|auth.sessions|abc\n", ["public.users", "auth.users", "auth.sessions", "auth.flow_state"]);
    expect(out).toEqual({ "public.users": 5, "auth.users": null, "auth.sessions": null, "auth.flow_state": null });
    expect(Object.values(out).filter((v) => v === 0)).toEqual([]);
  });
  it("null counts or null migration info => reasons, never FULL_CANDIDATE", () => {
    const ev = baseEvidence();
    ev.rowCounts.auth["auth.users"] = null as any;
    expect(deriveReasons(ev)).toContain("row-counts-unavailable");
    const ev2 = baseEvidence();
    (ev2 as any).rowCounts = null;
    expect(deriveReasons(ev2)).toContain("row-counts-unavailable");
    expect(parseInfoOutput("server_version|17.6\nmig_auth|abc|x\n").auth_migrations).toBeNull();
    expect(parseInfoOutput("mig_supabase|15|20260929020000\n").supabase_migrations).toEqual({ count: 15, latest: "20260929020000" });
  });
  it("restore range check rejects NaN/null/out-of-range", () => {
    expect(countWithinRange(NaN, 0, 0)).toBe(false);
    expect(countWithinRange(0, null as any, 1)).toBe(false);
    expect(countWithinRange(0, 2, 2)).toBe(false);
    expect(countWithinRange(2, 2, 2)).toBe(true);
    expect(countWithinRange(3, 2, 4)).toBe(true);
    expect(countWithinRange(5, 2, 4)).toBe(false);
  });
  it("a failing psql seam yields NaN, which fails the range check", () => {
    const num = makeCounter(() => ({ ok: false, code: 1, out: "" }));
    expect(countWithinRange(num("select 1"), 0, 0)).toBe(false);
  });
});

describe("classifyPackageRestore / legacy cap", () => {
  const ok = { name: "x", ok: true };
  const base = { level: "FULL_CANDIDATE", validations: [ok], authRestoredReal: true, triggerPresent: true, skippedCounts: 0 };
  it("FULL only when everything holds", () => {
    expect(classifyPackageRestore(base)).toMatchObject({ level: "FULL", exit: 0 });
  });
  it.each([
    ["partial package", { level: "PARTIAL" }],
    ["auth not real", { authRestoredReal: false }],
    ["trigger missing", { triggerPresent: false }],
    ["skipped counts", { skippedCounts: 2 }],
  ])("PARTIAL exit 2: %s", (_n, extra) => {
    expect(classifyPackageRestore({ ...base, ...extra })).toMatchObject({ level: "PARTIAL", exit: 2 });
  });
  it("any failed validation or INVALID package => FAIL exit 1", () => {
    expect(classifyPackageRestore({ ...base, validations: [{ name: "rows auth.users", ok: false }] })).toMatchObject({ level: "FAIL", exit: 1 });
    expect(classifyPackageRestore({ ...base, level: "INVALID" })).toMatchObject({ level: "FAIL", exit: 1 });
  });
  it("legacy 3-file layout is capped at PARTIAL even when nothing is populated", () => {
    const r = classifyResult({ backupComplete: true, validations: [ok], authBlockCount: 26, authPopulated: [], legacyLayout: true });
    expect([r.level, r.exit]).toEqual(["PARTIAL", 2]);
    expect(classifyResult({ backupComplete: true, validations: [ok], authBlockCount: 26, authPopulated: [] }).level).toBe("FULL");
  });
});

describe("toc / roles parsing", () => {
  it("summarizes schemas, migration data, trigger and function", () => {
    const s = summarizeToc(parseToc(TOC_FULL));
    expect(s).toMatchObject({ schemas_present: ["public", "auth", "supabase_migrations"], auth_schema_migrations_data: true, supabase_migrations_data: true, auth_user_trigger: true, public_handle_new_auth_user: true });
    expect(summarizeToc(parseToc(TOC_NO_AUTH))).toMatchObject({ auth_users_table: false, auth_user_trigger: false });
  });
  it("parses role names without attributes/passwords", () => {
    expect(parseRoleNames('CREATE ROLE anon;\nALTER ROLE anon WITH NOLOGIN;\nCREATE ROLE "x-y";\nCREATE ROLE supabase_admin;\n')).toEqual(["anon", "supabase_admin", "x-y"]);
  });
});

describe("repo hygiene: backup artifacts are never tracked", () => {
  it("no tracked file looks like a backup artifact, and ignore patterns cover them", () => {
    const ls = spawnSync("git", ["ls-files"], { encoding: "utf8", cwd: REPO });
    expect(ls.status).toBe(0);
    const bad = ls.stdout.split("\n").filter((f) => /(^|\/)(MANIFEST\.json|10-full\.dump|20-roles\.sql|30-server-info\.txt|01-schema\.sql|02-data-public\.sql|03-data-auth-migrations\.sql)$|\.dump$|^(backups|UNLOCK-backups)\//.test(f));
    expect(bad).toEqual([]);
    for (const probe of ["backups/x", "UNLOCK-backups/daily/MANIFEST.json", "a/b/10-full.dump", "x/20-roles.sql", "any/MANIFEST.json"]) {
      expect(spawnSync("git", ["check-ignore", "-q", probe], { cwd: REPO }).status, probe).toBe(0);
    }
  });
});

describe("package directory is created only outside the repo (path helper)", () => {
  it("accepts a sibling temp dir", () => {
    expect(() => assertOutputOutsideRepo(join(mk(), "new", "sub"), REPO)).not.toThrow();
  });
});

// =====================================================================================================================
// Slice G review fixes
// =====================================================================================================================
const url = (host: string, q = "") => `postgresql://postgres.abc:${CANARY}@${host}:5432/postgres${q}`;
const hostCode = (u: string, o?: { testMode?: boolean }) => {
  try {
    parseSourceUrl(u, o);
  } catch (e: any) {
    return e.code as string;
  }
  return "ACCEPTED";
};

describe("S1 hosted-host guard is not string-only", () => {
  it.each([
    "localhost.",
    "127.0.0.1.",
    "127.1",
    "0177.0.0.1",
    "0x7f.0.0.1",
    "0x7f000001",
    "2130706433",
    "10.1",
    "10.0.0.5.",
    "169.254.169.254",
    "8.8.8.8",
    "1.2.3.4.",
    "db.abcdefgh.supabase.co%25eth0",
    "[::1]",
    "[::ffff:127.0.0.1]",
    "[::ffff:7f00:1]",
    "[fd00::1]",
    "[fc00::1]",
    "[fe80::1]",
    "[::]",
    "db_x.supabase.co",
    "a..b.co",
  ])("refuses %s", (h) => {
    expect(hostCode(url(h))).toMatch(/^SOURCE_(HOST_NOT_ALLOWED|URL_INVALID)$/);
  });
  it("accepts a normal hosted hostname, a pooler hostname, a trailing-dot FQDN (normalized) and a global-unicast IPv6 literal", () => {
    expect(hostCode(url("db.abcdefgh.supabase.co"))).toBe("ACCEPTED");
    expect(hostCode(url("aws-0-eu-central-1.pooler.supabase.com"))).toBe("ACCEPTED");
    expect(parseSourceUrl(url("db.abcdefgh.supabase.co.")).host).toBe("db.abcdefgh.supabase.co");
    expect(hostCode(url("[2a05:d014::1]"))).toBe("ACCEPTED");
    expect(hostCode(url("1abc.example.com"))).toBe("ACCEPTED");
  });
  it("every refusal above is SOURCE_HOST_NOT_ALLOWED (not an accidental parse error) for the named bypass families", () => {
    for (const h of ["localhost.", "127.1", "0177.0.0.1", "0x7f.0.0.1", "10.1", "[::1]", "[::ffff:127.0.0.1]", "[fd00::1]", "[fe80::1]", "db.abcdefgh.supabase.co%25eth0"]) {
      expect(hostCode(url(h)), h).toBe("SOURCE_HOST_NOT_ALLOWED");
    }
  });
  it("the trailing-dot strip is applied before the loopback rules and the test-mode name rule", () => {
    expect(hostCode(url("unlock-bkptest-abc-src."))).toBe("SOURCE_HOST_NOT_ALLOWED"); // hosted mode never accepts test hosts
    expect(parseSourceUrl("postgres://u:pw1234@unlock-bkptest-abc-src.:5432/postgres", { testMode: true }).host).toBe("unlock-bkptest-abc-src");
  });
});

describe("S2 sslmode", () => {
  it.each(["disable", "allow", "prefer"])("hosted mode refuses sslmode=%s with SOURCE_SSLMODE_WEAK", (m) => {
    expect(hostCode(url("db.abcdefgh.supabase.co", `?sslmode=${m}`))).toBe("SOURCE_SSLMODE_WEAK");
  });
  it.each(["require", "verify-ca", "verify-full"])("hosted mode accepts sslmode=%s and passes it through", (m) => {
    const src = parseSourceUrl(url("db.abcdefgh.supabase.co", `?sslmode=${m}`));
    expect(sourceContainerEnv(src).PGSSLMODE).toBe(m);
  });
  it("hosted mode with no sslmode passes PGSSLMODE=require; test mode adds nothing it was not given", () => {
    expect(sourceContainerEnv(parseSourceUrl(url("db.abcdefgh.supabase.co"))).PGSSLMODE).toBe("require");
    const t = parseSourceUrl("postgres://u:pw1234@unlock-bkptest-abc-src:5432/postgres", { testMode: true });
    expect(sourceContainerEnv(t, { testMode: true }).PGSSLMODE).toBeUndefined();
  });
  it("the CLI refuses a weak sslmode with the stable code and no canary", () => {
    const out = mk();
    const r = runCreate(["--label", "daily", "--out", out, "--confirm-read-only-source"], { SUPA_DB_URL: `${HOSTED}?sslmode=disable` });
    expect([r.status, r.stderr.includes("SOURCE_SSLMODE_WEAK")]).toEqual([1, true]);
    expect(r.stdout + r.stderr).not.toContain(CANARY);
    expect(readdirSync(out)).toEqual([]);
  });
});

describe("S4 a claimed PARTIAL manifest never becomes FULL_CANDIDATE", () => {
  it.each([[["X_Y"]], [["UPPER", "has space"]], [[42, null]]])("claimed PARTIAL with only malformed reasons %j => PARTIAL manifest-partial", async (reasons) => {
    const { d } = makePackage({ mutate: (m) => (m.completeness = { level: "PARTIAL", reasons }) });
    const r = await validatePackage(d, { readToc: toc(TOC_FULL) });
    expect([r.level, r.exit, r.reasons]).toEqual(["PARTIAL", 2, ["manifest-partial"]]);
  });
  it("a valid claimed reason survives and no extra code is added", async () => {
    const { d } = makePackage({ mutate: (m) => (m.completeness = { level: "PARTIAL", reasons: ["operator-note"] }) });
    expect((await validatePackage(d, { readToc: toc(TOC_FULL) })).reasons).toEqual(["operator-note"]);
  });
});

describe("S5 plaintext manifest cannot hide tables (table-set cross-check)", () => {
  it("equal sets pass; a table missing from or extra in the restore fails; empty manifest set fails", () => {
    expect(compareTableSets(["public.a", "auth.users"], ["auth.users", "public.a"]).ok).toBe(true);
    expect(compareTableSets(["public.a", "auth.users"], ["public.a"])).toMatchObject({ ok: false, missingFromRestore: ["auth.users"], extraInRestore: [] });
    expect(compareTableSets(["public.a"], ["public.a", "auth.sessions"])).toMatchObject({ ok: false, extraInRestore: ["auth.sessions"] });
    expect(compareTableSets([], []).ok).toBe(false);
  });
  it("a failed cross-check validation makes the restore FAIL, never FULL", () => {
    const base = { level: "FULL_CANDIDATE", validations: [{ name: "manifest table set == restored public+auth table set", ok: false }], authRestoredReal: true, triggerPresent: true, skippedCounts: 0 };
    expect(classifyPackageRestore(base)).toMatchObject({ level: "FAIL", exit: 1 });
  });
});

describe("S6 the source URL / password never reach docker argv or the container config", () => {
  const src = parseSourceUrl(HOSTED);
  const argvFor = (extra: Record<string, unknown> = {}) =>
    buildSourceRunArgs({ containerName: "unlock-backup-x", image: "public.ecr.aws/supabase/postgres:17.6.1.166", network: undefined, targetDir: mk(), withInput: false, withMount: true, envNames: Object.keys(sourceContainerEnv(src)), script: "umask 077; pg_dump -w -Fc -f /out/10-full.dump", ...extra });
  it("env carries the parts, argv carries only variable NAMES", () => {
    const env = sourceContainerEnv(src);
    expect(env).toMatchObject({ PGHOST: "db.abcdefgh.supabase.co", PGPORT: "5432", PGUSER: "postgres.abcdefgh", PGPASSWORD: CANARY, PGDATABASE: "postgres", PGSSLMODE: "require" });
    expect(Object.values(env)).not.toContain(HOSTED);
    const a: string[] = argvFor();
    const joined = a.join("\u0001");
    for (const secret of [CANARY, "postgres.abcdefgh", "abcdefgh", "supabase.co", "postgresql://", HOSTED]) expect(joined, secret).not.toContain(secret);
    expect(a.filter((_x, i) => a[i - 1] === "-e")).toEqual(Object.keys(env));
    expect(a).toContain("PGPASSWORD");
  });
  it("is hardened (cap-drop ALL, no-new-privileges, memory, pids) and bind-mounts only the output dir", () => {
    const a: string[] = argvFor();
    expect(a.join(" ")).toContain("--cap-drop ALL --security-opt no-new-privileges --memory 2g --pids-limit 512");
    expect(a.some((x) => x.startsWith("type=bind,source=") && x.endsWith(",target=/out"))).toBe(true);
  });
  it("the --dry-run plan names env variables only, shows the hardening, and never prints the canary", () => {
    const out = mk();
    const r = runCreate(["--label", "daily", "--out", out, "--dry-run"], { SUPA_DB_URL: HOSTED });
    expect(r.status).toBe(0);
    const all = r.stdout + r.stderr;
    expect(all).not.toContain(CANARY);
    expect(all).not.toContain("UNLOCK_SRC_URL");
    expect(all).toContain("PGPASSWORD");
    expect(all).toContain("--cap-drop ALL");
    expect(all).toContain("PGSSLMODE=require");
  });
  it("manifest secrecy still holds (canary is not in any manifest field)", () => {
    expect(JSON.stringify(makePackage().m)).not.toContain(CANARY);
  });
});

describe("S7 the realpath-resolved bind-mount source is re-checked", () => {
  it("a clean-looking junction/symlink to a directory whose real path contains a comma is refused", () => {
    const base = mk();
    const evil = join(base, "a,b");
    mkdirSync(evil);
    const link = join(base, "clean");
    symlinkSync(evil, link, "junction");
    expect(/[,"\r\n\0]/.test(link)).toBe(false); // the string the caller sees is clean
    expect(() => assertSafeMountSource(link)).toThrow(/OUTPUT_PATH_UNSAFE/); // docker would receive the resolved path
    writeFileSync(join(evil, "10-full.dump"), "x");
    expect(() => buildTocArgs(join(link, "10-full.dump"))).toThrow(/OUTPUT_PATH_UNSAFE/);
    expect(() => buildSourceRunArgs({ containerName: "unlock-backup-x", image: "i", network: undefined, targetDir: link, withInput: false, withMount: true, envNames: [], script: "true" })).toThrow(/OUTPUT_PATH_UNSAFE/);
  });
  it("an ordinary directory resolves and is returned as the mount source", () => {
    const d = mk();
    expect(assertSafeMountSource(d)).toMatch(/unlock-bkp-test-/);
    expect(buildTocArgs(join(d, "10-full.dump")).join(" ")).toContain("--cap-drop ALL");
  });
});

describe("S9 container hardening", () => {
  it("the restore container drops all caps, adds back only the postgres-entrypoint set, and never gains privileges", () => {
    const a: string[] = buildRestoreRunArgs({ name: "unlock-restore-x", image: "public.ecr.aws/supabase/postgres:17.6.1.166", mountSource: "C:\\x", publish: null });
    expect(a.join(" ")).toContain(CONTAINER_HARDENING.join(" "));
    expect(a.filter((_x, i) => a[i - 1] === "--cap-add")).toEqual([...POSTGRES_ENTRYPOINT_CAPS]);
    expect(a.indexOf("--cap-drop")).toBeLessThan(a.indexOf("--cap-add"));
    expect(a).toContain("no-new-privileges");
    expect(a).not.toContain("--privileged");
    expect(a.join(" ")).toContain("--network none");
    expect(a.some((x) => x.endsWith(",target=/backup,readonly"))).toBe(true);
    expect(buildRestoreRunArgs({ name: "unlock-restore-x", image: "i", mountSource: "x", publish: "127.0.0.1:55432:5432" })).not.toContain("--network");
  });
});

describe("D1 public.users<->auth.users orphan counts are recorded and must be reproduced exactly", () => {
  it("manifest records both counts (info only: non-zero is allowed and still FULL_CANDIDATE)", async () => {
    const ev = baseEvidence();
    ev.relationships = { public_without_auth: 3, auth_without_public: 0 };
    const { d, m } = makePackage({ evidence: ev });
    expect(m.relationships).toMatchObject({ public_without_auth: 3, auth_without_public: 0 });
    expect(m.completeness).toEqual({ level: "FULL_CANDIDATE", reasons: [] });
    expect((await validatePackage(d, { readToc: toc(TOC_FULL) })).level).toBe("FULL_CANDIDATE");
  });
  it("an unavailable (null/garbled/absent) count => PARTIAL relationship-counts-unavailable, never FULL_CANDIDATE", async () => {
    for (const rel of [{ public_without_auth: null, auth_without_public: 0 }, { public_without_auth: 0, auth_without_public: null }, null, undefined]) {
      const ev = baseEvidence();
      ev.relationships = rel;
      const { d, m } = makePackage({ evidence: ev });
      expect(m.completeness.level).toBe("PARTIAL");
      expect(m.completeness.reasons).toContain("relationship-counts-unavailable");
      const r = await validatePackage(d, { readToc: toc(TOC_FULL) });
      expect([r.level, r.exit]).toEqual(["PARTIAL", 2]);
      expect(r.reasons).toContain("relationship-counts-unavailable");
    }
    // a forged FULL_CANDIDATE claim over a missing count is invalid
    const { d } = makePackage({ mutate: (m) => (m.relationships.public_without_auth = null) });
    expect((await validatePackage(d, { readToc: toc(TOC_FULL) })).problems).toEqual(["manifest-claim-mismatch"]);
  });
  it("parse: missing/garbled lines are null, never 0", () => {
    expect(parseRelationshipCounts("rel|public_without_auth|3\nrel|auth_without_public|0\n")).toEqual({ public_without_auth: 3, auth_without_public: 0 });
    expect(parseRelationshipCounts("ERROR: relation does not exist\nrel|public_without_auth|x\n")).toEqual({ public_without_auth: null, auth_without_public: null });
    expect(buildRelationshipSql()).toMatch(/auth\.users/);
  });
  it("restore gate: equal passes; any difference or NaN/null restored fails; unavailable manifest is skipped (PARTIAL), not passed as FULL", () => {
    const man = { public_without_auth: 3, auth_without_public: 0 };
    expect(relationshipCheck(man, { public_without_auth: 3, auth_without_public: 0 })).toEqual({ skipped: false, ok: true });
    expect(relationshipCheck(man, { public_without_auth: 0, auth_without_public: 0 }).ok).toBe(false);
    expect(relationshipCheck(man, { public_without_auth: 3, auth_without_public: 1 }).ok).toBe(false);
    expect(relationshipCheck(man, { public_without_auth: NaN, auth_without_public: 0 }).ok).toBe(false);
    expect(relationshipCheck({ public_without_auth: 0, auth_without_public: 0 }, { public_without_auth: NaN, auth_without_public: NaN }).ok).toBe(false);
    expect(relationshipCheck({ public_without_auth: null, auth_without_public: 0 }, { public_without_auth: 0, auth_without_public: 0 })).toEqual({ skipped: true, ok: true });
    expect(relationshipCheck(null, { public_without_auth: 0, auth_without_public: 0 }).skipped).toBe(true);
    // skipped => the classifier cannot return FULL
    expect(classifyPackageRestore({ level: "FULL_CANDIDATE", validations: [], authRestoredReal: true, triggerPresent: true, skippedCounts: 1 }).level).toBe("PARTIAL");
  });
});

describe("D2 volatile auth tables get a wide window; nothing else does", () => {
  const dt = ["auth.sessions", "auth.refresh_tokens", "auth.users", "public.users"];
  it("the volatile allow-list is exactly the churny auth tables and only auth.*", () => {
    expect([...VOLATILE_TABLES].sort()).toEqual(["auth.audit_log_entries", "auth.flow_state", "auth.mfa_amr_claims", "auth.mfa_challenges", "auth.one_time_tokens", "auth.refresh_tokens", "auth.sessions"]);
    expect(VOLATILE_TABLES.every((t) => t.startsWith("auth."))).toBe(true);
    for (const t of ["auth.users", "auth.identities", "auth.schema_migrations", "auth.mfa_factors", "public.users"]) expect(VOLATILE_TABLES).not.toContain(t);
  });
  it("volatile: restored within [0,max] passes (even below min) and is flagged volatile; above max, NaN, or no TOC data entry fails", () => {
    expect(checkTableCount({ table: "auth.sessions", restored: 2, before: 10, after: 12, dataTables: dt })).toMatchObject({ ok: true, volatile: true, range: "[0,12]" });
    expect(checkTableCount({ table: "auth.sessions", restored: 0, before: 10, after: 12, dataTables: dt }).ok).toBe(true);
    expect(checkTableCount({ table: "auth.sessions", restored: 13, before: 10, after: 12, dataTables: dt }).ok).toBe(false);
    expect(checkTableCount({ table: "auth.sessions", restored: NaN, before: 10, after: 12, dataTables: dt }).ok).toBe(false);
    expect(checkTableCount({ table: "auth.sessions", restored: 5, before: null as any, after: 12, dataTables: dt }).ok).toBe(false);
    expect(checkTableCount({ table: "auth.sessions", restored: 5, before: 10, after: 12, dataTables: ["auth.users"] }).ok).toBe(false);
    expect(checkTableCount({ table: "auth.sessions", restored: 5, before: 10, after: 12, dataTables: undefined }).ok).toBe(false);
  });
  it("non-volatile tables keep the strict [min,max] gate (no wide window) even when the TOC has them", () => {
    for (const t of ["auth.users", "public.users", "auth.schema_migrations", "auth.identities"]) {
      expect(checkTableCount({ table: t, restored: 2, before: 10, after: 12, dataTables: [t] })).toMatchObject({ ok: false, volatile: false, range: "[10,12]" });
      expect(checkTableCount({ table: t, restored: 0, before: 10, after: 12, dataTables: [t] }).ok).toBe(false);
      expect(checkTableCount({ table: t, restored: 11, before: 10, after: 12, dataTables: [t] }).ok).toBe(true);
    }
  });
  it("summarizeToc exposes the data-table list used for the TOC requirement", () => {
    expect(summarizeToc(parseToc(TOC_FULL)).data_tables).toEqual(["auth.schema_migrations", "auth.users", "public.users", "supabase_migrations.schema_migrations"]);
  });
});

describe("D3 trigger check is strict (real SQL against PGlite)", () => {
  const setup = async (variant: string) => {
    const db = new PGlite();
    await db.exec(`
      create schema auth;
      create table auth.users (id int primary key);
      create table public.other (id int primary key);
      create function public.handle_new_auth_user() returns trigger language plpgsql as $f$ begin return new; end $f$;
      create function public.some_other_fn() returns trigger language plpgsql as $f$ begin return new; end $f$;
    `);
    await db.exec(variant);
    const r = await db.query<{ count: string }>(TRIGGER_CHECK_SQL);
    await db.close();
    return Number(r.rows[0].count);
  };
  const good = "create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();";
  it("a correct enabled trigger passes (1)", async () => {
    expect(await setup(good)).toBe(1);
  }, 60000);
  it.each([
    ["disabled (D)", `${good} alter table auth.users disable trigger on_auth_user_created;`],
    ["replica-only (R)", `${good} alter table auth.users enable replica trigger on_auth_user_created;`],
    ["always (A)", `${good} alter table auth.users enable always trigger on_auth_user_created;`],
    ["same name on another table", "create trigger on_auth_user_created after insert on public.other for each row execute function public.handle_new_auth_user();"],
    ["same name running another function", "create trigger on_auth_user_created after insert on auth.users for each row execute function public.some_other_fn();"],
    ["different trigger name", "create trigger something_else after insert on auth.users for each row execute function public.handle_new_auth_user();"],
    ["absent", "select 1;"],
  ])("does not pass: %s", async (_n, sql) => {
    expect(await setup(sql)).toBe(0);
  }, 60000);
  it("auth.users missing => the query errors (NaN in the script, fails closed)", async () => {
    const d2 = new PGlite();
    await d2.exec("create function public.handle_new_auth_user() returns trigger language plpgsql as $f$ begin return new; end $f$;");
    await expect(d2.query(TRIGGER_CHECK_SQL)).rejects.toThrow();
    await d2.close();
  }, 60000);
  it("the SQL pins every condition", () => {
    for (const frag of ["tgrelid = 'auth.users'::regclass", "tgenabled = 'O'", "tgfoid = 'public.handle_new_auth_user'::regproc", "not tgisinternal"]) expect(TRIGGER_CHECK_SQL).toContain(frag);
  });
});

describe("D4 migration state is re-read after the dump", () => {
  it("unchanged => no reason; changed count or latest, or an unreadable re-read => PARTIAL migration-state-changed-during-dump", async () => {
    expect(deriveReasons(baseEvidence())).not.toContain("migration-state-changed-during-dump");
    const cases: ((e: any) => void)[] = [
      (e) => (e.migrationsAfter.supabase_migrations = { count: 16, latest: "20260929020000" }),
      (e) => (e.migrationsAfter.supabase_migrations = { count: 15, latest: "20261001000000" }),
      (e) => (e.migrationsAfter.auth = { count: 76, latest: "20260101000000" }),
      (e) => (e.migrationsAfter = { supabase_migrations: null, auth: null }),
      (e) => (e.migrationsAfter = undefined),
    ];
    for (const f of cases) {
      const ev = baseEvidence();
      f(ev);
      expect(deriveReasons(ev)).toContain("migration-state-changed-during-dump");
      const { d, m } = makePackage({ evidence: ev });
      expect(m.completeness.level).toBe("PARTIAL");
      expect(m.completeness.reasons).toContain("migration-state-changed-during-dump");
      const r = await validatePackage(d, { readToc: toc(TOC_FULL) });
      expect([r.level, r.exit]).toEqual(["PARTIAL", 2]);
    }
  });
  it("both before and after are recorded in the manifest; a forged unchanged-claim over a changed state is invalid", async () => {
    const ev = baseEvidence();
    ev.migrationsAfter.supabase_migrations = { count: 16, latest: "20261001000000" };
    const { m } = makePackage({ evidence: ev });
    expect(m.migrations.supabase_migrations).toEqual({ count: 15, latest: "20260929020000" });
    expect(m.migrations.after.supabase_migrations).toEqual({ count: 16, latest: "20261001000000" });
    const forged = makePackage({ mutate: (x) => (x.migrations.after.supabase_migrations = { count: 99, latest: "9" }) });
    expect((await validatePackage(forged.d, { readToc: toc(TOC_FULL) })).problems).toEqual(["manifest-claim-mismatch"]);
  });
  it("parse of the re-read query output (null when unreadable) and SQL shape", () => {
    expect(parseMigrationState("mig_supabase|15|20260929020000\nmig_auth|75|20260101000000\n")).toEqual({ supabase_migrations: { count: 15, latest: "20260929020000" }, auth: { count: 75, latest: "20260101000000" } });
    expect(parseMigrationState("ERROR: permission denied\n")).toEqual({ supabase_migrations: null, auth: null });
    expect(buildMigrationStateSql()).toMatch(/supabase_migrations\.schema_migrations[\s\S]*auth\.schema_migrations/);
  });
});

describe("D5 FULL output carries the honest caveat", () => {
  it("RESULT: FULL is followed by the caveat line", () => {
    const r = classifyPackageRestore({ level: "FULL_CANDIDATE", validations: [{ name: "x", ok: true }], authRestoredReal: true, triggerPresent: true, skippedCounts: 0 });
    expect(r.lines[0]).toMatch(/^RESULT: FULL/);
    expect(r.lines.join("\n")).toContain(FULL_CAVEAT);
    expect(FULL_CAVEAT).toContain("hosted GoTrue-version equality and sign-in usability are not verified");
  });
});
