#!/usr/bin/env node
/**
 * telemetry.test.mjs
 *
 * Plain-Node tests (same harness style as verify-run-close.test.mjs) for
 * collect.mjs and summarize.mjs, using synthetic hook payloads/events in
 * disposable temp project roots. Never touches the real scratch/telemetry.
 *
 * Run: node .claude/telemetry/telemetry.test.mjs
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLLECT = path.join(__dirname, 'collect.mjs');
const SUMMARIZE = path.join(__dirname, 'summarize.mjs');

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

function mkRoot(planRunId = 'RUN-A') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unlock-telemetry-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  setPlanRunId(root, planRunId);
  return root;
}

function setPlanRunId(root, runId) {
  fs.writeFileSync(
    path.join(root, 'docs', 'CHATGPT_PLAN.md'),
    `# Plan\n\nRUN_ID: ${runId}\n`,
  );
}

function setSlice(root, line, runId = 'RUN-A') {
  fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'scratch', 'development_checkpoint.md'),
    `# checkpoint\n\n${runId === null ? '' : `RUN_ID: ${runId}\n`}${line}\n`,
  );
}

// Child env: real env minus any ambient run-identity vars (this test may
// itself run inside a Claude session), plus explicit overrides.
function cleanEnv(extra = {}) {
  const env = { ...process.env };
  delete env.UNLOCK_RUN_ID;
  delete env.CLAUDE_ENV_FILE;
  return { ...env, ...extra };
}

function collect(root, payload, extraEnv = {}) {
  const r = spawnSync('node', [COLLECT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: cleanEnv({ CLAUDE_PROJECT_DIR: root, ...extraEnv }),
  });
  assert.equal(r.status, 0, r.stderr);
}

function readEvents(root, runId, sessionId = 's1') {
  const f = path.join(root, 'scratch', 'telemetry', runId, 'raw', `${sessionId}.jsonl`);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function writeRaw(root, runId, events, sessionId = 's1') {
  const dir = path.join(root, 'scratch', 'telemetry', runId, 'raw');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${sessionId}.jsonl`),
    events.map((e) => JSON.stringify(e)).join('\n') + '\n',
  );
}

function summarize(root, runId) {
  const r = spawnSync('node', [SUMMARIZE, runId], {
    encoding: 'utf8',
    env: cleanEnv({ CLAUDE_PROJECT_DIR: root }),
  });
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(root, 'scratch', 'telemetry', runId);
  return {
    json: JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8')),
    md: fs.readFileSync(path.join(dir, 'summary.md'), 'utf8'),
  };
}

const base = { schema_version: 1, run_id: 'R', session_id: 's1' };
const ts = (n) => `2026-01-01T00:00:${String(n).padStart(2, '0')}.000Z`;

// ---------------------------------------------------------------------
// collect.mjs: RUN_ID resolution
// ---------------------------------------------------------------------
test('collect: Plan RUN_ID is re-read per event (mid-session Plan change re-attributes)', () => {
  const root = mkRoot('RUN-A');
  const p = { session_id: 's1', hook_event_name: 'SessionStart', source: 'startup' };
  collect(root, p);
  setPlanRunId(root, 'RUN-B');
  collect(root, { ...p, hook_event_name: 'SessionEnd', reason: 'x' });
  assert.equal(readEvents(root, 'RUN-A').length, 1);
  assert.equal(readEvents(root, 'RUN-B').length, 1);
});

test('collect: never persists UNLOCK_RUN_ID into CLAUDE_ENV_FILE (stale-pin hazard removed)', () => {
  const root = mkRoot('RUN-A');
  const envFile = path.join(root, 'claude-env.sh');
  fs.writeFileSync(envFile, '');
  collect(root, { session_id: 's1', hook_event_name: 'SessionStart', source: 'startup' }, {
    CLAUDE_ENV_FILE: envFile,
  });
  assert.equal(fs.readFileSync(envFile, 'utf8'), '');
  assert.equal(readEvents(root, 'RUN-A').length, 1);
});

test('collect: explicit user-set UNLOCK_RUN_ID override still wins over the Plan', () => {
  const root = mkRoot('RUN-A');
  collect(root, { session_id: 's1', hook_event_name: 'SessionStart' }, { UNLOCK_RUN_ID: 'RUN-X' });
  assert.equal(readEvents(root, 'RUN-X').length, 1);
  assert.equal(readEvents(root, 'RUN-A').length, 0);
});

// ---------------------------------------------------------------------
// collect.mjs: slice_id stamping + canonical event schema
// ---------------------------------------------------------------------
test('collect: slice_id is null without a checkpoint, and read from CURRENT_SLICE: first token', () => {
  const root = mkRoot();
  const p = { session_id: 's1', hook_event_name: 'SessionStart' };
  collect(root, p);
  setSlice(root, 'CURRENT_SLICE: E (telemetry hardening)');
  collect(root, p);
  setSlice(root, 'CURRENT_SLICE: (none)');
  collect(root, p);
  setSlice(root, 'COMPLETED_SLICES: A');
  collect(root, p);
  const ev = readEvents(root, 'RUN-A');
  assert.deepEqual(ev.map((e) => e.slice_id), [null, 'E', null, null]);
});

test('collect: canonical schema for tool, subagent start/stop events', () => {
  const root = mkRoot();
  setSlice(root, 'CURRENT_SLICE: B');
  collect(root, {
    session_id: 's1', hook_event_name: 'PostToolUse', tool_name: 'Read',
    tool_input: { file_path: path.join(root, 'docs', 'CHATGPT_PLAN.md') },
    tool_response: 'abcde', agent_id: 'ag1', agent_type: 'general-purpose',
  });
  collect(root, {
    session_id: 's1', hook_event_name: 'SubagentStart', agent_id: 'ag1', agent_type: 'general-purpose',
  });
  collect(root, {
    session_id: 's1', hook_event_name: 'SubagentStop', agent_id: 'ag1', agent_type: 'general-purpose',
    last_assistant_message: 'hello',
  });
  const [tool, start, stop] = readEvents(root, 'RUN-A');
  assert.equal(tool.activity, 'FILE_READ');
  assert.equal(tool.file_path, 'docs/CHATGPT_PLAN.md');
  assert.equal(tool.file_classification, 'HOT');
  assert.equal(tool.response_chars, 5);
  assert.equal(tool.agent_id, 'ag1'); // agent_id present => emitted inside a subagent
  assert.equal(start.activity, 'SUBAGENT_START');
  assert.equal(start.subagent_id, 'ag1');
  assert.equal(stop.activity, 'SUBAGENT_STOP');
  assert.equal(stop.handback_chars, 5);
  for (const e of [tool, start, stop]) {
    assert.equal(e.schema_version, 1);
    assert.equal(e.run_id, 'RUN-A');
    assert.equal(e.session_id, 's1');
    assert.equal(e.slice_id, 'B');
  }
});

// ---------------------------------------------------------------------
// summarize.mjs: subagent lifecycle semantics
// ---------------------------------------------------------------------
function subagentFixture() {
  const ev = [];
  let t = 0;
  const start = (id, type) => ({ ...base, event: 'SubagentStart', activity: 'SUBAGENT_START', agent_id: id, agent_type: type, subagent_type: type, timestamp: ts(t++) });
  const stop = (id, type, chars) => ({ ...base, event: 'SubagentStop', activity: 'SUBAGENT_STOP', agent_id: id, agent_type: type, handback_chars: chars, timestamp: ts(t++) });
  // Two dispatched agents; d1 is resumed (2 starts, 2 stops).
  ev.push(start('d1', 'general-purpose'), start('d2', 'unlock-reviewer'));
  ev.push(stop('d1', 'general-purpose', 100), start('d1', 'general-purpose'));
  ev.push(stop('d1', 'general-purpose', 50), stop('d2', 'unlock-reviewer', 10));
  // Three untyped background stops: no start, empty agent_type.
  for (const id of ['b1', 'b2', 'b3']) ev.push(stop(id, '', 30));
  return ev;
}

test('summarize: subagent start/stop asymmetry is classified, not forced equal', () => {
  const root = mkRoot();
  writeRaw(root, 'RUN-SUB', subagentFixture());
  const { json, md } = summarize(root, 'RUN-SUB');
  const s = json.subagents;
  assert.equal(s.started, 3); // SubagentStart events
  assert.equal(s.dispatched_unique_agents, 2);
  assert.equal(s.completed, 6); // ALL stop events (legacy field, unchanged meaning)
  assert.equal(s.completed_dispatched, 3);
  assert.equal(s.completed_background_untyped, 3);
  assert.equal(s.handback_chars_dispatched_total, 160);
  assert.match(md, /Dispatched \(SubagentStart events\): 3 \(2 unique agents\)/);
  assert.match(md, /untyped background\/internal agents .*: 3/);
});

test('summarize: typed stop without a matching start counts as dispatched', () => {
  const root = mkRoot();
  writeRaw(root, 'RUN-SUB2', [
    { ...base, event: 'SubagentStop', activity: 'SUBAGENT_STOP', agent_id: 'x', agent_type: 'general-purpose', timestamp: ts(0) },
  ]);
  const { json } = summarize(root, 'RUN-SUB2');
  assert.equal(json.subagents.completed_dispatched, 1);
  assert.equal(json.subagents.completed_background_untyped, 0);
});

// ---------------------------------------------------------------------
// summarize.mjs: per-slice table + backward compatibility
// ---------------------------------------------------------------------
test('summarize: no slice_id anywhere => slices null and no per-slice section (historical parity)', () => {
  const root = mkRoot();
  writeRaw(root, 'RUN-OLD', [
    { ...base, event: 'PostToolUse', activity: 'FILE_READ', success: true, tool_name: 'Read', file_path: 'a.md', file_classification: 'COLD', response_chars: 3, timestamp: ts(0) },
  ]);
  const { json, md } = summarize(root, 'RUN-OLD');
  assert.equal(json.slices, null);
  assert.doesNotMatch(md, /Per-Slice Activity/);
});

test('summarize: slice_id present => compact per-slice table with unattributed count', () => {
  const root = mkRoot();
  const read = (slice, n) => ({ ...base, event: 'PostToolUse', activity: 'FILE_READ', success: true, tool_name: 'Read', file_path: 'a.md', file_classification: 'COLD', response_chars: 10, slice_id: slice, timestamp: ts(n) });
  writeRaw(root, 'RUN-SL', [
    read(null, 0),
    read('A', 1),
    read('A', 2),
    { ...base, event: 'PostToolUse', activity: 'SHELL', success: true, tool_name: 'Bash', slice_id: 'B', timestamp: ts(3) },
    { ...base, event: 'SubagentStart', activity: 'SUBAGENT_START', agent_id: 'd', agent_type: 'general-purpose', slice_id: 'B', timestamp: ts(4) },
  ]);
  const { json, md } = summarize(root, 'RUN-SL');
  assert.deepEqual(json.slices.by_slice.map((r) => r.slice_id), ['A', 'B']);
  const a = json.slices.by_slice[0];
  assert.equal(a.events, 2);
  assert.equal(a.file_reads, 2);
  assert.equal(a.tool_response_chars, 20);
  const b = json.slices.by_slice[1];
  assert.equal(b.shell_calls, 1);
  assert.equal(b.subagents_started, 1);
  assert.equal(json.slices.unattributed_events, 1);
  assert.match(md, /\| A \| 2 \| 2 \| 2 \|/);
  assert.match(md, /Unattributed events \(no slice_id\): 1/);
});

// ---------------------------------------------------------------------
// V1.3: Run-bound slice attribution, shell navigation, response sizes
// ---------------------------------------------------------------------
test('collect: stale CURRENT_SLICE from a different RUN_ID is NOT inherited', () => {
  const root = mkRoot('RUN-NEW');
  const p = { session_id: 's1', hook_event_name: 'SessionStart' };
  setSlice(root, 'CURRENT_SLICE: Z2', 'RUN-OLD');
  collect(root, p);
  setSlice(root, 'CURRENT_SLICE: Z2', null); // no RUN_ID line at all
  collect(root, p);
  setSlice(root, 'CURRENT_SLICE: D1', 'RUN-NEW');
  collect(root, p);
  const ev = readEvents(root, 'RUN-NEW');
  assert.deepEqual(ev.map((e) => e.slice_id), [null, null, 'D1']);
});

function bash(root, command) {
  collect(root, {
    session_id: 's1', hook_event_name: 'PostToolUse', tool_name: 'Bash',
    tool_input: { command }, tool_response: 'x'.repeat(50),
  });
}

test('collect: shell navigation commands get nav:* classes; non-navigation stays unpromoted', () => {
  const root = mkRoot();
  const cases = [
    ['cat docs/a.md', 'nav:cat'],
    ["sed -n '1,40p' docs/a.md", 'nav:sed'],
    ['sed -i s/a/b/ f.txt', 'shell:other'],
    ['sed s/a/b/ f.txt', 'shell:other'],
    ["sed -n -i.bak 's/a/b/' f", 'shell:other'],
    ['head -20 f | tail -5', 'nav:head'],
    ['tail -n 5 f', 'nav:tail'],
    ['grep -rn foo src', 'nav:grep'],
    ['rg foo', 'nav:grep'],
    ['Get-Content a.md', 'nav:get-content'],
    ['Select-String -Path a.md -Pattern x', 'nav:select-string'],
    ['catalog --list', 'shell:other'],
    ['git status --short', 'git:status'],
  ];
  for (const [cmd] of cases) bash(root, cmd);
  const ev = readEvents(root, 'RUN-A');
  assert.deepEqual(ev.map((e) => e.command_class), cases.map((c) => c[1]));
});

test('collect: compound command records each nav class, never the command text', () => {
  const root = mkRoot();
  bash(root, 'cd secret-dir && cat TOP_SECRET_FILE.md; grep -n hunter2 x');
  const ev = readEvents(root, 'RUN-A');
  assert.deepEqual(ev[0].command_classes, ['shell:other', 'nav:cat', 'nav:grep']);
  const raw = JSON.stringify(ev);
  for (const leak of ['TOP_SECRET_FILE', 'hunter2', 'secret-dir']) {
    assert.ok(!raw.includes(leak), 'leaked ' + leak);
  }
});

test('summarize: repository_access keeps native reads/searches separate from shell navigation', () => {
  const root = mkRoot();
  const t = (o, n) => ({ ...base, event: 'PostToolUse', success: true, timestamp: ts(n), ...o });
  writeRaw(root, 'RUN-NAV', [
    t({ activity: 'FILE_READ', tool_name: 'Read', file_path: 'a.md', file_classification: 'COLD', response_chars: 5 }, 0),
    t({ activity: 'SEARCH_GREP', tool_name: 'Grep', response_chars: 7 }, 1),
    t({ activity: 'SHELL', tool_name: 'Bash', command_class: 'nav:cat', command_classes: ['nav:cat', 'nav:grep'], response_chars: 900 }, 2),
    t({ activity: 'SHELL', tool_name: 'Bash', command_class: 'git:status', command_classes: ['git:status'], response_chars: 30 }, 3),
    t({ activity: 'SHELL', tool_name: 'Bash', command_class: 'shell:other', command_classes: ['shell:other'], response_chars: 1 }, 4),
  ]);
  const { json, md } = summarize(root, 'RUN-NAV');
  assert.equal(json.repository_access.native_file_reads, 1);
  assert.equal(json.repository_access.native_searches, 1);
  assert.equal(json.repository_access.shell_navigation_calls, 1);
  assert.deepEqual(json.repository_access.shell_navigation_by_class, { 'nav:cat': 1, 'nav:grep': 1 });
  assert.equal(json.shell_activity.by_category.NAVIGATION, 2);
  assert.match(md, /Shell navigation calls .*: 1/);
});

test('summarize: response_sizes by tool/class, max, top-N metadata only; pre-nav raw data reads 0 navigation', () => {
  const root = mkRoot();
  const t = (o, n) => ({ ...base, event: 'PostToolUse', success: true, timestamp: ts(n), ...o });
  const events = [];
  for (let i = 0; i < 7; i++) {
    events.push(t({ activity: 'SHELL', tool_name: 'Bash', command_class: 'shell:other', response_chars: 100 * (i + 1), command: 'RAW-CMD-BODY', tool_response: 'BODY' }, i));
  }
  events.push({ ...t({ activity: 'FILE_READ', tool_name: 'Read', file_path: 'a.md', file_classification: 'COLD', response_chars: 5000 }, 9), success: false });
  writeRaw(root, 'RUN-SZ', events);
  const { json, md } = summarize(root, 'RUN-SZ');
  const rs = json.response_sizes;
  assert.equal(rs.max_single, 5000);
  assert.equal(rs.by_tool.Bash, 2800);
  assert.equal(rs.by_tool.Read, 5000);
  assert.equal(rs.by_command_class['shell:other'], 2800);
  assert.equal(rs.top.length, 5);
  assert.deepEqual(rs.top[0], { tool_name: 'Read', response_chars: 5000, command_class: null, slice_id: null, success: false });
  assert.deepEqual(Object.keys(rs.top[1]).sort(), ['command_class', 'response_chars', 'slice_id', 'success', 'tool_name']);
  assert.equal(json.repository_access.shell_navigation_calls, 0);
  assert.ok(!JSON.stringify(json).includes('RAW-CMD-BODY'));
  assert.ok(!md.includes('RAW-CMD-BODY'));
  assert.match(md, /Response Size Hotspots/);
});

console.log('');
console.log(`telemetry.test.mjs: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  process.exit(1);
}
