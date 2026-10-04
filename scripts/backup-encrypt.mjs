#!/usr/bin/env node
/**
 * Backup Procedure V1 Slice D: encrypt a plaintext backup package at rest (AES-256-GCM, Node crypto).
 *   npm run backup:keygen -- --key-file <path outside repo>        (creates a new key; never overwrites; prints key_id only)
 *   npm run backup:encrypt -- <backup-dir> --key-file <path> [--out <dir>] [--remove-plaintext]
 * Plaintext is removed ONLY with --remove-plaintext, after the ciphertext re-verifies (plain unlink, not a secure erase).
 * Output: codes, counts and the non-secret key_id only. Exit 0 ok, 1 refused/failed (stable code= on stderr).
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BackupError } from "./lib/backup-package.mjs";
import { encryptPackage, generateKeyFile } from "./lib/backup-crypto.mjs";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = (s = "") => process.stdout.write(s + "\n");
const fail = (e) => {
  const detail = e instanceof BackupError && e.message.includes(": ") ? " " + e.message.split(": ").slice(1).join(": ") : "";
  console.error(`backup-encrypt refused: code=${e instanceof BackupError ? e.code : "FAILED"}${detail}`);
  process.exit(1);
};
const args = process.argv.slice(2);
const sub = args[0] === "keygen" ? args.shift() : null;
let dir = null;
let keyFile = null;
let outDir = null;
let removePlaintext = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--key-file" && args[i + 1]) keyFile = args[++i];
  else if (a === "--out" && args[i + 1] && !sub) outDir = args[++i];
  else if (a === "--remove-plaintext" && !sub) removePlaintext = true;
  else if (!a.startsWith("--") && !dir && !sub) dir = a;
  else {
    console.error(`backup-encrypt refused: unsupported argument ${a.startsWith("--") ? a.split("=")[0] : "(positional)"}`);
    process.exit(1);
  }
}
try {
  if (sub === "keygen") {
    if (!keyFile) throw new BackupError("KEY_FILE_REQUIRED", "--key-file is required");
    out(`key created; key_id=${generateKeyFile(resolve(keyFile), REPO)}`);
    out("Store a copy of this key file in SEPARATE offline custody. Losing it makes every backup encrypted with it unrecoverable.");
    process.exit(0);
  }
  if (!dir || !keyFile) {
    console.error("usage: backup-encrypt.mjs <backup-dir> --key-file <path> [--out <dir>] [--remove-plaintext]");
    process.exit(1);
  }
  const src = resolve(dir);
  const r = encryptPackage({ srcDir: src, outDir: resolve(outDir ?? src.replace(/[\\/]+$/, "") + "-enc"), keyFile: resolve(keyFile), repoRoot: REPO, removePlaintext });
  out(`encrypted ${r.artifacts} artifacts; key_id=${r.keyId}; ciphertext re-verified`);
  out(r.plaintextRemoved ? "plaintext source removed (unlink; not a secure erase)" : "note: plaintext source still present; remove it yourself or re-run with --remove-plaintext");
  out("RESULT: ENCRYPTED");
} catch (e) {
  fail(e);
}
