/**
 * SERVER-ONLY. Resolves the `pg.Pool` connection string + TLS settings from
 * environment configuration, portably across local development and hosted
 * runtimes (Vercel) — without ever weakening certificate verification.
 *
 * ## Why this exists (root cause of the Vercel `ENOENT` failure)
 *
 * `pg` parses `sslrootcert=<path>` inside `DATABASE_URL` and reads that file
 * synchronously at pool construction. A `DATABASE_URL` copied from a
 * developer machine therefore made the Vercel runtime try to open a local
 * Windows path. A CA *file path* is not portable; CA *contents* are.
 *
 * ## Behavior
 *
 * TLS-related query parameters (`sslmode`, `sslrootcert`, `ssl`, ...) are
 * stripped from the connection string and interpreted here, so a stale
 * `sslrootcert` path can never trigger an implicit file read.
 *
 * CA material, first match wins:
 *  1. `DATABASE_SSL_CA` — PEM CONTENTS (hosted/Vercel). A single line with
 *     literal `\n` sequences is accepted. When present, no file is read.
 *  2. `DATABASE_SSL_CA_FILE` — path to a PEM file (local development).
 *  3. `sslrootcert=` in `DATABASE_URL` — path (the previous local setup).
 *  4. none — Node's system trust store.
 *
 * TLS is always verified: `rejectUnauthorized` is always `true` and Node's
 * default hostname check stays on. There is no code path here that disables
 * verification; `sslmode=no-verify` (which `pg` maps to
 * `rejectUnauthorized: false`) is rejected. TLS is mandatory for any
 * non-local database host; `ssl` is off only for a local host with no
 * `sslmode` (e.g. a local Docker Postgres) or an explicit `sslmode=disable`
 * on a local host.
 *
 * Invalid/unreadable CA material throws `PgSslConfigError` (fail closed).
 * Errors never contain CA contents, and never contain the connection string.
 */
import { readFileSync } from "node:fs";

import { parse } from "pg-connection-string";

export class PgSslConfigError extends Error {
  constructor(message: string) {
    super(`Invalid PostgreSQL TLS configuration: ${message}`);
    this.name = "PgSslConfigError";
  }
}

export interface PoolConnectionSettings {
  /** `DATABASE_URL` with every TLS-related query parameter removed. */
  connectionString: string;
  ssl: false | { ca?: string; rejectUnauthorized: true };
}

export interface PgSslEnv {
  DATABASE_URL?: string;
  DATABASE_SSL_CA?: string;
  DATABASE_SSL_CA_FILE?: string;
}

const TLS_PARAMS = new Set(["sslmode", "sslrootcert", "sslcert", "sslkey", "sslnegotiation", "uselibpqcompat", "ssl"]);
const VERIFYING_MODES = new Set(["require", "prefer", "allow", "verify-ca", "verify-full"]);
const PEM_CERT = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;
// Every C0 control character, space, and DEL (0x00-0x20 and 0x7f), spelled out.
const CONTROL_OR_SPACE = new RegExp("[\\x00-\\x20\\x7f]");
const SCHEME = /^postgres(?:ql)?:\/\//i;

/**
 * Locality is decided from the host `pg` will ACTUALLY use (its own parser,
 * so a `?host=` override, case, or a trailing-dot form cannot disagree with
 * us). An empty/missing host is NOT local (pg could fall back to PGHOST).
 */
function isLocalHost(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function validatePem(pem: string, source: string): string {
  if (!PEM_CERT.test(pem)) {
    throw new PgSslConfigError(`${source} does not contain a PEM certificate (-----BEGIN CERTIFICATE-----)`);
  }
  return pem;
}

function readCaFile(path: string, source: string, readFile: (path: string) => string): string {
  let contents: string;
  try {
    contents = readFile(path);
  } catch {
    throw new PgSslConfigError(
      `could not read the CA file from ${source}. On hosted runtimes a local file path is not available — ` +
        `set DATABASE_SSL_CA to the PEM contents instead`,
    );
  }
  return validatePem(normalizePem(contents), source);
}

/** Decodes one raw `key=value` query part exactly as URLSearchParams (what pg uses) would; never throws. */
function decodePart(part: string): { key: string; value: string } {
  const [entry] = [...new URLSearchParams(part).entries()];
  return entry === undefined ? { key: "", value: "" } : { key: entry[0], value: entry[1] };
}

export function resolvePoolConnectionSettings(
  env: PgSslEnv,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): PoolConnectionSettings {
  const raw = env.DATABASE_URL;
  if (!raw) {
    throw new PgSslConfigError("DATABASE_URL is not set");
  }
  // Fail closed on anything a URL parser might silently normalize (raw
  // TAB/CR/LF are deleted by `new URL`, which would let a mangled TLS key
  // slip past the strip loop below while pg still honors it).
  if (CONTROL_OR_SPACE.test(raw)) {
    throw new PgSslConfigError("DATABASE_URL must not contain whitespace or control characters");
  }
  if (!SCHEME.test(raw)) {
    throw new PgSslConfigError("DATABASE_URL must start with postgres:// or postgresql://");
  }

  const queryIndex = raw.indexOf("?");
  const base = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : raw.slice(queryIndex + 1);

  const kept: string[] = [];
  const tls: Record<string, string> = {};
  for (const part of query.split("&").filter((entry) => entry.length > 0)) {
    const { key, value } = decodePart(part);
    if (TLS_PARAMS.has(key)) {
      tls[key] = value;
    } else {
      kept.push(part);
    }
  }
  const connectionString = kept.length > 0 ? `${base}?${kept.join("&")}` : base;

  // Defense in depth: run pg's OWN parser on what we will hand to pg and
  // require that it derives no TLS setting at all. If pg's parser and our
  // strip loop ever disagree, fail closed instead of letting pg's parsed
  // `ssl` (which overrides our explicit option) win.
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(connectionString);
  } catch {
    throw new PgSslConfigError("DATABASE_URL could not be parsed");
  }
  const parsedRecord = parsed as unknown as Record<string, unknown>;
  for (const key of TLS_PARAMS) {
    if (parsedRecord[key] !== undefined) {
      throw new PgSslConfigError("DATABASE_URL contains a TLS setting that could not be safely interpreted");
    }
  }

  if (tls.sslcert !== undefined || tls.sslkey !== undefined) {
    throw new PgSslConfigError("client certificates (sslcert/sslkey) are not supported");
  }

  let mode = tls.sslmode;
  if (tls.ssl !== undefined) {
    if (tls.ssl === "true" || tls.ssl === "1") mode = mode ?? "require";
    else if (tls.ssl === "false" || tls.ssl === "0") mode = mode ?? "disable";
    else throw new PgSslConfigError("unsupported ssl parameter value");
  }
  if (mode === "no-verify") {
    throw new PgSslConfigError("sslmode=no-verify disables certificate verification and is not allowed");
  }
  if (mode !== undefined && mode !== "disable" && !VERIFYING_MODES.has(mode)) {
    throw new PgSslConfigError("unsupported sslmode value");
  }

  const local = isLocalHost(parsed.host);
  if (mode === "disable") {
    if (!local) {
      throw new PgSslConfigError("sslmode=disable is only allowed for a local database host");
    }
    return { connectionString, ssl: false };
  }
  if (mode === undefined && local) {
    return { connectionString, ssl: false };
  }

  // TLS is required from here on (explicit mode, or a non-local host).
  let ca: string | undefined;
  if (env.DATABASE_SSL_CA !== undefined && env.DATABASE_SSL_CA.trim() !== "") {
    ca = validatePem(normalizePem(env.DATABASE_SSL_CA), "DATABASE_SSL_CA");
  } else if (env.DATABASE_SSL_CA_FILE !== undefined && env.DATABASE_SSL_CA_FILE.trim() !== "") {
    ca = readCaFile(env.DATABASE_SSL_CA_FILE, "DATABASE_SSL_CA_FILE", readFile);
  } else if (tls.sslrootcert) {
    ca = readCaFile(tls.sslrootcert, "the sslrootcert parameter of DATABASE_URL", readFile);
  }

  return { connectionString, ssl: ca === undefined ? { rejectUnauthorized: true } : { ca, rejectUnauthorized: true } };
}
