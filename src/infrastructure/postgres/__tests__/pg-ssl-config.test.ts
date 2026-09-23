import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { PgSslConfigError, resolvePoolConnectionSettings } from "../pg-ssl-config";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIBfakefakefakefake\n-----END CERTIFICATE-----";
const HOSTED = "postgresql://postgres.ref:s3cret-pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
const STALE_WINDOWS_PATH = "C%3A%5CUsers%5Cdorko%5CGit%5CUnlock%5Cunlock-app%5Csupabase-ca.crt";

const neverRead = () => {
  throw new Error("file must not be read");
};

describe("local CA-file configuration", () => {
  it("DATABASE_SSL_CA_FILE: reads the file and verifies against it", () => {
    const readFile = vi.fn(() => PEM);
    const result = resolvePoolConnectionSettings(
      { DATABASE_URL: `${HOSTED}?sslmode=verify-full`, DATABASE_SSL_CA_FILE: "/local/ca.crt" },
      readFile,
    );
    expect(readFile).toHaveBeenCalledWith("/local/ca.crt");
    expect(result.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(result.connectionString).toBe(HOSTED);
  });

  it("previous local setup: sslrootcert in DATABASE_URL is read by us and stripped from the string given to pg", () => {
    const readFile = vi.fn(() => PEM);
    const result = resolvePoolConnectionSettings(
      { DATABASE_URL: `${HOSTED}?sslmode=verify-full&sslrootcert=${STALE_WINDOWS_PATH}` },
      readFile,
    );
    expect(readFile).toHaveBeenCalledWith("C:\\Users\\dorko\\Git\\Unlock\\unlock-app\\supabase-ca.crt");
    expect(result.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(result.connectionString).toBe(HOSTED);
    expect(result.connectionString).not.toMatch(/ssl/i);
  });
});

describe("hosted CA-content configuration", () => {
  it("DATABASE_SSL_CA contents are used", () => {
    const result = resolvePoolConnectionSettings({ DATABASE_URL: HOSTED, DATABASE_SSL_CA: PEM }, neverRead);
    expect(result.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("REGRESSION: a stale local sslrootcert path in DATABASE_URL is never read when DATABASE_SSL_CA is set", () => {
    const result = resolvePoolConnectionSettings(
      {
        DATABASE_URL: `${HOSTED}?sslmode=verify-full&sslrootcert=${STALE_WINDOWS_PATH}`,
        DATABASE_SSL_CA: PEM,
      },
      neverRead,
    );
    expect(result.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(result.connectionString).toBe(HOSTED);
  });

  it("accepts a single-line value with literal \\n sequences (env-var friendly)", () => {
    const oneLine = PEM.replace(/\n/g, "\\n");
    const result = resolvePoolConnectionSettings({ DATABASE_URL: HOSTED, DATABASE_SSL_CA: oneLine }, neverRead);
    expect(result.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("DATABASE_SSL_CA takes precedence over DATABASE_SSL_CA_FILE", () => {
    const result = resolvePoolConnectionSettings(
      { DATABASE_URL: HOSTED, DATABASE_SSL_CA: PEM, DATABASE_SSL_CA_FILE: "/x" },
      neverRead,
    );
    expect(result.ssl).toMatchObject({ ca: PEM });
  });

  it("preserves non-TLS query parameters", () => {
    const result = resolvePoolConnectionSettings(
      { DATABASE_URL: `${HOSTED}?application_name=unlock&sslmode=require`, DATABASE_SSL_CA: PEM },
      neverRead,
    );
    expect(result.connectionString).toBe(`${HOSTED}?application_name=unlock`);
  });

  it("a non-local host with no sslmode still requires verified TLS (system trust store)", () => {
    const result = resolvePoolConnectionSettings({ DATABASE_URL: HOSTED }, neverRead);
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });
});

describe("missing/invalid TLS configuration fails safely", () => {
  it("stale sslrootcert path with no DATABASE_SSL_CA: clear error, no path/password/CA leaked", () => {
    const readFile = () => {
      throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    };
    let thrown: unknown;
    try {
      resolvePoolConnectionSettings(
        { DATABASE_URL: `${HOSTED}?sslmode=verify-full&sslrootcert=${STALE_WINDOWS_PATH}` },
        readFile,
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PgSslConfigError);
    const message = (thrown as Error).message;
    expect(message).toMatch(/DATABASE_SSL_CA/);
    expect(message).not.toMatch(/s3cret-pw|dorko|BEGIN CERTIFICATE/);
  });

  it("unreadable DATABASE_SSL_CA_FILE fails closed", () => {
    expect(() =>
      resolvePoolConnectionSettings({ DATABASE_URL: HOSTED, DATABASE_SSL_CA_FILE: "/nope" }, () => {
        throw new Error("ENOENT");
      }),
    ).toThrow(PgSslConfigError);
  });

  it("non-PEM DATABASE_SSL_CA fails closed without echoing its value", () => {
    let thrown: unknown;
    try {
      resolvePoolConnectionSettings({ DATABASE_URL: HOSTED, DATABASE_SSL_CA: "not-a-certificate-SECRETISH" }, neverRead);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PgSslConfigError);
    expect((thrown as Error).message).not.toMatch(/SECRETISH/);
  });

  it("file that is not a PEM certificate fails closed", () => {
    expect(() =>
      resolvePoolConnectionSettings({ DATABASE_URL: HOSTED, DATABASE_SSL_CA_FILE: "/x" }, () => "garbage"),
    ).toThrow(PgSslConfigError);
  });

  it("missing DATABASE_URL fails", () => {
    expect(() => resolvePoolConnectionSettings({})).toThrow(PgSslConfigError);
  });

  it.each([
    ["sslmode=no-verify", `${HOSTED}?sslmode=no-verify`],
    ["unknown sslmode", `${HOSTED}?sslmode=bogus`],
    ["client cert", `${HOSTED}?sslcert=/a`],
    ["client key", `${HOSTED}?sslkey=/a`],
    ["sslmode=disable on a non-local host", `${HOSTED}?sslmode=disable`],
  ])("rejects %s", (_label, url) => {
    expect(() => resolvePoolConnectionSettings({ DATABASE_URL: url, DATABASE_SSL_CA: PEM }, neverRead)).toThrow(
      PgSslConfigError,
    );
  });
});

describe("local database without TLS", () => {
  it("localhost with no sslmode: TLS off (local Docker Postgres)", () => {
    expect(resolvePoolConnectionSettings({ DATABASE_URL: "postgres://u:p@localhost:5432/db" }, neverRead).ssl).toBe(false);
  });

  it("127.0.0.1 with explicit sslmode=disable: TLS off", () => {
    expect(
      resolvePoolConnectionSettings({ DATABASE_URL: "postgres://u:p@127.0.0.1:5432/db?sslmode=disable" }, neverRead).ssl,
    ).toBe(false);
  });

  it("localhost with sslmode=verify-full still verifies", () => {
    expect(
      resolvePoolConnectionSettings({ DATABASE_URL: "postgres://u:p@localhost:5432/db?sslmode=verify-full" }, neverRead).ssl,
    ).toEqual({ rejectUnauthorized: true });
  });
});

describe("no path disables certificate verification", () => {
  it("never returns rejectUnauthorized:false for any accepted configuration", () => {
    const urls = [
      HOSTED,
      `${HOSTED}?sslmode=require`,
      `${HOSTED}?sslmode=prefer`,
      `${HOSTED}?sslmode=allow`,
      `${HOSTED}?sslmode=verify-ca`,
      `${HOSTED}?sslmode=verify-full`,
      `${HOSTED}?ssl=true`,
      "postgres://u:p@localhost:5432/db?sslmode=require",
    ];
    for (const url of urls) {
      for (const env of [{}, { DATABASE_SSL_CA: PEM }, { DATABASE_SSL_CA_FILE: "/x" }]) {
        const { ssl } = resolvePoolConnectionSettings({ DATABASE_URL: url, ...env }, () => PEM);
        expect(ssl).not.toBe(false);
        expect((ssl as { rejectUnauthorized: boolean }).rejectUnauthorized).toBe(true);
      }
    }
  });

  it("source scan: no executable rejectUnauthorized:false or no-verify acceptance in the pool/TLS modules", () => {
    for (const file of ["pg-pool.ts", "pg-ssl-config.ts"]) {
      const source = readFileSync(path.join(__dirname, "..", file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(source).not.toMatch(/rejectUnauthorized\s*:\s*false/);
      expect(source).not.toMatch(/NODE_TLS_REJECT_UNAUTHORIZED/);
    }
  });
});

describe("crafted DATABASE_URL values, checked against pg's REAL parameter merge", () => {
  // The exact merge pg performs: parse(connectionString) OVERRIDES the explicit `ssl` option.
  const requireFromHere = createRequire(import.meta.url);
  const ConnectionParameters = requireFromHere("pg/lib/connection-parameters") as new (config: unknown) => {
    ssl: unknown;
    host: string;
  };

  function effective(env: Parameters<typeof resolvePoolConnectionSettings>[0]) {
    const { connectionString, ssl } = resolvePoolConnectionSettings(env, () => PEM);
    return new ConnectionParameters({ connectionString, ssl });
  }

  const remoteOrOddUrls = [
    HOSTED,
    `${HOSTED}?sslmode=verify-full`,
    "postgres://u:p@localhost/db?host=remote.example.com",
    "postgres:///db?host=remote.example.com",
    "postgres://u:p@localhost./db",
    "postgres://u:p@[::1]:5432/db?host=remote.example.com",
    "postgresql://u:p%40x@aws-0.pooler.supabase.com:6543/postgres?application_name=a%ZZb",
  ];

  it.each(remoteOrOddUrls)("%s: TLS verification stays on for the host pg will really use", (url) => {
    const params = effective({ DATABASE_URL: url, DATABASE_SSL_CA: PEM });
    expect(params.ssl).toBeTruthy();
    expect((params.ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized).not.toBe(false);
  });

  it("a ?host= override cannot make a remote host look local and turn TLS off", () => {
    const params = effective({ DATABASE_URL: "postgres://u:p@localhost/db?host=remote.example.com" });
    expect(params.host).toBe("remote.example.com");
    expect(params.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("sslmode=disable cannot be combined with a ?host= override to reach a remote host in plaintext", () => {
    expect(() =>
      resolvePoolConnectionSettings({ DATABASE_URL: "postgres://u:p@LOCALHOST/db?host=remote.example.com&sslmode=disable" }),
    ).toThrow(PgSslConfigError);
  });

  it("an empty host is not treated as local", () => {
    expect(effective({ DATABASE_URL: "postgres:///db" }).ssl).toEqual({ rejectUnauthorized: true });
  });

  it.each([
    "postgres://u:p@h.example.com:5432/db?ssl\nmode=no-verify",
    "postgres://u:p@h.example.com:5432/db?ss\tl=no-verify",
    "postgres://u:p@h.example.com:5432/db?sslmode=verify-full\r",
    "postgres://u:p@h.example.com:5432/db ?sslmode=require",
  ])("rejects control characters/whitespace that pg's URL parser would silently normalize: %j", (url) => {
    expect(() => resolvePoolConnectionSettings({ DATABASE_URL: url, DATABASE_SSL_CA: PEM })).toThrow(PgSslConfigError);
  });

  it.each(["u:p@remote/db", "//u:p@remote/db", "mysql://u:p@remote/db"])("rejects a non-postgres/scheme-less URL: %s", (url) => {
    expect(() => resolvePoolConnectionSettings({ DATABASE_URL: url })).toThrow(PgSslConfigError);
  });

  it.each(["no-verify", "bogus", "0x"])("rejects an unsupported ssl parameter value %s", (value) => {
    expect(() => resolvePoolConnectionSettings({ DATABASE_URL: `${HOSTED}?ssl=${value}`, DATABASE_SSL_CA: PEM })).toThrow(
      PgSslConfigError,
    );
  });

  it("unsupported-mode errors do not echo URL-derived values", () => {
    let thrown: unknown;
    try {
      resolvePoolConnectionSettings({ DATABASE_URL: `${HOSTED}?sslmode=hunter2secret`, DATABASE_SSL_CA: PEM });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).not.toMatch(/hunter2secret/);
  });

  it("malformed percent-escapes do not throw a raw URIError", () => {
    expect(() =>
      resolvePoolConnectionSettings({ DATABASE_URL: `${HOSTED}?application_name=a%ZZ&sslmode=require`, DATABASE_SSL_CA: PEM }),
    ).not.toThrow();
  });
});
