#!/usr/bin/env node
/**
 * Offline pilot-content structural validator. No DB, no network, no env.
 *
 *   node scripts/validate-import.mjs <file.json|file.csv>
 *     [--topics "Topic A,Topic B" | --topics-file topics.txt] [--min-questions N]
 *
 * Exit 0 = PASS (warnings allowed), 1 = FAIL, 2 = usage/IO error.
 * Output: codes, row numbers, counts, Topic names — never question text.
 * See docs/PILOT_CONTENT_VALIDATOR.md.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE =
  "usage: node scripts/validate-import.mjs <file.json|file.csv> [--topics a,b | --topics-file f] [--min-questions N]";

function fail(message) {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
let file = null;
let topics;
let minQuestions;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--topics") {
    topics = String(args[++i] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (topics.length === 0) fail("--topics needs at least one Topic name");
  } else if (arg === "--topics-file") {
    const path = args[++i];
    if (!path) fail(USAGE);
    try {
      topics = readFileSync(path, "utf8")
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean);
    } catch {
      fail("cannot read topics file");
    }
  } else if (arg === "--min-questions") {
    minQuestions = Number(args[++i]);
    if (!Number.isInteger(minQuestions) || minQuestions < 0) {
      fail("--min-questions must be a non-negative integer");
    }
  } else if (arg.startsWith("--") || file !== null) {
    fail(USAGE);
  } else {
    file = arg;
  }
}
if (file === null) fail(USAGE);

const extension = extname(file).toLowerCase();
const format = extension === ".json" ? "JSON" : extension === ".csv" ? "CSV" : null;
if (format === null) fail("file must end in .json or .csv");

let sourceText;
try {
  sourceText = readFileSync(file, "utf8");
} catch {
  fail("cannot read input file");
}
if (sourceText.charCodeAt(0) === 0xfeff) sourceText = sourceText.slice(1);

let createJiti;
try {
  ({ createJiti } = await import("jiti"));
} catch {
  fail("jiti (transitive dev dependency) is required to load the TypeScript validator");
}
let report;
try {
  const jiti = createJiti(import.meta.url);
  const { validateImportSource } = await jiti.import(
    fileURLToPath(new URL("../src/application/import/validate-import-source.ts", import.meta.url)),
  );
  report = validateImportSource({ format, sourceText, knownTopics: topics, minQuestions });
} catch {
  // Generic on purpose: an internal error must not echo source content and
  // must not be confused with a validation FAIL (exit 1).
  fail("internal validator error (no report produced)");
}

const { counts, issues } = report;
console.log(`RESULT: ${report.result}`);
console.log(
  `rows=${counts.totalRows} valid=${counts.validRows} invalid=${counts.invalidRows} topics=${counts.topicsReferenced}`,
);
for (const [topic, n] of Object.entries(counts.questionsPerTopic)) {
  console.log(`  topic "${topic}": ${n}`);
}
for (const entry of issues) {
  const parts = [entry.severity, entry.code];
  if (entry.topic !== undefined) parts.push(`topic="${entry.topic}"`);
  if (entry.rows !== undefined) parts.push(`rows=${entry.rows.join(",")}`);
  if (entry.detail !== undefined) parts.push(entry.detail);
  console.log(parts.join(" "));
}
process.exit(report.result === "PASS" ? 0 : 1);
