import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertLocalDockerEndpoint,
  assertSafeDockerEnv,
  assertSafeRunOptions,
  buildAuthStageSql,
  classifyResult,
  extractTriggerSql,
  makeCounter,
  parseCount,
  parseCopyBlocks,
  rewriteCopyTarget,
  sanitizedEnv,
  validateBackupDir,
} from "../../../scripts/lib/restore-local.mjs";

const ok = { name: "x", ok: true };

describe("restore-local: option / URL guard", () => {
  const base = { name: "unlock-restore-abc123", env: {} as Record<string, string | undefined> };
  it("accepts the default local container shape", () => {
    expect(() => assertSafeRunOptions({ ...base, publish: "127.0.0.1:55432:5432" })).not.toThrow();
    expect(() => assertSafeRunOptions({ ...base })).not.toThrow();
  });
  it.each([
    "postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres",
    "postgresql://u:p@aws-0-eu.pooler.supabase.com:6543/postgres",
    "postgres://u@localhost:5432/postgres?host=db.supabase.co",
    "postgres://u@localhost:5432/postgres?hostaddr=10.0.0.5",
    "postgres://u@localhost,db.supabase.co:5432/postgres",
    "postgres://localhost@db.supabase.co:5432/postgres",
    "postgres://u@127.0.0.1@db.supabase.co/postgres",
  ])("rejects --url %s", (url) => {
    expect(() => assertSafeRunOptions({ ...base, url })).toThrow();
  });
  it("refuses even a valid local --url (own container only)", () => {
    expect(() => assertSafeRunOptions({ ...base, url: "postgres://u:p@127.0.0.1:5432/postgres" })).toThrow(/own disposable/);
  });
  it.each(["postgres:17", "evil/postgres:1", "public.ecr.aws/other/postgres:17", "supabase/postgres:1 --privileged"])(
    "rejects image %s",
    (image) => expect(() => assertSafeRunOptions({ ...base, image })).toThrow(),
  );
  it.each(["prod-db", "unlock-restore-", "unlock-restore-A", "unlock-restore-a b"])("rejects name %s", (name) =>
    expect(() => assertSafeRunOptions({ env: {}, name })).toThrow(),
  );
  it.each(["0.0.0.0:5432:5432", "5432:5432", "10.0.0.1:55432:5432", "127.0.0.1:55432:6543", "127.0.0.1:99999:5432"])(
    "rejects publish %s",
    (publish) => expect(() => assertSafeRunOptions({ ...base, publish })).toThrow(),
  );
  it("rejects non-local env redirectors", () => {
    expect(() => assertSafeRunOptions({ ...base, env: { PGHOST: "db.supabase.co" } })).toThrow();
    expect(() => assertSafeRunOptions({ ...base, env: { PGHOSTADDR: "1.2.3.4" } })).toThrow();
    expect(() => assertSafeRunOptions({ ...base, env: { DOCKER_HOST: "tcp://remote:2375" } })).toThrow();
  });
  it("sanitizedEnv drops hosted-target env", () => {
    const e = sanitizedEnv({ DATABASE_URL: "x", SUPABASE_URL: "x", PGHOST: "x", PATH: "p" });
    expect(Object.keys(e)).toEqual(["PATH"]);
  });
});

describe("restore-local: classifyResult", () => {
  const good = { backupComplete: true, validations: [ok], authBlockCount: 26 };
  it("incomplete backup => FAIL exit 1", () => {
    const r = classifyResult({ ...good, backupComplete: false, authPopulated: [] });
    expect([r.level, r.exit]).toEqual(["FAIL", 1]);
  });
  it("count mismatch / failed validation => FAIL", () => {
    const r = classifyResult({ ...good, validations: [{ name: "public.users rows", ok: false }], authPopulated: ["users"] });
    expect(r.level).toBe("FAIL");
    expect(r.lines.join("\n")).toContain("public.users rows");
  });
  it("populated auth omitted => PARTIAL exit 2, never FULL, honest wording", () => {
    const r = classifyResult({ ...good, authPopulated: ["users", "sessions"] });
    expect([r.level, r.exit]).toEqual(["PARTIAL", 2]);
    const text = r.lines.join("\n");
    expect(text).toContain("AUTH NOT RECOVERED (staged for integrity only)");
    expect(text).toContain("users, sessions");
    expect(text).not.toMatch(/full recovery/i);
  });
  it("no auth blocks at all => PARTIAL, not FULL", () => {
    expect(classifyResult({ ...good, authBlockCount: 0, authPopulated: [] }).level).toBe("PARTIAL");
  });
  it("some but not all auth blocks => FAIL", () => {
    expect(classifyResult({ ...good, authBlockCount: 10, authPopulated: [] }).level).toBe("FAIL");
  });
  it("FULL only when nothing omitted and everything passes", () => {
    expect(classifyResult({ ...good, authPopulated: ["users"], authRestoredReal: ["users"] }).level).toBe("FULL");
    expect(classifyResult({ ...good, authPopulated: [] }).exit).toBe(0);
  });
  it("auth emptied while public.users populated => PARTIAL, not FULL (drill D regression)", () => {
    const r = classifyResult({ ...good, authPopulated: [], publicUsers: 76, stagedAuthUsers: 0 });
    expect([r.level, r.exit]).toEqual(["PARTIAL", 2]);
    expect(r.lines.join("\n")).toContain("AUTH NOT RECOVERED");
    expect(classifyResult({ ...good, authPopulated: [], publicUsers: 0, stagedAuthUsers: 0 }).level).toBe("FULL");
  });
  it("FAIL output never claims full recovery", () => {
    const r = classifyResult({ ...good, backupComplete: false, authPopulated: [] });
    expect(r.lines.join("\n")).not.toMatch(/full recovery|RESULT: FULL/i);
  });
});

describe("restore-local: COPY rewrite / parse", () => {
  const header = 'COPY "auth"."users" ("id", "email") FROM stdin;';
  it("rewrites only the target schema", () => {
    expect(rewriteCopyTarget(header, "auth", "auth_dump_stage")).toBe('COPY "auth_dump_stage"."users" ("id", "email") FROM stdin;');
    expect(rewriteCopyTarget('COPY "public"."users" ("id") FROM stdin;', "auth", "auth_dump_stage")).toContain('"public"."users"');
    expect(rewriteCopyTarget("a\tb", "auth", "auth_dump_stage")).toBe("a\tb");
  });
  it("parses counts, CRLF, unterminated blocks", () => {
    const t = `${header}\r\n1\ta\r\n2\tb\r\n\\.\r\nCOPY "auth"."x" ("id") FROM stdin;\r\n1\r\n`;
    const b = parseCopyBlocks(t);
    expect(b.map((x) => [x.table, x.rows, x.terminated])).toEqual([["users", 2, true], ["x", 1, false]]);
  });
  it("stage SQL is all-text, retargeted, rejects unsafe identifiers", () => {
    const sql = buildAuthStageSql(parseCopyBlocks(`${header}\n1\ta\n\\.\n`, { keepRows: true }));
    expect(sql).toContain('CREATE TABLE "auth_dump_stage"."users" ("id" text, "email" text);');
    expect(sql).toContain('COPY "auth_dump_stage"."users"');
    expect(sql).not.toContain('COPY "auth"');
    expect(() => buildAuthStageSql([{ table: "u;drop", columns: ["id"], rowLines: [] }])).toThrow();
  });
  it("extracts the trigger from the repo migration", () => {
    expect(extractTriggerSql("x\ncreate trigger on_auth_user_created\n after insert on auth.users\n for each row execute function f();\n")).toMatch(/;$/);
  });
});

describe("restore-local CLI: unsupported options refused (drill D regression)", () => {
  const script = join(process.cwd(), "scripts", "restore-local-backup.mjs");
  for (const url of [
    "postgresql://postgres:x@db.abcdefgh.supabase.co:5432/postgres",
    "postgresql://u:p@localhost:5432/db?host=evil.example.com",
    "postgresql://u:p@localhost:5432/db?hostaddr=1.2.3.4",
  ]) {
    it(`--url ${url.slice(0, 30)}... exits 1 before any Docker use`, () => {
      const r = spawnSync(process.execPath, [script, "restore", tmpdir(), "--url", url], { encoding: "utf8" });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("restore refused");
      expect(r.stdout).not.toContain("container started");
    });
  }
});

describe("restore-local: slice E review fixes", () => {
  const good = { backupComplete: true, validations: [{ name: "x", ok: true }], authBlockCount: 26, authPopulated: [] as string[] };
  it("parseCount: psql failure / non-integer => NaN, never 0", () => {
    expect(parseCount({ ok: false, out: "" })).toBeNaN();
    expect(parseCount({ ok: false, out: "5" })).toBeNaN();
    expect(parseCount({ ok: true, out: "" })).toBeNaN();
    expect(parseCount({ ok: true, out: "abc" })).toBeNaN();
    expect(parseCount({ ok: true, out: "1.5" })).toBeNaN();
    expect(parseCount({ ok: true, out: " 42 " })).toBe(42);
    expect(parseCount({ ok: true, out: "0" })).toBe(0);
  });
  it("makeCounter with a failing psql seam yields NaN (so zero-row / orphan checks cannot pass)", () => {
    const num = makeCounter(() => ({ ok: false, code: 1, out: "" }));
    const got = num("select count(*) from t");
    expect(got).toBeNaN();
    expect(Number.isFinite(got) && got === 0).toBe(false); // zero-row comparison
    expect(Number.isFinite(got) && got === 0).toBe(false); // orphan check: NaN total is not 0
    expect(0 + got + 0).toBeNaN();
  });
  it("NaN publicUsers / stagedAuthUsers => FAIL exit 1", () => {
    for (const extra of [{ publicUsers: NaN }, { stagedAuthUsers: NaN }, { publicUsers: NaN, stagedAuthUsers: NaN }, { publicUsers: Infinity }]) {
      const r = classifyResult({ ...good, ...extra });
      expect([r.level, r.exit]).toEqual(["FAIL", 1]);
    }
  });
  it("DOCKER_CONTEXT non-default / DOCKER_HOST remote refused; local ok", () => {
    expect(() => assertSafeDockerEnv({ DOCKER_CONTEXT: "remote-prod" })).toThrow(/DOCKER_CONTEXT/);
    expect(() => assertSafeDockerEnv({ DOCKER_HOST: "tcp://1.2.3.4:2375" })).toThrow(/DOCKER_HOST/);
    expect(() => assertSafeDockerEnv({ DOCKER_CONTEXT: "default", DOCKER_HOST: "npipe:////./pipe/docker_engine" })).not.toThrow();
    expect(() => assertSafeRunOptions({ env: { DOCKER_CONTEXT: "x" }, name: "unlock-restore-abc" })).toThrow();
    expect(sanitizedEnv({ DOCKER_CONTEXT: "x", PATH: "p" })).toEqual({ PATH: "p" });
  });
  it("active docker context endpoint must be local pipe/socket", () => {
    expect(() => assertLocalDockerEndpoint("npipe:////./pipe/dockerDesktopLinuxEngine")).not.toThrow();
    expect(() => assertLocalDockerEndpoint("unix:///var/run/docker.sock")).not.toThrow();
    expect(() => assertLocalDockerEndpoint("tcp://10.0.0.1:2376")).toThrow();
    expect(() => assertLocalDockerEndpoint("ssh://user@host")).toThrow();
    expect(() => assertLocalDockerEndpoint("")).toThrow();
  });
  it.each(["C:/b,ackup", 'C:/b"ackup', "C:/a,target=/etc", "C:/a\nb"])("rejects mount-breaking backup dir %j", (backupDir) => {
    expect(() => assertSafeRunOptions({ env: {}, name: "unlock-restore-abc", backupDir })).toThrow(/backup dir/);
  });
  it("accepts an ordinary backup dir path", () => {
    expect(() => assertSafeRunOptions({ env: {}, name: "unlock-restore-abc", backupDir: "C:/Users/x/UNLOCK-backups/pre-QA 2026-1" })).not.toThrow();
  });
  const script = join(process.cwd(), "scripts", "restore-local-backup.mjs");
  it.each(["--keep=x", "--image=supabase/postgres:1", "--publish=127.0.0.1:55432:5432"])("CLI refuses %s form before Docker", (flag) => {
    const r = spawnSync(process.execPath, [script, "restore", tmpdir(), flag], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("unsupported option");
    expect(r.stdout).not.toContain("container started");
  });
  it("CLI refuses non-default DOCKER_CONTEXT / remote DOCKER_HOST even in validate mode", () => {
    for (const env of [{ DOCKER_CONTEXT: "remote" }, { DOCKER_HOST: "tcp://1.2.3.4:2375" }]) {
      const r = spawnSync(process.execPath, [script, "validate", tmpdir()], { encoding: "utf8", env: { ...process.env, ...env } });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("restore refused");
    }
  });
});

describe("restore-local: validate mode on synthetic fixtures", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
  const expect2 = { publicTables: 1, authTables: 2 };
  const END = "-- PostgreSQL database dump complete\n";
  const schema = 'CREATE TABLE public.users (id uuid);\nCREATE FUNCTION public.handle_new_auth_user() ...;\n';
  const pub = `SET session_replication_role = replica;\nCOPY "public"."users" ("id") FROM stdin;\n1\n2\n\\.\n${END}`;
  const auth =
    `SET session_replication_role = replica;\n` +
    `COPY "auth"."users" ("id") FROM stdin;\n1\n\\.\nCOPY "auth"."instances" ("id") FROM stdin;\n\\.\n` +
    `COPY "supabase_migrations"."schema_migrations" ("version", "statements", "name") FROM stdin;\n1\t{}\tn\n\\.\n${END}`;
  function make(files: Record<string, string>) {
    const d = mkdtempSync(join(tmpdir(), "unlock-fixture-"));
    dirs.push(d);
    for (const [k, v] of Object.entries(files)) writeFileSync(join(d, k), v);
    return d;
  }
  const full = { "01-schema.sql": schema, "02-data-public.sql": pub, "03-data-auth-migrations.sql": auth };

  it("complete fixture passes with counts", () => {
    const r = validateBackupDir(make(full), expect2);
    expect(r.problems).toEqual([]);
    expect(r.summary.publicCounts).toEqual({ users: 2 });
    expect(r.summary.authPopulated).toEqual(["users"]);
    expect(r.summary.migrationRows).toBe(1);
    expect(r.notes.join(" ")).toContain("trigger on_auth_user_created absent");
  });
  it("truncated file fails", () => {
    const r = validateBackupDir(make({ ...full, "03-data-auth-migrations.sql": auth.slice(0, auth.indexOf("supabase_migrations") - 20) }), expect2);
    expect(r.ok).toBe(false);
  });
  it("missing and empty files fail", () => {
    expect(validateBackupDir(make({ "01-schema.sql": schema, "02-data-public.sql": pub }), expect2).problems).toContain("missing file 03-data-auth-migrations.sql");
    expect(validateBackupDir(make({ ...full, "02-data-public.sql": "" }), expect2).problems).toContain("empty file 02-data-public.sql");
  });
  it("wrong block counts fail", () => {
    expect(validateBackupDir(make(full), { publicTables: 12, authTables: 26 }).ok).toBe(false);
  });
});
