/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed manifest/evidence fixtures for negative tests */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LABELS,
  assertOutputOutsideRepo,
  buildManifest,
  classifyPackageRestore,
  countWithinRange,
  deriveReasons,
  hostFingerprint,
  parseCountOutput,
  parseInfoOutput,
  parseRoleNames,
  parseSourceUrl,
  parseToc,
  redact,
  retentionFor,
  summarizeToc,
  timestampUtc,
  validatePackage,
} from "../../../scripts/lib/backup-package.mjs";
import { classifyResult, makeCounter } from "../../../scripts/lib/restore-local.mjs";

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
