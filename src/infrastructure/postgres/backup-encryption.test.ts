/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed manifest fixtures for negative tests */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { decryptFile, decryptPackage, encryptFile, encryptPackage, readKeyFile } from "../../../scripts/lib/backup-crypto.mjs";
import { validatePackage } from "../../../scripts/lib/backup-package.mjs";

const REPO = process.cwd();
const script = (n: string) => join(REPO, "scripts", n);
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const dirs: string[] = [];
const mk = () => {
  const d = mkdtempSync(join(tmpdir(), "unlock-enc-test-"));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const PLAIN = {
  "10-full.dump": randomBytes(300), // several chunks at the small test chunk size
  "20-roles.sql": Buffer.from("CREATE ROLE anon;\n"),
  "30-server-info.txt": Buffer.from("server_version|17\n"),
};

/** Synthetic plaintext package (no PII, random bytes) + a key file in a SEPARATE temp dir. */
function fixture() {
  const pkg = join(mk(), "daily-20260101-000000");
  mkdirSync(pkg);
  const artifacts = Object.entries(PLAIN).map(([file, buf]) => {
    writeFileSync(join(pkg, file), buf);
    return { file, sha256: sha(buf), bytes: buf.length };
  });
  const manifest = { schema_version: 1, label: "daily", created_at: "2026-01-01T00:00:00.000Z", retention: { class: "daily", days: 30 }, artifacts, encryption: { status: "NONE_UNENCRYPTED_LOCAL" }, completeness: { level: "PARTIAL", reasons: ["row-counts-unavailable"] } };
  writeFileSync(join(pkg, "MANIFEST.json"), JSON.stringify(manifest, null, 2));
  const keyDir = mk();
  const keyFile = join(keyDir, "backup.key");
  const kg = spawnSync(process.execPath, [script("backup-encrypt.mjs"), "keygen", "--key-file", keyFile], { encoding: "utf8" });
  expect(kg.status).toBe(0);
  return { pkg, keyFile, keyDir, keyHex: readFileSync(keyFile, "utf8").trim() };
}
const enc = (a: string[]) => spawnSync(process.execPath, [script("backup-encrypt.mjs"), ...a], { encoding: "utf8" });
const dec = (a: string[]) => spawnSync(process.execPath, [script("backup-decrypt.mjs"), ...a], { encoding: "utf8" });

function encrypted(chunkSize = 32) {
  const f = fixture();
  const out = join(mk(), "enc");
  encryptPackage({ srcDir: f.pkg, outDir: out, keyFile: f.keyFile, repoRoot: REPO, chunkSize });
  return { ...f, out };
}
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e: any) {
    return e.code as string;
  }
  return "NO_ERROR";
};

describe("round trip", () => {
  it("encrypts then decrypts to byte-identical artifacts; manifest records ENCRYPTED + hashes", () => {
    const f = encrypted();
    const m = JSON.parse(readFileSync(join(f.out, "MANIFEST.json"), "utf8"));
    expect(m.encryption.status).toBe("ENCRYPTED");
    expect(m.encryption.algorithm).toBe("AES-256-GCM-CHUNKED");
    expect(m.encryption.format_version).toBe(1);
    expect(m.encryption.key_id).toMatch(/^[0-9a-f]{16}$/);
    expect(m.artifacts.every((a: any) => /^[0-9a-f]{64}$/.test(a.sha256))).toBe(true); // plaintext hashes kept
    expect(m.encryption.artifacts.every((a: any) => /^[0-9a-f]{64}$/.test(a.encrypted_sha256))).toBe(true);
    expect(readdirSync(f.out).sort()).toEqual(["10-full.dump.enc", "20-roles.sql.enc", "30-server-info.txt.enc", "MANIFEST.json"]);
    const o = join(mk(), "plain");
    decryptPackage({ encDir: f.out, outDir: o, keyFile: f.keyFile, repoRoot: REPO });
    for (const [name, buf] of Object.entries(PLAIN)) expect(readFileSync(join(o, name)).equals(buf)).toBe(true);
    const dm = JSON.parse(readFileSync(join(o, "MANIFEST.json"), "utf8"));
    expect(dm.encryption.status).toBe("NONE_UNENCRYPTED_LOCAL");
  });

  it("works through the CLIs with default chunk size, and the decrypted package validates like the original", async () => {
    const f = fixture();
    const out = join(mk(), "enc");
    const e = enc([f.pkg, "--key-file", f.keyFile, "--out", out]);
    expect(e.status, e.stderr).toBe(0);
    expect(e.stdout).toContain("RESULT: ENCRYPTED");
    const o = join(mk(), "plain");
    const d = dec([out, "--key-file", f.keyFile, "--out", o]);
    expect(d.status, d.stderr).toBe(0);
    const v = await validatePackage(o);
    expect(v.problems).toEqual([]); // plaintext integrity intact (PARTIAL only because TOC is not read here)
  });

  it("handles an empty artifact and an exact-multiple-of-chunk artifact", () => {
    const d = mk();
    const key = randomBytes(32);
    for (const len of [0, 32, 64]) {
      const src = join(d, `s${len}`);
      writeFileSync(src, randomBytes(len));
      const r = encryptFile(key, src, join(d, `e${len}`), "20-roles.sql", 32);
      const back = decryptFile(key, join(d, `e${len}`), join(d, `p${len}`), "20-roles.sql");
      expect(back.plaintext_sha256).toBe(r.plaintext_sha256);
      expect(readFileSync(join(d, `p${len}`)).equals(readFileSync(src))).toBe(true);
    }
  });
});

describe("fail closed", () => {
  it("wrong key fails (and leaves no output)", () => {
    const f = encrypted();
    const other = join(mk(), "other.key");
    writeFileSync(other, randomBytes(32).toString("hex"));
    const o = join(mk(), "plain");
    expect(code(() => decryptPackage({ encDir: f.out, outDir: o, keyFile: other, repoRoot: REPO }))).toBe("WRONG_KEY");
    expect(existsSync(o)).toBe(false);
  });

  it("tampered ciphertext fails with no plaintext left behind", () => {
    const f = encrypted();
    const p = join(f.out, "10-full.dump.enc");
    const b = readFileSync(p);
    b[b.length - 40] ^= 0x01;
    writeFileSync(p, b);
    const o = join(mk(), "plain");
    // size is unchanged so only the AEAD tag (or sha) can catch it
    expect(["DECRYPT_AUTH_FAILED"]).toContain(code(() => decryptPackage({ encDir: f.out, outDir: o, keyFile: f.keyFile, repoRoot: REPO })));
    expect(existsSync(o)).toBe(false);
  });

  const reRecord = (file: string, fn: (head: Buffer, recs: Buffer[]) => Buffer) => {
    const f = encrypted();
    const p = join(f.out, file);
    const b = readFileSync(p);
    const rec = 12 + 4 + 32 + 16;
    const recs: Buffer[] = [];
    for (let i = 36; i < b.length; i += rec) recs.push(b.subarray(i, Math.min(i + rec, b.length)));
    writeFileSync(p, fn(b.subarray(0, 36), recs));
    return f;
  };
  const decryptFileOnly = (f: ReturnType<typeof encrypted>) =>
    code(() => decryptFile(readKeyFile(f.keyFile), join(f.out, "10-full.dump.enc"), null, "10-full.dump"));

  it("truncation at a record boundary fails (final-chunk flag)", () => {
    const f = reRecord("10-full.dump.enc", (h, r) => Buffer.concat([h, ...r.slice(0, -1)]));
    expect(decryptFileOnly(f)).toBe("DECRYPT_AUTH_FAILED");
  });
  it("truncation mid-record fails", () => {
    const f = reRecord("10-full.dump.enc", (h, r) => Buffer.concat([h, ...r.slice(0, -1), r[r.length - 1].subarray(0, 10)]));
    expect(decryptFileOnly(f)).toBe("TRUNCATED_CIPHERTEXT");
  });
  it("dropped middle chunk fails", () => {
    const f = reRecord("10-full.dump.enc", (h, r) => Buffer.concat([h, r[0], ...r.slice(2)]));
    expect(decryptFileOnly(f)).toBe("DECRYPT_AUTH_FAILED");
  });
  it("reordered chunks fail", () => {
    const f = reRecord("10-full.dump.enc", (h, r) => Buffer.concat([h, r[1], r[0], ...r.slice(2)]));
    expect(decryptFileOnly(f)).toBe("DECRYPT_AUTH_FAILED");
  });
  it("appended data fails", () => {
    const f = reRecord("10-full.dump.enc", (h, r) => Buffer.concat([h, ...r, r[0]]));
    expect(decryptFileOnly(f)).toBe("DECRYPT_AUTH_FAILED");
  });

  it("wrong format version fails closed", () => {
    const f = encrypted();
    const p = join(f.out, "20-roles.sql.enc");
    const b = readFileSync(p);
    b[7] = "9".charCodeAt(0); // UBKENC01 -> UBKENC09
    writeFileSync(p, b);
    expect(code(() => decryptFile(readKeyFile(f.keyFile), p, null, "20-roles.sql"))).toBe("FORMAT_VERSION_UNSUPPORTED");
    const m = JSON.parse(readFileSync(join(f.out, "MANIFEST.json"), "utf8"));
    m.encryption.format_version = 2;
    writeFileSync(join(f.out, "MANIFEST.json"), JSON.stringify(m));
    expect(code(() => decryptPackage({ encDir: f.out, outDir: join(mk(), "o"), keyFile: f.keyFile, repoRoot: REPO }))).toBe("FORMAT_VERSION_UNSUPPORTED");
  });

  it("tampered manifest (readable, but key-bound by MAC) fails decrypt", () => {
    const f = encrypted();
    const mp = join(f.out, "MANIFEST.json");
    const m = JSON.parse(readFileSync(mp, "utf8"));
    m.label = "monthly";
    writeFileSync(mp, JSON.stringify(m));
    expect(code(() => decryptPackage({ encDir: f.out, outDir: join(mk(), "o"), keyFile: f.keyFile, repoRoot: REPO }))).toBe("MANIFEST_TAMPERED");
  });

  it("swapping two artifact ciphertexts fails (artifact name is authenticated)", () => {
    const f = encrypted();
    const a = join(f.out, "20-roles.sql.enc");
    const b = join(f.out, "30-server-info.txt.enc");
    const ba = readFileSync(a);
    writeFileSync(a, readFileSync(b));
    writeFileSync(b, ba);
    expect(code(() => decryptPackage({ encDir: f.out, outDir: join(mk(), "o"), keyFile: f.keyFile, repoRoot: REPO }))).toBe("DECRYPT_AUTH_FAILED");
  });

  it("missing encrypted artifact fails; invalid key file fails", () => {
    const f = encrypted();
    rmSync(join(f.out, "20-roles.sql.enc"));
    expect(code(() => decryptPackage({ encDir: f.out, outDir: join(mk(), "o"), keyFile: f.keyFile, repoRoot: REPO }))).not.toBe("NO_ERROR");
    const bad = join(mk(), "bad.key");
    writeFileSync(bad, "not a key");
    expect(code(() => readKeyFile(bad))).toBe("KEY_FILE_INVALID");
  });
});

describe("path guards", () => {
  it("rejects a key inside the backup dir", () => {
    const f = fixture();
    const inside = join(f.pkg, "k.key");
    writeFileSync(inside, randomBytes(32).toString("hex"));
    const r = enc([f.pkg, "--key-file", inside, "--out", join(mk(), "enc")]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("code=KEY_INSIDE_BACKUP_DIR");
  });
  it("rejects a key inside the output dir", () => {
    const f = fixture();
    const out = join(mk(), "enc");
    mkdirSync(out);
    const inside = join(out, "k.key");
    writeFileSync(inside, randomBytes(32).toString("hex"));
    // an output dir that already holds a key is also non-empty; either refusal is fail-closed
    const r = enc([f.pkg, "--key-file", inside, "--out", out]);
    expect(r.status).toBe(1);
  });
  it("rejects a key inside the repo (encrypt, decrypt and keygen)", () => {
    const f = fixture();
    const inRepo = join(REPO, "scratch-test-never-created.key");
    expect(enc([f.pkg, "--key-file", inRepo, "--out", join(mk(), "enc")]).stderr).toContain("code=KEY_INSIDE_REPO");
    expect(enc(["keygen", "--key-file", inRepo]).stderr).toContain("code=KEY_INSIDE_REPO");
    expect(existsSync(inRepo)).toBe(false);
    const e = encrypted();
    expect(dec([e.out, "--key-file", inRepo, "--out", join(mk(), "p")]).stderr).toContain("code=KEY_INSIDE_REPO");
  });
  it("keygen never overwrites an existing key", () => {
    const f = fixture();
    const before = readFileSync(f.keyFile, "utf8");
    const r = enc(["keygen", "--key-file", f.keyFile]);
    expect(r.status).toBe(1);
    expect(readFileSync(f.keyFile, "utf8")).toBe(before);
  });
  it("rejects an output inside the repo (encrypt and decrypt) and creates nothing", () => {
    const f = fixture();
    const out = join(REPO, "enc-out-never-created");
    expect(enc([f.pkg, "--key-file", f.keyFile, "--out", out]).stderr).toContain("code=OUTPUT_INSIDE_REPO");
    expect(existsSync(out)).toBe(false);
    const e = encrypted();
    expect(dec([e.out, "--key-file", f.keyFile, "--out", out]).stderr).toContain("code=OUTPUT_INSIDE_REPO");
    expect(existsSync(out)).toBe(false);
  });
  it("refuses a non-empty output dir and decrypt into the encrypted dir itself", () => {
    const e = encrypted();
    expect(dec([e.out, "--key-file", e.keyFile, "--out", e.out]).status).toBe(1);
    expect(dec([e.out, "--key-file", e.keyFile, "--out", join(e.out, "sub")]).stderr).toContain("code=OUTPUT_INSIDE_SOURCE");
  });
});

describe("secrecy", () => {
  it("key material never appears in stdout/stderr/manifest/ciphertext (success and failures)", () => {
    const f = fixture();
    const out = join(mk(), "enc");
    const outs: string[] = [];
    const ok = enc([f.pkg, "--key-file", f.keyFile, "--out", out]);
    outs.push(ok.stdout, ok.stderr);
    const wrong = join(mk(), "w.key");
    writeFileSync(wrong, randomBytes(32).toString("hex"));
    for (const k of [wrong, f.keyFile]) {
      const d = dec([out, "--key-file", k, "--out", join(mk(), "p")]);
      outs.push(d.stdout, d.stderr);
    }
    const inside = enc([f.pkg, "--key-file", join(f.pkg, "x.key"), "--out", join(mk(), "e2")]);
    outs.push(inside.stdout, inside.stderr);
    const raw = Buffer.from(f.keyHex, "hex");
    const hay = [...outs.map((s) => Buffer.from(s)), readFileSync(join(out, "MANIFEST.json")), ...readdirSync(out).map((n) => readFileSync(join(out, n)))];
    for (const h of hay) {
      expect(h.includes(f.keyHex)).toBe(false);
      expect(h.includes(raw)).toBe(false);
    }
  });
});

describe("plaintext removal", () => {
  it("keeps plaintext by default and removes it only with --remove-plaintext", () => {
    const f = fixture();
    const e1 = enc([f.pkg, "--key-file", f.keyFile, "--out", join(mk(), "e1")]);
    expect(e1.status).toBe(0);
    expect(e1.stdout).toContain("plaintext source still present");
    expect(existsSync(join(f.pkg, "10-full.dump"))).toBe(true);
    const e2 = enc([f.pkg, "--key-file", f.keyFile, "--out", join(mk(), "e2"), "--remove-plaintext"]);
    expect(e2.status).toBe(0);
    expect(existsSync(join(f.pkg, "10-full.dump"))).toBe(false);
  });
  it("does not remove plaintext when encryption fails", () => {
    const f = fixture();
    writeFileSync(join(f.pkg, "20-roles.sql"), "tampered after manifest");
    const r = enc([f.pkg, "--key-file", f.keyFile, "--out", join(mk(), "e"), "--remove-plaintext"]);
    expect(r.status).toBe(1);
    expect(existsSync(join(f.pkg, "10-full.dump"))).toBe(true);
  });
});

describe("validate / restore on an encrypted package", () => {
  it("validate verifies ciphertext without the key and never claims FULL_CANDIDATE", async () => {
    const f = encrypted();
    const r = await validatePackage(f.out);
    expect(r.encrypted).toBe(true);
    expect(r.level).toBe("PARTIAL");
    expect(r.exit).toBe(2);
    expect(r.reasons).toContain("encrypted-requires-decrypt-for-toc");
    const cli = spawnSync(process.execPath, [script("backup-validate.mjs"), f.out], { encoding: "utf8" });
    expect(cli.status).toBe(2);
    expect(cli.stdout).toContain("RESULT: PARTIAL");
    expect(cli.stdout).not.toContain("FULL_CANDIDATE\n");
  });
  it("validate flags tampered / truncated / missing ciphertext as INVALID", async () => {
    const f = encrypted();
    const p = join(f.out, "30-server-info.txt.enc");
    const b = readFileSync(p);
    writeFileSync(p, b.subarray(0, b.length - 5));
    expect((await validatePackage(f.out)).problems).toContain("truncated");
    b[40] ^= 1;
    writeFileSync(p, b);
    expect((await validatePackage(f.out)).problems).toContain("hash-mismatch");
    rmSync(p);
    expect((await validatePackage(f.out)).problems).toContain("missing");
  });
  it("restore:local refuses an encrypted package", () => {
    const f = encrypted();
    const r = spawnSync(process.execPath, [script("restore-local-backup.mjs"), "validate", f.out], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("encrypted at rest");
  });
});

describe("retention report is read-only", () => {
  it("lists expired candidates by class and deletes nothing", () => {
    const root = mk();
    const mkPkg = (name: string, label: string, created: string, retention: any) => {
      mkdirSync(join(root, name));
      writeFileSync(join(root, name, "MANIFEST.json"), JSON.stringify({ label, created_at: created, retention }));
      writeFileSync(join(root, name, "10-full.dump"), "x");
    };
    mkPkg("daily-old", "daily", "2026-01-01T00:00:00Z", {});
    mkPkg("daily-new", "daily", "2026-09-20T00:00:00Z", {});
    mkPkg("pre-release-old", "pre-release", "2026-05-01T00:00:00Z", {});
    mkPkg("monthly-ok", "monthly", "2026-01-01T00:00:00Z", {});
    mkdirSync(join(root, "junk"));
    writeFileSync(join(root, "junk", "MANIFEST.json"), "{nope");
    const before = readdirSync(root).sort();
    const r = spawnSync(process.execPath, [script("backup-retention.mjs"), root, "--now", "2026-10-04T00:00:00Z"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("EXPIRED-CANDIDATE daily-old");
    expect(r.stdout).toContain("EXPIRED-CANDIDATE pre-release-old");
    expect(r.stdout).toContain("keep daily-new");
    expect(r.stdout).toContain("keep monthly-ok");
    expect(r.stdout).toContain("UNKNOWN junk");
    expect(r.stdout).toContain("expired_candidates=2");
    expect(readdirSync(root).sort()).toEqual(before);
    expect(existsSync(join(root, "daily-old", "10-full.dump"))).toBe(true);
  });
});

describe("repo hygiene", () => {
  it("encrypted artifacts and key files are git-ignored", () => {
    for (const probe of ["a/10-full.dump.enc", "x/20-roles.sql.enc", "backup.key", "k/master.keyfile"]) {
      expect(spawnSync("git", ["check-ignore", "-q", probe], { cwd: REPO }).status, probe).toBe(0);
    }
    const ls = spawnSync("git", ["ls-files"], { encoding: "utf8", cwd: REPO });
    expect(ls.stdout.split("\n").filter((x) => /\.(enc|key|keyfile)$/.test(x))).toEqual([]);
  });
});
