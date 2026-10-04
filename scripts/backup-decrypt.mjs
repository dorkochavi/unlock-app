#!/usr/bin/env node
/**
 * Backup Procedure V1 Slice D: decrypt an encrypted package into a FRESH temp dir outside the repo so that
 * backup:validate and restore:local work unchanged.
 *   npm run backup:decrypt -- <enc-dir> --key-file <path> --out <new dir outside repo>
 * The output is plaintext PII: delete it after the drill (Remove-Item -Recurse -Force <out>). Fails closed on a wrong key,
 * tampered/truncated/reordered ciphertext, wrong format version, key inside the backup/output dir or repo.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BackupError } from "./lib/backup-package.mjs";
import { decryptPackage } from "./lib/backup-crypto.mjs";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
let dir = null;
let keyFile = null;
let outDir = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--key-file" && args[i + 1]) keyFile = args[++i];
  else if (a === "--out" && args[i + 1]) outDir = args[++i];
  else if (!a.startsWith("--") && !dir) dir = a;
  else {
    console.error(`backup-decrypt refused: unsupported argument ${a.startsWith("--") ? a.split("=")[0] : "(positional)"}`);
    process.exit(1);
  }
}
if (!dir || !keyFile || !outDir) {
  console.error("usage: backup-decrypt.mjs <enc-dir> --key-file <path> --out <new dir outside repo>");
  process.exit(1);
}
try {
  const r = decryptPackage({ encDir: resolve(dir), outDir: resolve(outDir), keyFile: resolve(keyFile), repoRoot: REPO });
  process.stdout.write(`decrypted ${r.artifacts} artifacts; hashes and manifest MAC verified\n`);
  process.stdout.write("WARNING: the output directory holds plaintext PII; delete it after use (Remove-Item -Recurse -Force <out>)\nRESULT: DECRYPTED\n");
} catch (e) {
  const detail = e instanceof BackupError && e.message.includes(": ") ? " " + e.message.split(": ").slice(1).join(": ") : "";
  console.error(`backup-decrypt refused: code=${e instanceof BackupError ? e.code : "FAILED"}${detail}`);
  process.exit(1);
}
