#!/usr/bin/env node
/**
 * verify-run-close.test.mjs
 *
 * Plain-Node test harness for verify-run-close.mjs. Deliberately NOT a
 * vitest test: vitest.config.mts's test.include is hard-restricted to
 * src/**\/*.test.ts(x), so a DevOS tooling script under .claude/telemetry/
 * would never be auto-discovered there, and this Slice must not touch
 * vitest.config.mts or add DevOS test files under src/**.
 *
 * Run directly:
 *   node .claude/telemetry/verify-run-close.test.mjs
 *
 * Each case builds a small disposable fixture under a temp directory:
 * - a throwaway `git init`-ed repo (never the real repository's git state)
 *   for git-ground-truth scenarios;
 * - fixture docs/DEV_STATUS.md and docs/CHATGPT_PLAN.md files with the
 *   labeled current-Run metadata lines the verifier parses;
 * - a fixture docs/RUNS/<RUN_ID>.md file where a case needs one to exist.
 *
 * The verifier itself is invoked as a real subprocess (`node
 * verify-run-close.mjs --root <fixtureDir> [--pre-close]`) so these tests
 * exercise the actual CLI/exit-code contract, not just its internals.
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, 'verify-run-close.mjs');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failCount += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

function mkTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'verify-run-close-'));
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Builds a throwaway git repo with a linear history of `commitCount` commits
// on its default branch, then returns the array of commit hashes
// (oldest -> newest). This is a disposable temp-directory fixture repo,
// never the real repository.
function initFixtureRepo(dir, commitCount) {
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'devos-fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'DevOS Fixture']);
  const hashes = [];
  for (let i = 0; i < commitCount; i += 1) {
    fs.writeFileSync(path.join(dir, `file-${i}.txt`), `content ${i}\n`);
    git(dir, ['add', '.']);
    git(dir, ['commit', '-q', '-m', `fixture commit ${i}`]);
    hashes.push(git(dir, ['rev-parse', 'HEAD']).trim());
  }
  return hashes;
}

function writeDocs(dir, { devStatus, plan }) {
  const docsDir = path.join(dir, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, 'DEV_STATUS.md'), devStatus ?? '# DEV_STATUS\n');
  fs.writeFileSync(path.join(docsDir, 'CHATGPT_PLAN.md'), plan ?? '# CHATGPT_PLAN\n');
}

function writeRunReport(dir, runId, content = '# fixture run report\n') {
  const runsDir = path.join(dir, 'docs', 'RUNS');
  fs.mkdirSync(runsDir, { recursive: true });
  fs.writeFileSync(path.join(runsDir, `${runId}.md`), content);
}

// Stages and commits every fixture file written so far, so `git status
// --short` reports a clean tree afterwards (docs/RUN-report fixture files
// are written directly to the working tree by writeDocs/writeRunReport,
// which otherwise leaves them untracked/dirty).
function commitFixtureFiles(dir, message = 'fixture: docs') {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

function runVerifier(dir, extraArgs = []) {
  const result = spawnSync('node', [SCRIPT, '--root', dir, ...extraArgs], {
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function planFixture({ runId, startHead, lastVerifiedHead, runStatus }) {
  return [
    'PLAN_VERSION: 001',
    `RUN_ID: ${runId}`,
    `START_HEAD: \`${startHead}\``,
    `RUN_STATUS: ${runStatus}`,
    ...(lastVerifiedHead ? [`LAST_VERIFIED_HEAD: \`${lastVerifiedHead}\``] : []),
    '',
    'Fixture plan body.',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------
// Case 1: PASS -- valid START_HEAD + LAST_VERIFIED_HEAD ancestor of HEAD,
// matching RUN_ID, report file present, clean tree, COMPLETE.
// ---------------------------------------------------------------------
test('PASS: valid identity, ancestor, matching RUN_ID, report present, clean tree', () => {
  const dir = mkTempDir();
  const [c0, c1] = initFixtureRepo(dir, 2);
  const runId = '2026-01-01-FIXTURE-PASS';
  writeDocs(dir, {
    devStatus: `# DEV_STATUS\n\nRUN_ID: ${runId}\n`,
    plan: planFixture({ runId, startHead: c0, lastVerifiedHead: c1, runStatus: 'COMPLETE' }),
  });
  writeRunReport(dir, runId);
  commitFixtureFiles(dir);

  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 0, `expected exit 0, got ${status}. stdout:\n${stdout}`);
  assert.match(stdout, /verify-run-close: PASS/);
});

// ---------------------------------------------------------------------
// Case 2: FAIL -- invalid/non-resolving LAST_VERIFIED_HEAD.
// ---------------------------------------------------------------------
test('FAIL: non-resolving LAST_VERIFIED_HEAD', () => {
  const dir = mkTempDir();
  const [c0] = initFixtureRepo(dir, 1);
  const runId = '2026-01-01-FIXTURE-BADHASH';
  writeDocs(dir, {
    plan: planFixture({
      runId,
      startHead: c0,
      lastVerifiedHead: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      runStatus: 'COMPLETE',
    }),
  });
  writeRunReport(dir, runId);
  commitFixtureFiles(dir);

  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 1, `expected exit 1, got ${status}. stdout:\n${stdout}`);
  assert.match(stdout, /does not resolve via git rev-parse --verify/);
});

// ---------------------------------------------------------------------
// Case 3: FAIL -- LAST_VERIFIED_HEAD not an ancestor of HEAD (a commit from
// a divergent branch).
// ---------------------------------------------------------------------
test('FAIL: LAST_VERIFIED_HEAD not an ancestor of HEAD', () => {
  const dir = mkTempDir();
  const [c0] = initFixtureRepo(dir, 1);
  // Create a divergent branch with its own commit, not merged into main.
  git(dir, ['checkout', '-q', '-b', 'divergent']);
  fs.writeFileSync(path.join(dir, 'divergent-file.txt'), 'divergent\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'divergent commit']);
  const divergentHash = git(dir, ['rev-parse', 'HEAD']).trim();
  // Return to a branch/commit that does NOT contain the divergent commit.
  git(dir, ['checkout', '-q', '-B', 'main', c0]);

  const runId = '2026-01-01-FIXTURE-NOTANCESTOR';
  writeDocs(dir, {
    plan: planFixture({ runId, startHead: c0, lastVerifiedHead: divergentHash, runStatus: 'COMPLETE' }),
  });
  writeRunReport(dir, runId);
  commitFixtureFiles(dir);

  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 1, `expected exit 1, got ${status}. stdout:\n${stdout}`);
  assert.match(stdout, /is not an ancestor of current HEAD/);
});

// ---------------------------------------------------------------------
// Case 4: FAIL -- missing Run report file when COMPLETE.
// ---------------------------------------------------------------------
test('FAIL: missing Run report file when RUN_STATUS: COMPLETE', () => {
  const dir = mkTempDir();
  const [c0, c1] = initFixtureRepo(dir, 2);
  const runId = '2026-01-01-FIXTURE-NOREPORT';
  writeDocs(dir, {
    plan: planFixture({ runId, startHead: c0, lastVerifiedHead: c1, runStatus: 'COMPLETE' }),
  });
  // Deliberately do NOT write docs/RUNS/<runId>.md.
  commitFixtureFiles(dir);

  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 1, `expected exit 1, got ${status}. stdout:\n${stdout}`);
  assert.match(stdout, /expected Run report .* is missing/);
});

// ---------------------------------------------------------------------
// Case 5: FAIL -- RUN_ID mismatch between DEV_STATUS.md and CHATGPT_PLAN.md.
// ---------------------------------------------------------------------
test('FAIL: RUN_ID mismatch between DEV_STATUS.md and CHATGPT_PLAN.md', () => {
  const dir = mkTempDir();
  const [c0, c1] = initFixtureRepo(dir, 2);
  const planRunId = '2026-01-01-FIXTURE-PLANID';
  const devStatusRunId = '2026-01-01-FIXTURE-DIFFERENT-ID';
  writeDocs(dir, {
    devStatus: `# DEV_STATUS\n\nRUN_ID: ${devStatusRunId}\n`,
    plan: planFixture({ runId: planRunId, startHead: c0, lastVerifiedHead: c1, runStatus: 'COMPLETE' }),
  });
  writeRunReport(dir, planRunId);
  commitFixtureFiles(dir);

  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 1, `expected exit 1, got ${status}. stdout:\n${stdout}`);
  assert.match(stdout, /RUN_ID mismatch/);
});

// ---------------------------------------------------------------------
// Case 6: WARN -- legacy "Final HEAD" string present (PASS overall, exit 0).
// ---------------------------------------------------------------------
test('WARN: legacy "Final HEAD" string present, still PASS/exit 0', () => {
  const dir = mkTempDir();
  const [c0, c1] = initFixtureRepo(dir, 2);
  const runId = '2026-01-01-FIXTURE-LEGACY';
  writeDocs(dir, {
    devStatus: '# DEV_STATUS\n\nSome legacy note: Final HEAD `abc1234` was here.\n',
    plan: planFixture({ runId, startHead: c0, lastVerifiedHead: c1, runStatus: 'COMPLETE' }),
  });
  writeRunReport(dir, runId);
  commitFixtureFiles(dir);

  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 0, `expected exit 0 (WARN only), got ${status}. stdout:\n${stdout}`);
  assert.match(stdout, /verify-run-close: PASS/);
  assert.match(stdout, /WARN: Legacy "Final HEAD" pattern found/);
});

// ---------------------------------------------------------------------
// Case 7: Negative case -- a legitimate historical/evidence hash inside a
// Run-report-style fixture file (simulating docs/RUNS/**) must NOT be
// flagged, because the verifier never scans that file's content at all.
// ---------------------------------------------------------------------
test('Negative: hash/legacy text inside a docs/RUNS/** style fixture file is never scanned', () => {
  const dir = mkTempDir();
  const [c0, c1] = initFixtureRepo(dir, 2);
  const runId = '2026-01-01-FIXTURE-RUNSCONTENT';
  writeDocs(dir, {
    plan: planFixture({ runId, startHead: c0, lastVerifiedHead: c1, runStatus: 'COMPLETE' }),
  });
  // This Run-report-style fixture file deliberately contains BOTH a legacy
  // "Final HEAD" string AND a hash that does not resolve in this fixture
  // repo at all. If the verifier ever scanned docs/RUNS/** content, this
  // would surface as a spurious WARN/FAIL. It must not.
  writeRunReport(
    dir,
    runId,
    '# Fixture Run Report\n\nFinal HEAD `ffffffffffffffffffffffffffffffffffffffff` (frozen historical ledger entry, correct as written).\n'
  );
  commitFixtureFiles(dir);

  const withoutFixture = runVerifier(dir);

  // Now remove the report file (uncommitted deletion -- dirty tree is
  // expected and irrelevant to what this case is proving, hence --pre-close)
  // and confirm output differs ONLY in the report-existence FAIL -- i.e.
  // the fixture file's content never contributed a WARN either way, proving
  // content is genuinely unread.
  fs.rmSync(path.join(dir, 'docs', 'RUNS', `${runId}.md`));
  const withoutReportAtAll = runVerifier(dir, ['--pre-close']);

  assert.equal(withoutFixture.status, 0, `expected exit 0 with the fixture report present. stdout:\n${withoutFixture.stdout}`);
  assert.doesNotMatch(
    withoutFixture.stdout,
    /WARN: Legacy "Final HEAD"/,
    'the docs/RUNS/** fixture file\'s own "Final HEAD" text must never be scanned/flagged'
  );
  assert.doesNotMatch(
    withoutReportAtAll.stdout,
    /WARN: Legacy "Final HEAD"/,
    'removing the docs/RUNS/** fixture file must not change legacy-string WARN behavior either'
  );
  assert.match(withoutReportAtAll.stdout, /expected Run report .* is missing/);
});

// ---------------------------------------------------------------------
// Case 8: WARN -- LAST_VERIFIED_HEAD equals current HEAD while COMPLETE
// (flagged by review-commit as an untested branch; added to close the gap).
// ---------------------------------------------------------------------
test('WARN: LAST_VERIFIED_HEAD equals current HEAD while RUN_STATUS: COMPLETE', () => {
  const dir = mkTempDir();
  const [c0] = initFixtureRepo(dir, 1);
  const runId = '2026-01-01-FIXTURE-EQUALHEAD';
  // A commit cannot correctly self-cite its own hash (that is the exact bug
  // this Slice retires), so to genuinely get LAST_VERIFIED_HEAD == current
  // HEAD we declare it in UNCOMMITTED docs on top of c0 and never commit
  // them here -- current HEAD stays c0, matching LAST_VERIFIED_HEAD exactly.
  // The resulting dirty tree is irrelevant to what this case proves, hence
  // --pre-close (also mirrors the real-world trigger for this WARN: a
  // Run-close docs commit that has not landed yet).
  writeDocs(dir, {
    plan: planFixture({ runId, startHead: c0, lastVerifiedHead: c0, runStatus: 'COMPLETE' }),
  });
  writeRunReport(dir, runId);

  const { status, stdout } = runVerifier(dir, ['--pre-close']);
  assert.equal(status, 0, `expected exit 0 (WARN only), got ${status}. stdout:\n${stdout}`);
  assert.match(stdout, /verify-run-close: PASS/);
  assert.match(
    stdout,
    /WARN: LAST_VERIFIED_HEAD equals current HEAD/,
    `expected the equals-HEAD WARN. stdout:\n${stdout}`
  );
});

// ---------------------------------------------------------------------
// Telemetry attribution sanity (WARN-only)
// ---------------------------------------------------------------------
function attributionFixture(commitCount, runId) {
  const dir = mkTempDir();
  const hashes = initFixtureRepo(dir, commitCount);
  writeDocs(dir, {
    devStatus: `# DEV_STATUS\n\nRUN_ID: ${runId}\n`,
    plan: planFixture({ runId, startHead: hashes[0], runStatus: 'IN_PROGRESS' }),
  });
  return dir;
}

function writeTelemetryEvents(dir, runId, count) {
  const rawDir = path.join(dir, 'scratch', 'telemetry', runId, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const lines = Array.from({ length: count }, (_, i) => JSON.stringify({ n: i }));
  fs.writeFileSync(path.join(rawDir, 's1.jsonl'), lines.join('\n') + '\n');
}

function writeSessionSnapshot(dir, folder, sessionName, timestamp) {
  const sessionsDir = path.join(dir, 'scratch', 'telemetry', folder, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(
    path.join(sessionsDir, 's1.json'),
    JSON.stringify({ session_id: 's1', session_name: sessionName, timestamp })
  );
}

test('WARN (c): current Run telemetry folder missing, still PASS/exit 0', () => {
  const runId = '2026-02-01-ATTR-MISSING';
  const dir = attributionFixture(2, runId);
  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 0, stdout);
  assert.match(stdout, /WARN: Telemetry folder scratch\/telemetry\/2026-02-01-ATTR-MISSING is missing/);
});

test('WARN (a): near-zero events despite many commits since START_HEAD', () => {
  const runId = '2026-02-01-ATTR-THIN';
  const dir = attributionFixture(7, runId); // 6 commits above START_HEAD >= 5
  writeTelemetryEvents(dir, runId, 3);
  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 0, stdout);
  assert.match(stdout, /only 3 event\(s\)/);
});

test('No WARN (a): thin telemetry on a short Run, or ample events on a long Run', () => {
  const runId = '2026-02-01-ATTR-OK';
  const short = attributionFixture(3, runId); // 2 commits < threshold
  writeTelemetryEvents(short, runId, 1);
  assert.doesNotMatch(runVerifier(short).stdout, /event\(s\)/);
  const long = attributionFixture(7, runId);
  writeTelemetryEvents(long, runId, 25);
  const out = runVerifier(long).stdout;
  assert.doesNotMatch(out, /WARN/);
  assert.match(out, /no findings/);
});

test('WARN (b): recent session in another folder names the current Run', () => {
  const runId = '2026-02-01-DEVOS-V9.9-CONSOLIDATION';
  const dir = attributionFixture(2, runId);
  writeTelemetryEvents(dir, runId, 30);
  writeSessionSnapshot(dir, '2026-01-01-OLD-RUN', 'UNLOCK DEVOS V9.9 consolidation', new Date().toISOString());
  const { status, stdout } = runVerifier(dir);
  assert.equal(status, 0, stdout);
  assert.match(stdout, /filed under telemetry folder "2026-01-01-OLD-RUN"/);
});

test('No WARN (b): stale snapshot, or unrelated session name', () => {
  const runId = '2026-02-01-DEVOS-V9.9-CONSOLIDATION';
  const dir = attributionFixture(2, runId);
  writeTelemetryEvents(dir, runId, 30);
  const old = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
  writeSessionSnapshot(dir, '2026-01-01-OLD-RUN', 'UNLOCK DEVOS V9.9 consolidation', old);
  writeSessionSnapshot(dir, '2026-01-02-OTHER', 'Something unrelated', new Date().toISOString());
  assert.doesNotMatch(runVerifier(dir).stdout, /attribution drift/);
});

// ---------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------
console.log('');
console.log(`verify-run-close.test.mjs: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  process.exit(1);
}
