/**
 * Docker helpers for Backup Procedure V1 (create/validate). Local Docker daemon only; images are never pulled.
 * Child stderr is never forwarded (it can quote connection details).
 */
import { spawnSync } from "node:child_process";
import { dirname, basename } from "node:path";
import { DEFAULT_IMAGE, CONTAINER_HARDENING, assertLocalDockerEndpoint, assertSafeDockerEnv, sanitizedEnv } from "./restore-local.mjs";
import { BackupError, assertSafeMountSource } from "./backup-package.mjs";

export { DEFAULT_IMAGE };
export const IMAGE_RE = /^(public\.ecr\.aws\/)?supabase\/postgres:[A-Za-z0-9._-]+$/;
export const imageMajor = (image) => Number(/:(\d+)\./.exec(image)?.[1] ?? NaN);

/**
 * Tool containers (psql/pg_dump/pg_restore -l) never run the postgres entrypoint, so they need no capabilities at all.
 * On POSIX they run as the invoking user so files written to the (0700) bind-mounted output dir are owned by that user
 * and need no DAC_OVERRIDE. On Windows/Docker Desktop the host user mapping is handled by the VM.
 */
export function toolContainerHardening(uid = process.getuid?.(), gid = process.getgid?.()) {
  const user = Number.isInteger(uid) && Number.isInteger(gid) && uid !== 0 ? ["--user", `${uid}:${gid}`] : [];
  return [...CONTAINER_HARDENING, ...user];
}

/**
 * argv for one source-reading container. The source credentials are passed by NAME only (`-e PGPASSWORD`, value comes
 * from the docker client's environment), never as an argv value or a URL. `script` is a fixed shell snippet that
 * relies on the PG* variables (no URL, no password in it).
 */
export function buildSourceRunArgs({ containerName, image, network, targetDir, withInput, withMount, envNames, script, hardening = toolContainerHardening() }) {
  const a = ["run", "--rm", "--pull", "never", "--name", containerName, ...hardening, ...(withInput ? ["-i"] : [])];
  for (const n of envNames) a.push("-e", n);
  if (network) a.push("--network", network);
  if (withMount) a.push("--mount", `type=bind,source=${assertSafeMountSource(targetDir)},target=/out`);
  a.push(image, "sh", "-c", script);
  return a;
}

/** Docker daemon must be the local pipe/socket (the source credentials are handed to the daemon via env). */
export function assertDockerLocal(env = process.env) {
  try {
    assertSafeDockerEnv(env);
    const ctx = spawnSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8", env: sanitizedEnv(env) });
    assertLocalDockerEndpoint(ctx.status === 0 ? ctx.stdout.trim() : "");
  } catch (e) {
    throw new BackupError("DOCKER_UNSAFE", String(e.message).replace(/^restore refused: /, ""));
  }
}

export function assertImageLocal(image, env = process.env) {
  if (!IMAGE_RE.test(image)) throw new BackupError("IMAGE_INVALID", "image must be a supabase/postgres tag");
  if (spawnSync("docker", ["image", "inspect", image], { encoding: "utf8", env: sanitizedEnv(env) }).status !== 0) {
    throw new BackupError("IMAGE_MISSING", "image is not present locally (images are never pulled)");
  }
}

/** argv of `pg_restore -l` of a dump file in a network-less, capability-less container with a read-only mount. */
export function buildTocArgs(dumpPath, image = DEFAULT_IMAGE, hardening = toolContainerHardening()) {
  const dir = assertSafeMountSource(dirname(dumpPath)); // re-check the REAL path, not the string the caller passed
  return ["run", "--rm", "--pull", "never", "--network", "none", ...hardening, "--mount", `type=bind,source=${dir},target=/in,readonly`, image, "pg_restore", "-l", `/in/${basename(dumpPath)}`];
}

/** `pg_restore -l` of a dump file. Returns the TOC text. */
export function readTocViaDocker(dumpPath, image = DEFAULT_IMAGE, env = process.env) {
  const r = spawnSync("docker", buildTocArgs(dumpPath, image), { encoding: "utf8", env: sanitizedEnv(env), maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0) throw new Error("pg_restore -l failed");
  return r.stdout;
}
