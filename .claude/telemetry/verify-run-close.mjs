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
 * - docs/RUNS/** is checked only for the EXISTENCE of the expected report
 *   file (fs.existsSync) -- its content is never read or scanned. Run
 *   reports are frozen historical ledger entries and out of scope here.
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

function gitOutput(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
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

  if (runStatus === 'COMPLETE') {
    if (!lastVerifiedHead) {
      fails.push('LAST_VERIFIED_HEAD is missing while RUN_STATUS: COMPLETE.');
    }
    const reportPath = path.join(root, 'docs', 'RUNS', `${runId}.md`);
    if (!fs.existsSync(reportPath)) {
      fails.push(`RUN_STATUS: COMPLETE but expected Run report ${reportPath} is missing.`);
    }
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
