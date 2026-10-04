#!/usr/bin/env node
/**
 * Backup Procedure V1: validate a backup package directory (read-only).
 *
 *   npm run backup:validate -- <backup-dir> [--no-toc] [--image <supabase/postgres tag>]
 *
 * Needs no database. Docker (local, network-less, image never pulled) is used only for `pg_restore -l`;
 * without it (--no-toc) the package can never be FULL_CANDIDATE.
 * An ENCRYPTED package dir (Slice D) is checked key-less (ciphertext sha256/size) and is at best PARTIAL
 * (reason encrypted-requires-decrypt-for-toc): decrypt with backup:decrypt for the TOC/plaintext check.
 * Exit: 0 FULL_CANDIDATE, 2 PARTIAL, 1 INVALID. Codes: missing truncated corrupt hash-mismatch
 * wrong-manifest-version incomplete-migration-metadata missing-auth-artifact (+ roles-missing,
 * server-info-missing, toc-unverified, trigger-missing, row-counts-unavailable, manifest-claim-mismatch).
 */
import { resolve } from "node:path";
import { assertDockerLocal, assertImageLocal, DEFAULT_IMAGE, IMAGE_RE, readTocViaDocker } from "./lib/backup-docker.mjs";
import { validatePackage } from "./lib/backup-package.mjs";
import { isEncryptedPackageDir } from "./lib/backup-crypto.mjs";

const out = (s = "") => process.stdout.write(s + "\n");
const args = process.argv.slice(2);
const dirArg = args[0] && !args[0].startsWith("--") ? args[0] : null;
const rest = args.slice(1);
let image = DEFAULT_IMAGE;
let noToc = false;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--no-toc") noToc = true;
  else if (rest[i] === "--image" && rest[i + 1]) image = rest[++i];
  else {
    console.error(`backup-validate refused: unsupported argument ${rest[i].startsWith("--") ? rest[i].split("=")[0] : "(positional)"}`);
    process.exit(1);
  }
}
if (!dirArg || !IMAGE_RE.test(image)) {
  console.error("usage: backup-validate.mjs <backup-dir> [--no-toc] [--image <supabase/postgres tag>]");
  process.exit(1);
}

let readToc = null;
if (!noToc && !isEncryptedPackageDir(resolve(dirArg))) {
  try {
    assertDockerLocal(process.env);
    assertImageLocal(image);
    readToc = (p) => readTocViaDocker(p, image);
  } catch (e) {
    out(`note: TOC verification unavailable (${e.code ?? "docker"}); package cannot be FULL_CANDIDATE`);
  }
}

const r = await validatePackage(resolve(dirArg), { readToc });
for (const n of r.notes) out(`note: ${n}`);
for (const p of r.problems) out(`problem: ${p}`);
for (const c of r.reasons) out(`reason: ${c}`);
const safe = (v, re) => (typeof v === "string" && re.test(v) ? v : "?");
if (r.manifest) out(`manifest: schema_version=${Number.isInteger(r.manifest.schema_version) ? r.manifest.schema_version : "?"} label=${safe(r.manifest.label, /^[a-z-]{1,20}$/)} created_at=${safe(r.manifest.created_at, /^[0-9TZ:.-]{1,30}$/)}`);
if (r.encrypted) out("encryption: ENCRYPTED at rest (ciphertext verified without the key; completeness needs backup:decrypt; never FULL_CANDIDATE here)");
out(`RESULT: ${r.level}`);
process.exit(r.exit);
