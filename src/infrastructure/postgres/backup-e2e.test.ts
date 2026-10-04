/**
 * Opt-in end-to-end proof of Backup Procedure V1 against a SYNTHETIC local source (non-PII rows).
 * Requires Docker + the local images postgres:17 and public.ecr.aws/supabase/postgres:17.6.1.166
 * (nothing is pulled). Run: UNLOCK_BACKUP_E2E=1 npx vitest run src/infrastructure/postgres/backup-e2e.test.ts
 *
 * TEST-ONLY source path: backup:create refuses local sources unless UNLOCK_BACKUP_TEST_MODE=1 AND
 * --test-local-source <unlock-bkptest-* network> AND the URL host is an unlock-bkptest-* container.
 * This never loosens the hosted rules (hosted mode still refuses loopback/private/single-label hosts).
 * Never contacts hosted systems; removes every container/network it creates.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.UNLOCK_BACKUP_E2E === "1";
const REPO = process.cwd();
const id = randomBytes(4).toString("hex");
const NET = `unlock-bkptest-${id}`;
const SRC = `${NET}-src`;
const CANARY = `Cnry${randomBytes(9).toString("hex")}`;
const URL_ENV = "BKP_TEST_URL";
const sourceUrl = `postgres://postgres:${CANARY}@${SRC}:5432/postgres`;
const tmpDirs: string[] = [];

const docker = (args: string[], input?: string) => spawnSync("docker", args, { encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 });
const srcSql = (sql: string) => docker(["exec", "-i", "-u", "postgres", SRC, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], sql);
const node = (script: string, args: string[]) =>
  spawnSync(process.execPath, [join(REPO, "scripts", script), ...args], {
    encoding: "utf8",
    env: { ...process.env, UNLOCK_BACKUP_TEST_MODE: "1", [URL_ENV]: sourceUrl, SUPA_DB_URL: undefined },
    timeout: 540000,
  });
const create = (label: string, out: string) =>
  node("backup-create.mjs", ["--label", label, "--out", out, "--confirm-read-only-source", "--source-env", URL_ENV, "--test-local-source", NET, "--environment", "synthetic"]);
const noCanary = (r: { stdout: string; stderr: string }) => expect(r.stdout + r.stderr).not.toContain(CANARY);
const dirOf = (out: string) => join(out, readdirSync(out).sort().at(-1) as string);

describe.skipIf(!RUN)("Backup Procedure V1 end to end (synthetic local source)", () => {
  beforeAll(() => {
    expect(docker(["network", "create", NET]).status).toBe(0);
    const r = docker(["run", "-d", "--name", SRC, "--network", NET, "-e", `POSTGRES_PASSWORD=${CANARY}`, "postgres:17"]);
    expect(r.status).toBe(0);
    let ready = 0;
    for (let i = 0; i < 60 && ready < 3; i++) {
      ready = srcSql("select 1").stdout.trim() === "1" ? ready + 1 : 0;
      spawnSync(process.execPath, ["-e", "setTimeout(()=>{},1000)"]);
    }
    expect(ready).toBeGreaterThanOrEqual(3);
    const versions = readdirSync(join(REPO, "supabase", "migrations")).map((f) => /^(\d+)_/.exec(f)?.[1]).filter(Boolean) as string[];
    const sql = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role supabase_auth_admin nologin;
create schema auth authorization supabase_auth_admin;
create table auth.users (id uuid primary key, email text, encrypted_password text);
create table auth.identities (id uuid primary key, user_id uuid references auth.users(id), provider text);
create table auth.schema_migrations (version varchar(255) primary key);
alter table auth.users owner to supabase_auth_admin; alter table auth.identities owner to supabase_auth_admin; alter table auth.schema_migrations owner to supabase_auth_admin;
insert into auth.schema_migrations select '2024' || lpad(g::text, 4, '0') from generate_series(1, 5) g;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ${versions.map((v) => `('${v}', 'm${v}')`).join(",")};
create table public.users (id uuid primary key);
create table public.enrollments (id serial primary key, user_id uuid not null references public.users(id));
create function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = '' as $f$ begin insert into public.users (id) values (new.id) on conflict do nothing; return new; end $f$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();
insert into auth.users select gen_random_uuid(), 'synthetic' || g || '@example.invalid', 'x' from generate_series(1, 3) g;
insert into auth.identities select gen_random_uuid(), id, 'email' from auth.users;
insert into public.users values (gen_random_uuid());
insert into public.enrollments (user_id) select id from public.users limit 2;`;
    const s = srcSql(sql);
    expect(s.status, s.stderr).toBe(0);
  }, 300000);

  afterAll(() => {
    docker(["rm", "-f", "-v", SRC]);
    docker(["network", "rm", NET]);
    tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
  });

  it("create -> validate -> restore: FULL_CANDIDATE, then FULL; no secret in output or manifest", () => {
    const out = mkdtempSync(join(tmpdir(), "unlock-bkp-e2e-"));
    tmpDirs.push(out);
    const c = create("pre-migration", out);
    noCanary(c);
    expect(c.stderr).not.toContain("code=");
    expect(c.status, c.stdout).toBe(0);
    expect(c.stdout).toContain("RESULT: FULL_CANDIDATE");
    const dir = dirOf(out);
    expect(readdirSync(dir).sort()).toEqual(["10-full.dump", "20-roles.sql", "30-server-info.txt", "MANIFEST.json"]);
    const manifestText = readFileSync(join(dir, "MANIFEST.json"), "utf8");
    expect(manifestText).not.toContain(CANARY);
    expect(manifestText).not.toContain(SRC);
    expect(readFileSync(join(dir, "20-roles.sql"), "utf8")).not.toContain(CANARY);
    const m = JSON.parse(manifestText);
    expect(m.completeness).toEqual({ level: "FULL_CANDIDATE", reasons: [] });
    expect(m.retention).toMatchObject({ class: "event", days: 90 });
    expect(m.row_counts.before.auth["auth.users"]).toBe(3);
    expect(m.row_counts.before.public["public.users"]).toBe(4);
    expect(m.migrations.auth.count).toBe(5);
    expect(m.migrations.after).toEqual({ supabase_migrations: m.migrations.supabase_migrations, auth: m.migrations.auth });
    // synthetic: the 3 trigger-created public users have an auth row; 1 manually inserted public user has none (info only, not zero-gated)
    expect(m.relationships).toMatchObject({ public_without_auth: 1, auth_without_public: 0 });

    const v = node("backup-validate.mjs", [dir]);
    noCanary(v);
    expect([v.status, v.stdout.includes("RESULT: FULL_CANDIDATE")]).toEqual([0, true]);

    const r = node("restore-local-backup.mjs", ["restore", dir]);
    noCanary(r);
    expect(r.stdout).toContain("RESULT: FULL");
    expect(r.stdout).not.toMatch(/check FAIL/);
    expect(r.status, r.stdout).toBe(0);
    expect(r.stdout).toContain("containers with prefix unlock-restore- remaining: 0");
    expect(r.stdout).toContain("info public.users=4, auth.users=3");
    expect(r.stdout).toContain("check ok   public.users<->auth.users orphan counts == manifest (1/0)");
    expect(r.stdout).toContain("check ok   manifest table set == restored public+auth table set");
    expect(r.stdout).toContain("FULL = package restored into a real local Auth schema; hosted GoTrue-version equality and sign-in usability are not verified");
  }, 600000);

  it("tampered dump: validate exit 1 hash-mismatch/truncated, restore refuses (FAIL 1)", () => {
    const out = mkdtempSync(join(tmpdir(), "unlock-bkp-e2e-"));
    tmpDirs.push(out);
    expect(create("pre-release", out).status).toBe(0);
    const dir = dirOf(out);
    const dump = readFileSync(join(dir, "10-full.dump"));
    writeFileSync(join(dir, "10-full.dump"), dump.subarray(0, Math.floor(dump.length / 2)));
    const v = node("backup-validate.mjs", [dir]);
    expect(v.status).toBe(1);
    expect(v.stdout).toContain("problem: truncated");
    const r = node("restore-local-backup.mjs", ["restore", dir]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("RESULT: FAIL");
  }, 600000);

  it("empty auth.schema_migrations in the source => PARTIAL package (exit 2), PARTIAL restore (exit 2), never FULL", () => {
    expect(srcSql("delete from auth.schema_migrations").status).toBe(0);
    const out = mkdtempSync(join(tmpdir(), "unlock-bkp-e2e-"));
    tmpDirs.push(out);
    const c = create("daily", out);
    noCanary(c);
    expect(c.status, c.stdout).toBe(2);
    expect(c.stdout).toContain("incomplete-migration-metadata");
    const dir = dirOf(out);
    const v = node("backup-validate.mjs", [dir]);
    expect(v.status).toBe(2);
    const r = node("restore-local-backup.mjs", ["restore", dir]);
    expect(r.stdout).not.toContain("RESULT: FULL");
    expect(r.status, r.stdout).toBe(2);
  }, 600000);
});
