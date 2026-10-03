/**
 * Hosted-isolation guard for the opt-in real-PG suite. Pure; no I/O.
 *
 * pg-connection-string copies query params (host=, hostaddr=, service=, ...) over
 * the parsed config, so a hostname-only check is bypassable. This guard parses
 * strictly, refuses ANY query string, and returns explicit connection pieces so
 * the caller builds the pg config itself (never the raw string).
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface LocalPgTarget {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function assertLocalPgUrl(
  raw: string,
  env: Record<string, string | undefined> = process.env,
): LocalPgTarget {
  const fail = (why: string): never => {
    throw new Error(`UNLOCK_REAL_PG_URL refused: ${why} (local Postgres only: localhost/127.0.0.1/::1).`);
  };
  // PGHOST/PGPORT are harmless (explicit host/port are always passed); these can redirect.
  for (const k of ["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE"]) {
    if (env[k]) fail(`${k} is set in the environment`);
  }
  if (!raw || raw.includes(",")) fail("empty value or multi-host list");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return fail("not a parseable URL");
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") fail("protocol must be postgres:/postgresql:");
  if (u.search !== "" || u.searchParams.size > 0 || raw.includes("?")) fail("query parameters are not allowed");
  if (u.hash !== "") fail("fragment is not allowed");
  if (!u.hostname || !LOCAL_HOSTS.has(u.hostname)) fail("host is not local");
  // Ambiguous userinfo (extra raw "@" before the host) is refused outright.
  if ((raw.split("/")[2] ?? "").split("@").length > 2) fail("ambiguous userinfo");
  const user = decodeURIComponent(u.username);
  if (user.includes("@") || user.includes("/")) fail("suspicious userinfo");
  const port = u.port ? Number(u.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail("invalid port");
  const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres";
  return {
    host: u.hostname === "[::1]" ? "::1" : u.hostname,
    port,
    user,
    password: decodeURIComponent(u.password),
    database,
  };
}
