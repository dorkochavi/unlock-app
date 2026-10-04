/**
 * Backup Procedure V1, Slice D: at-rest encryption of a backup package (Node built-in crypto only, no install).
 * Output policy: stable codes only; key material, passphrases and plaintext are never printed or put in errors.
 *
 * FORMAT "UBKENC01" (one .enc file per artifact; documented in docs/BACKUP_DR_POLICY.md "Storage and encryption"):
 *   header (36 bytes) = magic "UBKENC01"(8) | chunk_size u32be(4) | key_id(8) | file_salt(16)
 *   then records:        nonce(12, random per chunk) | ct_len u32be(4) | ciphertext(ct_len) | gcm_tag(16)
 *   cipher: AES-256-GCM. File key = HKDF-SHA256(master key, salt=file_salt, info "unlock-backup/file-enc/v1").
 *   AAD per record = header | name_len u8 | logical artifact name | chunk_index u64be | final_flag u8.
 *   The final flag is derived by the reader from "no bytes follow" and must match what the writer authenticated, so
 *   truncation, dropped/reordered chunks, appended data and swapping a file between artifact names all fail closed.
 * Master key: 32 random bytes in a key file (raw 32 bytes or 64 hex chars). key_id and the manifest MAC key are
 * HKDF-derived (non-secret fingerprint / separate subkey). The manifest stays readable and is bound by HMAC-SHA256.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import {
  BackupError, ENC_ALGORITHM, ENC_EXT, ENC_FORMAT_VERSION, MANIFEST_FILE, PACKAGE_ARTIFACTS, assertOutputOutsideRepo, isInsideOrEqual, realpathLoose,
} from "./backup-package.mjs";

export { ENC_ALGORITHM, ENC_EXT, ENC_FORMAT_VERSION };
export const DEFAULT_CHUNK = 4 * 1024 * 1024;
const MIN_CHUNK = 16;
const MAX_CHUNK = 64 * 1024 * 1024;
const MAGIC = Buffer.from("UBKENC01");
const HEADER_LEN = 36;
const NONCE = 12;
const TAG = 16;

const hkdf = (master, salt, info, len) => Buffer.from(hkdfSync("sha256", master, salt, info, len));
export const keyIdOf = (master) => hkdf(master, Buffer.alloc(0), "unlock-backup/key-id/v1", 8);
const macKeyOf = (master) => hkdf(master, Buffer.alloc(0), "unlock-backup/manifest-mac/v1", 32);

// ---------------------------------------------------------------- key handling
/** Fresh 32-byte key as 64 hex chars, written exclusively (never overwrites), outside repo. Returns key_id only. */
export function generateKeyFile(keyPath, repoRoot) {
  assertKeyPlacement(keyPath, [], repoRoot);
  const key = randomBytes(32);
  try {
    writeFileSync(keyPath, key.toString("hex") + "\n", { flag: "wx", mode: 0o600 });
  } catch {
    throw new BackupError("KEY_FILE_WRITE_FAILED", "key file exists or is not writable (never overwritten)");
  }
  return keyIdOf(key).toString("hex");
}

/** Key file must resolve outside the repo and outside every given backup/output dir. */
export function assertKeyPlacement(keyPath, dirs, repoRoot) {
  if (typeof keyPath !== "string" || keyPath.length === 0) throw new BackupError("KEY_FILE_REQUIRED", "--key-file is required");
  const real = realpathLoose(keyPath);
  if (isInsideOrEqual(real, realpathLoose(repoRoot))) throw new BackupError("KEY_INSIDE_REPO", "key file must live outside the repository");
  for (const d of dirs) if (isInsideOrEqual(real, realpathLoose(d))) throw new BackupError("KEY_INSIDE_BACKUP_DIR", "key file must not live inside the backup directory");
  return real;
}

export function readKeyFile(keyPath) {
  let raw;
  try {
    if (!statSync(keyPath).isFile()) throw new Error("x");
    raw = readFileSync(keyPath);
  } catch {
    throw new BackupError("KEY_FILE_UNREADABLE", "key file missing or unreadable");
  }
  if (raw.length === 32) return raw;
  const t = raw.toString("utf8").trim();
  if (/^[0-9a-fA-F]{64}$/.test(t)) return Buffer.from(t, "hex");
  throw new BackupError("KEY_FILE_INVALID", "key must be 32 raw bytes or 64 hex characters");
}

// ---------------------------------------------------------------- io helpers
function readFull(fd, size, pos) {
  const buf = Buffer.alloc(size);
  let got = 0;
  while (got < size) {
    const n = readSync(fd, buf, got, size - got, pos + got);
    if (n === 0) break;
    got += n;
  }
  return got === size ? buf : buf.subarray(0, got);
}
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
function aadFor(header, name, index, final) {
  const nb = Buffer.from(name, "utf8");
  const idx = Buffer.alloc(8);
  idx.writeBigUInt64BE(BigInt(index));
  return Buffer.concat([header, Buffer.from([nb.length]), nb, idx, Buffer.from([final ? 1 : 0])]);
}
const checkName = (name) => {
  if (!PACKAGE_ARTIFACTS.includes(name)) throw new BackupError("ARTIFACT_NAME_INVALID", "unexpected artifact name");
};

// ---------------------------------------------------------------- file encrypt / decrypt
/** Encrypt src -> dst (streamed in chunks). Returns plaintext + ciphertext sha256/bytes. */
export function encryptFile(master, src, dst, name, chunkSize = DEFAULT_CHUNK) {
  checkName(name);
  if (!Number.isInteger(chunkSize) || chunkSize < MIN_CHUNK || chunkSize > MAX_CHUNK) throw new BackupError("CHUNK_SIZE_INVALID");
  const salt = randomBytes(16);
  const header = Buffer.concat([MAGIC, u32(chunkSize), keyIdOf(master), salt]);
  const fileKey = hkdf(master, salt, "unlock-backup/file-enc/v1", 32);
  const inFd = openSync(src, "r");
  let outFd;
  const plain = createHash("sha256");
  const enc = createHash("sha256");
  let plainBytes = 0;
  let encBytes = 0;
  try {
    outFd = openSync(dst, "wx", 0o600); // exclusive + owner-only; NTFS relies on the directory ACLs instead of mode bits
    const put = (b) => {
      writeSync(outFd, b);
      enc.update(b);
      encBytes += b.length;
    };
    put(header);
    let pos = 0;
    let cur = readFull(inFd, chunkSize, pos);
    pos += cur.length;
    for (let index = 0; ; index++) {
      const next = cur.length === chunkSize ? readFull(inFd, chunkSize, pos) : Buffer.alloc(0);
      pos += next.length;
      const final = next.length === 0;
      const nonce = randomBytes(NONCE);
      const c = createCipheriv("aes-256-gcm", fileKey, nonce);
      c.setAAD(aadFor(header, name, index, final));
      const ct = Buffer.concat([c.update(cur), c.final()]);
      plain.update(cur);
      plainBytes += cur.length;
      put(Buffer.concat([nonce, u32(ct.length), ct, c.getAuthTag()]));
      if (final) break;
      cur = next;
    }
    fsyncSync(outFd);
  } catch (e) {
    // Only remove a file THIS call created: if openSync "wx" lost the race (EEXIST) outFd is undefined and dst belongs to someone else.
    if (outFd !== undefined) {
      closeSync(outFd);
      outFd = undefined;
      rmSync(dst, { force: true });
    }
    throw e instanceof BackupError ? e : new BackupError("ENCRYPT_FAILED", "could not encrypt artifact");
  } finally {
    closeSync(inFd);
    if (outFd !== undefined) closeSync(outFd);
  }
  return { plaintext_sha256: plain.digest("hex"), plaintext_bytes: plainBytes, encrypted_sha256: enc.digest("hex"), encrypted_bytes: encBytes };
}

/**
 * Decrypt+authenticate src. If dst is null the plaintext is only verified (hashed). Throws a BackupError code on any
 * failure (WRONG_KEY, NOT_ENCRYPTED_BACKUP, FORMAT_VERSION_UNSUPPORTED, TRUNCATED_CIPHERTEXT, DECRYPT_AUTH_FAILED, ...);
 * a partial dst is removed.
 */
export function decryptFile(master, src, dst, name) {
  checkName(name);
  const size = statSync(src).size;
  const fd = openSync(src, "r");
  let outFd;
  const plain = createHash("sha256");
  let plainBytes = 0;
  try {
    const header = readFull(fd, HEADER_LEN, 0);
    if (header.length < HEADER_LEN || !header.subarray(0, 6).equals(MAGIC.subarray(0, 6))) throw new BackupError("NOT_ENCRYPTED_BACKUP", "not an UNLOCK encrypted artifact");
    if (!header.subarray(0, 8).equals(MAGIC)) throw new BackupError("FORMAT_VERSION_UNSUPPORTED", "unsupported encrypted format version");
    const chunkSize = header.readUInt32BE(8);
    if (chunkSize < MIN_CHUNK || chunkSize > MAX_CHUNK) throw new BackupError("DECRYPT_AUTH_FAILED", "invalid header");
    if (!timingSafeEqual(header.subarray(12, 20), keyIdOf(master))) throw new BackupError("WRONG_KEY", "key does not match this backup");
    const fileKey = hkdf(master, header.subarray(20, 36), "unlock-backup/file-enc/v1", 32);
    if (dst) outFd = openSync(dst, "wx", 0o600);
    let pos = HEADER_LEN;
    for (let index = 0; ; index++) {
      if (pos + NONCE + 4 + TAG > size) throw new BackupError("TRUNCATED_CIPHERTEXT", "ciphertext ends early");
      const head = readFull(fd, NONCE + 4, pos);
      const ctLen = head.readUInt32BE(NONCE);
      if (ctLen > chunkSize) throw new BackupError("DECRYPT_AUTH_FAILED", "invalid record");
      const total = NONCE + 4 + ctLen + TAG;
      if (pos + total > size) throw new BackupError("TRUNCATED_CIPHERTEXT", "ciphertext ends early");
      const body = readFull(fd, ctLen + TAG, pos + NONCE + 4);
      const final = pos + total === size;
      const d = createDecipheriv("aes-256-gcm", fileKey, head.subarray(0, NONCE));
      d.setAAD(aadFor(header, name, index, final));
      d.setAuthTag(body.subarray(ctLen));
      let pt;
      try {
        pt = Buffer.concat([d.update(body.subarray(0, ctLen)), d.final()]);
      } catch {
        throw new BackupError("DECRYPT_AUTH_FAILED", "authentication failed (tampered, truncated, reordered or wrong key)");
      }
      plain.update(pt);
      plainBytes += pt.length;
      if (outFd !== undefined) writeSync(outFd, pt);
      pos += total;
      if (final) break;
    }
    if (outFd !== undefined) fsyncSync(outFd);
  } catch (e) {
    if (outFd !== undefined) {
      closeSync(outFd);
      outFd = undefined;
      rmSync(dst, { force: true });
    }
    throw e instanceof BackupError ? e : new BackupError("DECRYPT_FAILED", "could not read encrypted artifact");
  } finally {
    closeSync(fd);
    if (outFd !== undefined) closeSync(outFd);
  }
  return { plaintext_sha256: plain.digest("hex"), plaintext_bytes: plainBytes };
}

// ---------------------------------------------------------------- manifest binding
const canonical = (m) => {
  const { manifest_hmac_sha256: _omit, ...enc } = m.encryption ?? {};
  void _omit;
  return JSON.stringify({ ...m, encryption: enc });
};
export const manifestMac = (master, m) => createHmac("sha256", macKeyOf(master)).update(canonical(m)).digest("hex");

export function verifyManifestMac(master, m) {
  const got = String(m?.encryption?.manifest_hmac_sha256 ?? "");
  if (!/^[0-9a-f]{64}$/.test(got) || !timingSafeEqual(Buffer.from(got), Buffer.from(manifestMac(master, m)))) {
    throw new BackupError("MANIFEST_TAMPERED", "manifest does not match its key-bound MAC");
  }
}

function readManifest(dir) {
  try {
    const m = JSON.parse(readFileSync(join(dir, MANIFEST_FILE), "utf8"));
    if (typeof m !== "object" || m === null || Array.isArray(m)) throw new Error("shape");
    return m;
  } catch {
    throw new BackupError("MANIFEST_INVALID", "MANIFEST.json missing or not valid JSON");
  }
}

export function isEncryptedPackageDir(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, MANIFEST_FILE), "utf8"))?.encryption?.status === "ENCRYPTED";
  } catch {
    return false;
  }
}

function assertFreshOutDir(out, srcDir, repoRoot) {
  const real = assertOutputOutsideRepo(out, repoRoot);
  if (isInsideOrEqual(real, realpathLoose(srcDir))) throw new BackupError("OUTPUT_INSIDE_SOURCE", "output must not be the source directory or inside it");
  if (existsSync(real) && (!statSync(real).isDirectory() || readdirSync(real).length > 0)) throw new BackupError("OUTPUT_NOT_EMPTY", "output directory must not exist or be empty");
  return real;
}

// ---------------------------------------------------------------- package encrypt / decrypt
/**
 * Encrypt a plaintext package directory into outDir. Plaintext must match its manifest (fail closed).
 * Plaintext is removed only when removePlaintext === true, and only after the ciphertext re-verifies.
 * Removal is a plain unlink (NOT a secure erase on SSD/NTFS/snapshots; see docs).
 */
export function encryptPackage({ srcDir, outDir, keyFile, repoRoot, removePlaintext = false, chunkSize = DEFAULT_CHUNK }) {
  const src = assertOutputOutsideRepo(srcDir, repoRoot);
  const out = assertFreshOutDir(outDir, src, repoRoot);
  assertKeyPlacement(keyFile, [src, out], repoRoot);
  const master = readKeyFile(keyFile);
  const m = readManifest(src);
  if (m.encryption?.status === "ENCRYPTED") throw new BackupError("ALREADY_ENCRYPTED", "source package is already encrypted");
  const listed = Array.isArray(m.artifacts) ? m.artifacts : [];
  if (listed.length === 0 || listed.some((a) => !PACKAGE_ARTIFACTS.includes(a?.file))) throw new BackupError("MANIFEST_INVALID", "manifest artifact list is empty or unexpected");
  for (const a of listed) {
    const p = join(src, a.file);
    if (!existsSync(p) || !statSync(p).isFile()) throw new BackupError("ARTIFACT_MISSING", `${a.file} missing`);
  }
  const madeDir = !existsSync(out);
  mkdirSync(out, { recursive: true, mode: 0o700 });
  const created = [];
  try {
    const encArtifacts = [];
    for (const a of [...listed].sort((x, y) => (x.file < y.file ? -1 : 1))) {
      const dst = join(out, a.file + ENC_EXT);
      const r = encryptFile(master, join(src, a.file), dst, a.file, chunkSize);
      created.push(dst);
      if (r.plaintext_sha256 !== a.sha256 || r.plaintext_bytes !== a.bytes) throw new BackupError("PLAINTEXT_HASH_MISMATCH", `${a.file} differs from manifest`);
      encArtifacts.push({ file: a.file, encrypted_file: a.file + ENC_EXT, encrypted_sha256: r.encrypted_sha256, encrypted_bytes: r.encrypted_bytes });
    }
    const body = {
      ...m,
      encryption: { status: "ENCRYPTED", algorithm: ENC_ALGORITHM, format_version: ENC_FORMAT_VERSION, key_id: keyIdOf(master).toString("hex"), chunk_size: chunkSize, artifacts: encArtifacts },
    };
    body.encryption.manifest_hmac_sha256 = manifestMac(master, body);
    writeFileSync(join(out, MANIFEST_FILE), JSON.stringify(body, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    created.push(join(out, MANIFEST_FILE));
    // re-verify the ciphertext (authenticates every chunk) before anything is allowed to delete plaintext
    for (const e of encArtifacts) {
      const v = decryptFile(master, join(out, e.encrypted_file), null, e.file);
      if (v.plaintext_sha256 !== listed.find((x) => x.file === e.file).sha256) throw new BackupError("ENCRYPT_VERIFY_FAILED", `${e.file} did not round-trip`);
    }
  } catch (e) {
    for (const f of created) rmSync(f, { force: true });
    if (madeDir) rmSync(out, { recursive: true, force: true });
    throw e;
  }
  let removed = false;
  if (removePlaintext === true) {
    for (const a of listed) unlinkSync(join(src, a.file));
    unlinkSync(join(src, MANIFEST_FILE)); // plaintext manifest copy goes too so no half-package remains
    if (readdirSync(src).length === 0) rmSync(src, { force: true, recursive: true });
    removed = true;
  }
  return { outDir: out, keyId: keyIdOf(master).toString("hex"), artifacts: listed.length, plaintextRemoved: removed };
}

/** Decrypt+authenticate an encrypted package into a fresh dir outside the repo; manifest restored to plaintext form. */
export function decryptPackage({ encDir, outDir, keyFile, repoRoot }) {
  const src = realpathLoose(encDir);
  const out = assertFreshOutDir(outDir, src, repoRoot);
  assertKeyPlacement(keyFile, [src, out], repoRoot);
  const master = readKeyFile(keyFile);
  const m = readManifest(src);
  const e = m.encryption;
  if (e?.status !== "ENCRYPTED") throw new BackupError("NOT_ENCRYPTED_BACKUP", "manifest does not describe an encrypted package");
  if (e.format_version !== ENC_FORMAT_VERSION || e.algorithm !== ENC_ALGORITHM) throw new BackupError("FORMAT_VERSION_UNSUPPORTED", "unsupported encryption format/algorithm");
  if (e.key_id !== keyIdOf(master).toString("hex")) throw new BackupError("WRONG_KEY", "key does not match this backup");
  verifyManifestMac(master, m);
  const entries = Array.isArray(e.artifacts) ? e.artifacts : [];
  const listed = Array.isArray(m.artifacts) ? m.artifacts : [];
  if (entries.length === 0 || entries.length !== listed.length) throw new BackupError("MANIFEST_INVALID", "encrypted artifact list does not match artifacts");
  const created = [];
  const madeDir = !existsSync(out);
  mkdirSync(out, { recursive: true, mode: 0o700 });
  try {
    for (const en of entries) {
      checkName(en.file);
      const a = listed.find((x) => x?.file === en.file);
      if (!a || en.encrypted_file !== en.file + ENC_EXT) throw new BackupError("MANIFEST_INVALID", "artifact entry mismatch");
      const dst = join(out, en.file);
      const r = decryptFile(master, join(src, en.encrypted_file), dst, en.file);
      created.push(dst);
      if (r.plaintext_sha256 !== a.sha256 || r.plaintext_bytes !== a.bytes) throw new BackupError("PLAINTEXT_HASH_MISMATCH", `${en.file} differs from manifest`);
    }
    writeFileSync(join(out, MANIFEST_FILE), JSON.stringify({ ...m, encryption: { status: "NONE_UNENCRYPTED_LOCAL" } }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  } catch (err) {
    for (const f of created) rmSync(f, { force: true });
    if (madeDir) rmSync(out, { recursive: true, force: true });
    throw err;
  }
  return { outDir: out, artifacts: entries.length };
}
