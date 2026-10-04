/**
 * Docker helpers for Backup Procedure V1 (create/validate). Local Docker daemon only; images are never pulled.
 * Child stderr is never forwarded (it can quote connection details).
 */
import { spawnSync } from "node:child_process";
import { dirname, basename } from "node:path";
import { DEFAULT_IMAGE, assertLocalDockerEndpoint, assertSafeDockerEnv, sanitizedEnv } from "./restore-local.mjs";
import { BackupError } from "./backup-package.mjs";

export { DEFAULT_IMAGE };
export const IMAGE_RE = /^(public\.ecr\.aws\/)?supabase\/postgres:[A-Za-z0-9._-]+$/;
export const imageMajor = (image) => Number(/:(\d+)\./.exec(image)?.[1] ?? NaN);

/** Docker daemon must be the local pipe/socket (the source URL is handed to the daemon via env). */
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

/** `pg_restore -l` of a dump file inside a network-less container with a read-only mount. Returns the TOC text. */
export function readTocViaDocker(dumpPath, image = DEFAULT_IMAGE, env = process.env) {
  const dir = dirname(dumpPath);
  if (/[,"\r\n\0]/.test(dir)) throw new Error("unsafe path");
  const r = spawnSync(
    "docker",
    ["run", "--rm", "--pull", "never", "--network", "none", "--mount", `type=bind,source=${dir},target=/in,readonly`, image, "pg_restore", "-l", `/in/${basename(dumpPath)}`],
    { encoding: "utf8", env: sanitizedEnv(env), maxBuffer: 512 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error("pg_restore -l failed");
  return r.stdout;
}
