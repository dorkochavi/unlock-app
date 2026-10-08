#!/usr/bin/env node
/**
 * verify-run-close.mjs
 *
 * Deterministic, zero-AI, zero-network guardrail for UNLOCK's Run identity
 * model: START_HEAD / LAST_VERIFIED_HEAD / RUN_STATUS (see CLAUDE.md's
 * Handoff Model). This replaces the retired "Final HEAD" convention, which
 * could never correctly self-cite the hash of the very commit that
 * introduced it into a Run-close document.
 *
 * Scope (deliberately narrow):
 * - reads ONLY docs/DEV_STATUS.md and docs/CHATGPT_PLAN.md, and only for
 *   simple line-anchored `LABEL: value` metadata lines -- no Markdown
 *   parser, no heading-aware section logic;
 * - docs/CHATGPT_PLAN.md is treated as the authoritative current-Run
 *   identity surface (per CLAUDE.md S2, it owns "current execution").
 *   docs/DEV_STATUS.md is a narrative snapshot; it is consulted only for
 *   an optional RUN_ID cross-check and the legacy-string WARN below;
 * - docs/RUNS/<current RUN_ID>.md (the CURRENT Run's report only) is checked
 *   for existence (FAIL) and, as WARN-only advisories, for a line-anchored
 *   `Status:` line containing COMPLETE and for mentioning the RUN_ID. Other
 *   reports under docs/RUNS/** are frozen historical ledger entries and are
 *   never read or scanned; historical hashes are never compared to HEAD.
 *
 * WARN-only advisories added by the Assessment-Engine-002 hardening (all
 * deterministic; none can fail a Run):
 *   - COMPLETE: Run report `Status:` line / RUN_ID mention (above);
 *   - COMPLETE: Plan does not reference docs/RUNS/<RUN_ID>.md;
 *   - COMPLETE: LAST_VERIFIED_HEAD is the commit that last touched the Run
 *     report (the closing commit self-citing -- LAST_VERIFIED_HEAD should be
 *     the last verified CONTENT commit, below the close commit);
 *   - COMPLETE: a backticked `docs/...` path (no glob) in the Plan header or
 *     History does not exist;
 *   - IN_PROGRESS: slice table has zero PENDING rows (close not yet declared?).
 * DEV_STATUS RUN_ID cross-check is dormant: DEV_STATUS has no line-anchored
 * `RUN_ID:` label today, so it never fires; no format is imposed on it.
 *
 * Usage:
 *   node .claude/telemetry/verify-run-close.mjs [--pre-close] [--root <path>]
 *
 * --pre-close
 *   Signals "the Run-close docs commit has not been made yet, so of course
 *   the working tree is dirty right now" -- skips ONLY the dirty-tree-while-
 *   COMPLETE FAIL for this invocation. Every other check still runs. Use it
 *   when checking Run-close docs edits before committing them.
 *
 * --root <path>
 *   Repository root to check (default: two levels up from this script,
 *   i.e. the real repository). verify-run-close.test.mjs uses this to
 *   point at disposable temp-directory fixtures -- it never touches the
 *   real repository's git state.
 *
 * Telemetry attribution sanity (WARN-only, deterministic, reads only
 * scratch/telemetry/**): see checkTelemetryAttribution below.
 *
 * Exit code: 0 on PASS (including WARN-only), 1 if any FAIL is found.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const preClose = argv.includes('--pre-close');
  const rootIdx = argv.indexOf('--root');
  const root =
    rootIdx !== -1 && argv[rootIdx + 1]
      ? path.resolve(argv[rootIdx + 1])
      : path.resolve(__dirname, '..', '..');
  return { preClose, root };
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// Returns the value of the FIRST line in `content` that is anchored at the
// start of a line (an optional leading "- " bullet is tolerated) and reads
// exactly `LABEL:` followed by a value. This intentionally does NOT match
// the same words appearing mid-sentence/wrapped in prose -- only a true
// labeled line counts as a current-Run identity declaration.
//
// Relies on the current-Run identity block being the FIRST such block in
// docs/CHATGPT_PLAN.md (current convention: current Run at the top,
// historical/superseded Runs in sections further down, per CLAUDE.md S2/S4).
// If that convention were ever violated -- a historical block moved above
// the live one -- this would silently extract the wrong Run's identity.
// Reviewed and accepted as a known fragility (2026-09-28 review, Slice
// DEVOS-B): correct for the current and foreseeable document structure;
// revisit if CHATGPT_PLAN.md's block ordering convention ever changes.
export function extractLabel(content, label) {
  if (!content) return null;
  const re = new RegExp(`^[ \\t]*-?[ \\t]*${label}:[ \\t]*(.+)$`, 'm');
  const m = content.match(re);
  if (!m) return null;
  const value = m[1].trim();
  const backtick = value.match(/^`([^`]+)`/);
  if (backtick) return backtick[1].trim();
  const bare = value.match(/^([^\s(]+)/);
  return bare ? bare[1].trim() : value;
}

export function hasLegacyFinalHead(content) {
  return !!content && /final\s+head/i.test(content);
}

// Plan-corruption patterns seen at two consecutive Run closes (a close script
// wrote the literal "undefined" into the Plan title line and left the slice
// table PENDING while the Run was declared COMPLETE).
// - `undefined` outside backtick code spans (WARN: could be legitimate prose);
// - slice-table rows whose last (status) cell starts with PENDING (FAIL when
//   RUN_STATUS is COMPLETE: a completed Run has no pending Slice).
export function planHasUndefinedText(content) {
  if (!content) return false;
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return /\bundefined/.test(withoutCode);
}

export function planPendingSliceRows(content) {
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .filter((line) => /^\s*\|.*\|\s*PENDING\b[^|]*\|\s*$/.test(line));
}

// True when the Plan has at least one slice-table row with a recognised status cell.
export function planHasSliceStatusRows(content) {
  if (!content) return false;
  return content.split('\n').some((line) => {
    const t = line.trim();
    if (!t.startsWith('|') || !t.endsWith('|')) return false;
    const cells = t.split('|');
    const last = cells[cells.length - 2].trim();
    return /^(PENDING|DONE|BLOCKED|IN_PROGRESS|SKIPPED)/.test(last);
  });
}

// Backticked docs/... paths in the Plan header (before the first "## ") and in
// the "## History" section. Glob/placeholder paths are skipped. Pure.
export function planDocPathRefs(content) {
  if (!content) return [];
  const firstH2 = content.search(/^## /m);
  const header = firstH2 === -1 ? content : content.slice(0, firstH2);
  const histStart = content.search(/^## History\b/m);
  let hist = '';
  if (histStart !== -1) {
    const rest = content.slice(histStart + 3);
    const next = rest.search(/^## /m);
    hist = next === -1 ? rest : rest.slice(0, next);
  }
  const text = header + '\n' + hist;
  const out = new Set();
  for (const m of text.matchAll(/`(docs\/[^`\s*<>{}]+)`/g)) {
    out.add(m[1].replace(/#.*$/, '').replace(/[:.,;)]+$/, ''));
  }
  return [...out];
}

function gitRefExists(root, ref) {
  try {
    // The `^{commit}` suffix forces git to verify the object actually
    // exists and is a commit -- plain `git rev-parse --verify <sha1>` will
    // syntactically echo back any 40-hex-char string without checking the
    // object database, which would silently defeat this check.
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function isAncestor(root, ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

// Attribution-sanity thresholds (named so they are easy to tune/audit).
export const MIN_RUN_EVENTS = 20; // fewer events than this is "near zero"
export const MIN_RUN_COMMITS = 5; // ...only suspicious for a Run this long
export const RECENT_SESSION_HOURS = 48; // "recently active" other-folder session
export const MAX_STARTS_PER_SLICE_ID = 3; // more worker dispatches under one slice_id is suspicious

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// "2026-09-29-DEVOS-V1.3-CONSOLIDATION" -> "devos v1 3 consolidation"
export function runShortName(runId) {
  return normalizeName(runId.replace(/^\d{4}-\d{2}-\d{2}-/, ''));
}

function countRawEvents(runDir) {
  const rawDir = path.join(runDir, 'raw');
  let count = 0;
  let files;
  try {
    files = fs.readdirSync(rawDir).filter((f) => f.endsWith('.jsonl'));
  } catch {
    return 0;
  }
  for (const f of files) {
    const text = readFileSafe(path.join(rawDir, f));
    if (text) count += text.split(/\r?\n/).filter((l) => l.trim()).length;
  }
  return count;
}

/**
 * Deterministic, zero-AI telemetry attribution sanity checks. WARN-only:
 * scratch/telemetry is gitignored local data, so absence or thinness is
 * suspicious but never proof of a broken Run. Motivation: hooks attribute
 * events to the Plan's RUN_ID at event time; a stale Plan RUN_ID silently
 * files a whole Run under the previous Run's folder.
 *  (c) current Run folder missing;
 *  (a) folder has < MIN_RUN_EVENTS events although START_HEAD..HEAD spans
 *      >= MIN_RUN_COMMITS commits;
 *  (b) another Run folder has a recently-updated session snapshot whose
 *      session_name mentions this Run's short name (session filed elsewhere).
 */
export function checkTelemetryAttribution({ root, runId, startHead, now = Date.now() }) {
  const warns = [];
  const telemetryRoot = path.join(root, 'scratch', 'telemetry');
  const runDir = path.join(telemetryRoot, runId);

  if (!fs.existsSync(runDir)) {
    warns.push(
      `Telemetry folder scratch/telemetry/${runId} is missing -- events for this Run may have been attributed to another RUN_ID (stale Plan RUN_ID?) or telemetry is not collected on this machine.`
    );
  } else if (startHead) {
    let commits = null;
    try {
      commits = Number(gitOutput(root, ['rev-list', '--count', `${startHead}..HEAD`]));
    } catch {
      commits = null;
    }
    const events = countRawEvents(runDir);
    if (Number.isFinite(commits) && commits >= MIN_RUN_COMMITS && events < MIN_RUN_EVENTS) {
      warns.push(
        `Telemetry folder for ${runId} has only ${events} event(s) (< ${MIN_RUN_EVENTS}) although the Run spans ${commits} commit(s) since START_HEAD (>= ${MIN_RUN_COMMITS}) -- likely mis-attributed to another RUN_ID.`
      );
    }
  }

  const short = runShortName(runId);
  if (short && fs.existsSync(telemetryRoot)) {
    const cutoff = now - RECENT_SESSION_HOURS * 3600 * 1000;
    for (const other of fs.readdirSync(telemetryRoot).sort()) {
      if (other === runId) continue;
      const sessionsDir = path.join(telemetryRoot, other, 'sessions');
      let files;
      try {
        files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
      } catch {
        continue;
      }
      for (const f of files) {
        let snap;
        try {
          snap = JSON.parse(readFileSafe(path.join(sessionsDir, f)));
        } catch {
          continue;
        }
        const ts = Date.parse(snap?.timestamp ?? '');
        if (!Number.isFinite(ts) || ts < cutoff) continue;
        if (normalizeName(snap?.session_name).includes(short)) {
          warns.push(
            `Recently active session "${snap.session_name}" is filed under telemetry folder "${other}" but its name references this Run (${runId}) -- RUN_ID attribution drift.`
          );
        }
      }
    }
  }

  return warns;
}

/**
 * WARN-only: coarse Slice attribution. Counts SubagentStart events per
 * slice_id (null = unattributed). Warns when >= 2 workers share a single
 * slice_id (or none) or one slice_id covers > MAX_STARTS_PER_SLICE_ID starts,
 * i.e. the parent likely did not update CURRENT_SLICE before dispatching.
 */
export function checkSliceAttributionGranularity({ root, runId }) {
  const rawDir = path.join(root, 'scratch', 'telemetry', runId, 'raw');
  let files;
  try {
    files = fs.readdirSync(rawDir).filter((f) => f.endsWith('.jsonl'));
  } catch {
    return [];
  }
  const counts = new Map();
  for (const f of files) {
    for (const line of (readFileSafe(path.join(rawDir, f)) ?? '').split(/\r?\n/)) {
      if (!line.includes('SubagentStart')) continue;
      try {
        const e = JSON.parse(line);
        if (e.event !== 'SubagentStart') continue;
        const id = e.slice_id ?? null;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      } catch {
        // ignore malformed lines
      }
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const label = (id) => (id === null ? '(unattributed)' : id);
  if (total >= 2 && counts.size === 1) {
    const [id] = counts.keys();
    return [
      `All ${total} dispatched workers share slice_id ${label(id)} -- CURRENT_SLICE was likely not updated before each dispatch (autonomous-run Section 7 pre-dispatch record).`,
    ];
  }
  return [...counts]
    .filter(([, n]) => n > MAX_STARTS_PER_SLICE_ID)
    .map(
      ([id, n]) =>
        `slice_id ${label(id)} covers ${n} worker dispatches (> ${MAX_STARTS_PER_SLICE_ID}) -- per-Slice attribution may be coarse; was CURRENT_SLICE updated before each dispatch?`
    );
}

function gitOutput(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

// WARN-only advisories for a COMPLETE Run whose report file exists.
export function checkCompleteAdvisories({ root, runId, plan, reportPath, lastVerifiedHead }) {
  const warns = [];
  const report = readFileSafe(reportPath) ?? '';
  const statusLine = report.match(/^[ \t]*Status:[ \t]*(.*)$/m);
  if (!statusLine || !/COMPLETE/.test(statusLine[1])) {
    warns.push(
      `Run report docs/RUNS/${runId}.md has no line-anchored "Status:" line containing COMPLETE.`
    );
  }
  if (!report.includes(runId)) {
    warns.push(`Run report docs/RUNS/${runId}.md does not mention its RUN_ID "${runId}".`);
  }
  if (!plan.includes(`docs/RUNS/${runId}.md`)) {
    warns.push(`Plan does not reference docs/RUNS/${runId}.md.`);
  }
  for (const ref of planDocPathRefs(plan)) {
    if (!fs.existsSync(path.join(root, ref))) {
      warns.push(`Plan header/History references ${ref}, which does not exist.`);
    }
  }
  if (lastVerifiedHead) {
    try {
      const lvh = gitOutput(root, ['rev-parse', '--verify', `${lastVerifiedHead}^{commit}`]);
      const lastTouch = gitOutput(root, ['log', '-1', '--format=%H', '--', `docs/RUNS/${runId}.md`]);
      if (lastTouch && lvh === lastTouch) {
        warns.push(
          `LAST_VERIFIED_HEAD "${lastVerifiedHead}" may be the commit that last touched the Run report (possibly self-citing the close commit; ignore if that commit was a content commit) -- cite the last verified CONTENT commit instead.`
        );
      }
    } catch {
      // unresolved refs are reported by the FAIL checks; nothing to add here.
    }
  }
  return warns;
}

export function runVerification({ root, preClose }) {
  const fails = [];
  const warns = [];

  const devStatusPath = path.join(root, 'docs', 'DEV_STATUS.md');
  const planPath = path.join(root, 'docs', 'CHATGPT_PLAN.md');
  const devStatus = readFileSafe(devStatusPath);
  const plan = readFileSafe(planPath);

  if (hasLegacyFinalHead(devStatus)) {
    warns.push(
      `Legacy "Final HEAD" pattern found in ${devStatusPath} -- should now be LAST_VERIFIED_HEAD.`
    );
  }
  if (hasLegacyFinalHead(plan)) {
    warns.push(
      `Legacy "Final HEAD" pattern found in ${planPath} -- should now be LAST_VERIFIED_HEAD.`
    );
  }

  if (!plan) {
    fails.push(`Cannot read ${planPath}.`);
    return { fails, warns };
  }

  if (planHasUndefinedText(plan)) {
    warns.push(
      `Literal "undefined" found in ${planPath} (outside code spans) -- likely a corrupted close/patch script; check the title line and slice table.`
    );
  }

  const runId = extractLabel(plan, 'RUN_ID');
  const runStatus = extractLabel(plan, 'RUN_STATUS');
  const startHead = extractLabel(plan, 'START_HEAD');
  const lastVerifiedHead = extractLabel(plan, 'LAST_VERIFIED_HEAD');
  const devStatusRunId = extractLabel(devStatus, 'RUN_ID');

  if (devStatusRunId && runId && devStatusRunId !== runId) {
    fails.push(
      `RUN_ID mismatch: DEV_STATUS.md declares "${devStatusRunId}", CHATGPT_PLAN.md declares "${runId}".`
    );
  }

  if (!runId) {
    // No declared current-Run block at all -- nothing further to check.
    return { fails, warns };
  }

  if (!startHead) {
    fails.push('START_HEAD is missing for the declared current Run.');
  } else if (!gitRefExists(root, startHead)) {
    fails.push(`START_HEAD "${startHead}" does not resolve via git rev-parse --verify.`);
  }

  warns.push(...checkTelemetryAttribution({ root, runId, startHead }));
  warns.push(...checkSliceAttributionGranularity({ root, runId }));

  if (runStatus === 'COMPLETE') {
    if (!lastVerifiedHead) {
      fails.push('LAST_VERIFIED_HEAD is missing while RUN_STATUS: COMPLETE.');
    }
    const pendingRows = planPendingSliceRows(plan);
    if (pendingRows.length > 0) {
      fails.push(
        `RUN_STATUS: COMPLETE but ${pendingRows.length} slice-table row(s) in ${planPath} are still PENDING.`
      );
    }
    const reportPath = path.join(root, 'docs', 'RUNS', `${runId}.md`);
    if (!fs.existsSync(reportPath)) {
      fails.push(`RUN_STATUS: COMPLETE but expected Run report ${reportPath} is missing.`);
    } else {
      warns.push(...checkCompleteAdvisories({ root, runId, plan, reportPath, lastVerifiedHead }));
    }
  } else if (
    runStatus === 'IN_PROGRESS' &&
    planPendingSliceRows(plan).length === 0 &&
    planHasSliceStatusRows(plan)
  ) {
    warns.push(
      `RUN_STATUS: IN_PROGRESS but ${planPath} has zero PENDING slice-table rows -- Run finished but RUN_STATUS not yet COMPLETE (or slice table missing)?`
    );
  }

  if (lastVerifiedHead) {
    if (!gitRefExists(root, lastVerifiedHead)) {
      fails.push(
        `LAST_VERIFIED_HEAD "${lastVerifiedHead}" does not resolve via git rev-parse --verify.`
      );
    } else {
      const head = gitOutput(root, ['rev-parse', 'HEAD']);
      if (!isAncestor(root, lastVerifiedHead, head)) {
        fails.push(
          `LAST_VERIFIED_HEAD "${lastVerifiedHead}" is not an ancestor of current HEAD "${head}".`
        );
      } else if (runStatus === 'COMPLETE' && lastVerifiedHead === head) {
        warns.push(
          `LAST_VERIFIED_HEAD equals current HEAD ("${head}") while RUN_STATUS: COMPLETE -- not wrong, but usually means no Run-close docs commit has landed on top yet.`
        );
      }
    }
  }

  if (runStatus === 'COMPLETE') {
    const dirty = gitOutput(root, ['status', '--short']);
    if (dirty && !preClose) {
      fails.push(
        'Working tree is dirty while RUN_STATUS: COMPLETE (pass --pre-close if the Run-close commit has not been made yet).'
      );
    }
  }

  return { fails, warns };
}

function main() {
  const { preClose, root } = parseArgs(process.argv.slice(2));
  const { fails, warns } = runVerification({ root, preClose });

  const status = fails.length > 0 ? 'FAIL' : 'PASS';
  console.log(`verify-run-close: ${status}`);
  for (const f of fails) console.log(`  FAIL: ${f}`);
  for (const w of warns) console.log(`  WARN: ${w}`);
  if (fails.length === 0 && warns.length === 0) console.log('  no findings.');

  process.exit(fails.length > 0 ? 1 : 0);
}

// Only run as a CLI when invoked directly (not when imported by the test file).
const invokedDirectly =
  process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  main();
}
