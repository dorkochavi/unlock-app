#!/usr/bin/env node
/**
 * Backup Procedure V1 Slice D: READ-ONLY retention report. Lists expired-candidate packages under a backups root by
 * manifest retention class + created_at (daily 30d, event 90d, monthly 12 months). It NEVER deletes or modifies anything;
 * the owner decides and deletes by hand (docs/BACKUP_DR_POLICY.md "Retention / cleanup procedure").
 *   npm run backup:retention -- <backups-root> [--now <ISO time>]
 * The policy keeps ONE monthly backup for 12 months; this report only ages by class and cannot tell which single backup
 * per month is the one to keep. Unreadable manifests are reported as UNKNOWN, never as expired.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { retentionFor } from "./lib/backup-package.mjs";

const out = (s) => process.stdout.write(s + "\n");
const args = process.argv.slice(2);
const root = args[0] && !args[0].startsWith("--") ? args[0] : null;
let now = new Date();
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--now" && args[i + 1]) now = new Date(args[++i]);
  else {
    console.error("backup-retention refused: unsupported argument");
    process.exit(1);
  }
}
if (!root || Number.isNaN(now.getTime())) {
  console.error("usage: backup-retention.mjs <backups-root> [--now <ISO time>]");
  process.exit(1);
}
const expiry = (created, ret) => {
  const d = new Date(created);
  if (ret.class === "monthly") d.setUTCMonth(d.getUTCMonth() + ret.months);
  else d.setUTCDate(d.getUTCDate() + ret.days);
  return d;
};
const base = resolve(root);
if (!existsSync(base) || !statSync(base).isDirectory()) {
  console.error("backup-retention refused: root is not a directory");
  process.exit(1);
}
let expired = 0;
let kept = 0;
let unknown = 0;
for (const name of readdirSync(base).sort()) {
  const mp = join(base, name, "MANIFEST.json");
  if (!existsSync(mp)) continue;
  try {
    const m = JSON.parse(readFileSync(mp, "utf8"));
    const ret = retentionFor(m.label);
    const created = new Date(m.created_at);
    if (Number.isNaN(created.getTime())) throw new Error("created_at");
    const exp = expiry(created, ret);
    const enc = m.encryption?.status === "ENCRYPTED" ? "encrypted" : "PLAINTEXT";
    if (exp.getTime() <= now.getTime()) {
      expired++;
      out(`EXPIRED-CANDIDATE ${name} class=${ret.class} created=${created.toISOString()} expired=${exp.toISOString()} ${enc}`);
    } else {
      kept++;
      out(`keep ${name} class=${ret.class} until=${exp.toISOString()} ${enc}`);
    }
  } catch {
    unknown++;
    out(`UNKNOWN ${name} (manifest unreadable or unrecognised label; not treated as expired)`);
  }
}
out(`SUMMARY expired_candidates=${expired} kept=${kept} unknown=${unknown}; read-only report, nothing was deleted`);
