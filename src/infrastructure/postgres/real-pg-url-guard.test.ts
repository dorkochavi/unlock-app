/**
 * Default-run unit test (no DB) for the opt-in real-PG suite's hosted-isolation
 * guard. The helper lives beside the opt-in suite; this test sits under src/ so
 * the standard `npm test` executes it.
 */
import { describe, expect, it } from "vitest";

import { assertLocalPgUrl } from "../../../supabase/tests/real-pg/local-pg-url";

describe("assertLocalPgUrl", () => {
  it.each([
    ["postgresql://u:p@localhost:5432/postgres", "localhost"],
    ["postgres://u:p@127.0.0.1:55432/postgres", "127.0.0.1"],
    ["postgresql://u:p@[::1]:5432/postgres", "::1"],
  ])("allows %s", (url, host) => {
    const t = assertLocalPgUrl(url, {});
    expect(t.host).toBe(host);
    expect(t.user).toBe("u");
    expect(t.database).toBe("postgres");
  });

  it("returns explicit pieces (no raw-string/query override surface)", () => {
    expect(assertLocalPgUrl("postgresql://u:p%40x@localhost:6543/db", {})).toEqual({
      host: "localhost",
      port: 6543,
      user: "u",
      password: "p@x",
      database: "db",
    });
  });

  it.each([
    "postgresql://u:p@localhost/postgres?host=db.x.supabase.co",
    "postgresql://u:p@localhost/postgres?hostaddr=1.2.3.4",
    "postgresql://u:p@localhost/postgres?service=prod",
    "postgresql://u:p@localhost/postgres?options=-c%20x%3D1",
    "postgresql://u:p@localhost/postgres?",
    "postgresql://u:p@localhost.evil.com/postgres",
    "postgresql://localhost@evil.com/postgres",
    "postgresql://u:p@evil.com@localhost/postgres",
    "postgresql://u:p@localhost,db.x.supabase.co/postgres",
    "postgresql://u:p@/postgres",
    "postgresql:///postgres",
    "mysql://u:p@localhost/postgres",
    "http://localhost/postgres",
    "postgresql://postgres:p@db.abcdefghijkl.supabase.co:5432/postgres",
    "postgresql://postgres.abcdefghijkl:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    "postgresql://u:p@localhost/postgres#x",
    "not a url",
    "",
  ])("refuses %j", (url) => {
    expect(() => assertLocalPgUrl(url, {})).toThrow(/UNLOCK_REAL_PG_URL refused/);
  });

  it.each(["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE"])("refuses when %s is set", (k) => {
    expect(() => assertLocalPgUrl("postgresql://u:p@localhost/postgres", { [k]: "x" })).toThrow(/refused/);
  });
});
