/**
 * Deterministic safe review-bundle generator (Run 008 S1.A).
 *
 * A prior manually-zipped repository snapshot ("TRY 6") still contained
 * local/sensitive/generated artifacts (`.env.local`, `supabase/.temp/**`,
 * telemetry output, test-result/build/cache artifacts) despite `.gitignore`
 * already excluding them — a recursive directory copy trusts `.gitignore`
 * to be respected by whoever runs it; it is not.
 *
 * This script instead exports explicitly safe repository knowledge: the
 * source of truth is `git ls-files` (tracked, non-deleted paths), which by
 * construction already excludes every `.gitignore`d local/generated
 * artifact — verified before this Slice: nothing under `.env*` besides the
 * tracked `.env.example`, `supabase/.temp/**`, `scratch/**`,
 * `test-results/**`, or `*.tsbuildinfo` has ever been committed. An
 * explicit `UNSAFE_PATTERNS` filter runs on top as a defense-in-depth
 * safety net — if one of these patterns is ever tracked by mistake, it is
 * still excluded here and reported, not silently bundled.
 *
 * Output lands under `scratch/review-bundle/<timestamp>/` (already
 * `.gitignore`d, disposable) — never committed, never printed to stdout as
 * file contents.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Defense-in-depth exclusion list, evaluated in addition to (not instead
 * of) the `git ls-files` tracked-only source. `.env.example` is the one
 * explicit allow inside the otherwise-blocked `.env*` family.
 */
export const UNSAFE_PATTERNS = [
  { name: "env-local-or-secret", test: (p) => /(^|\/)\.env(\.|$)/.test(p) && p !== ".env.example" },
  { name: "supabase-temp", test: (p) => /(^|\/)supabase\/\.temp\//.test(p) },
  { name: "scratch", test: (p) => /(^|\/)scratch\//.test(p) },
  { name: "test-results", test: (p) => /(^|\/)test-results\//.test(p) },
  { name: "playwright-report", test: (p) => /(^|\/)playwright-report\//.test(p) },
  { name: "blob-report", test: (p) => /(^|\/)blob-report\//.test(p) },
  { name: "coverage", test: (p) => /(^|\/)coverage\//.test(p) },
  { name: "tsbuildinfo", test: (p) => /\.tsbuildinfo$/.test(p) },
  { name: "node-modules", test: (p) => /(^|\/)node_modules\//.test(p) },
  { name: "next-build", test: (p) => /(^|\/)\.next\//.test(p) },
];

/** @param {string} relativePath repo-relative path using forward slashes */
export function classifyPath(relativePath) {
  const match = UNSAFE_PATTERNS.find((pattern) => pattern.test(relativePath));
  return match === undefined ? { status: "SAFE" } : { status: "UNSAFE", reason: match.name };
}

/**
 * @param {string[]} paths repo-relative paths (forward slashes)
 * @returns {{ included: string[]; excluded: { path: string; reason: string }[] }}
 */
export function buildManifest(paths) {
  const included = [];
  const excluded = [];
  for (const path of paths) {
    const result = classifyPath(path);
    if (result.status === "SAFE") {
      included.push(path);
    } else {
      excluded.push({ path, reason: result.reason });
    }
  }
  return { included, excluded };
}

function listTrackedFiles(repoRoot) {
  const raw = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" });
  return raw.split("\0").filter((path) => path.length > 0);
}

function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(scriptDir, "..");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(repoRoot, "scratch", "review-bundle", timestamp);

  const tracked = listTrackedFiles(repoRoot).filter((path) => existsSync(join(repoRoot, path)));
  const { included: classifiedSafe, excluded } = buildManifest(tracked);

  // A tracked symlink is excluded here, not in `classifyPath` (which is a
  // pure path-string check with no filesystem access) — `copyFileSync`
  // follows symlinks, so a tracked symlink pointing outside the repo would
  // silently copy its external target's content into the bundle,
  // undermining the "tracked-only is safe" assumption this script is built
  // on. No tracked symlink exists in this repository as of Run 008 S1.A,
  // but the check is unconditional so it stays true if that ever changes.
  const included = [];
  for (const path of classifiedSafe) {
    if (lstatSync(join(repoRoot, path)).isSymbolicLink()) {
      excluded.push({ path, reason: "symlink" });
    } else {
      included.push(path);
    }
  }

  if (excluded.length > 0) {
    console.warn(
      `create-review-bundle: excluded ${excluded.length} tracked path(s) matching an unsafe pattern (this should normally be zero — investigate why a sensitive path is tracked):`,
    );
    for (const item of excluded) {
      console.warn(`  - ${item.path} (${item.reason})`);
    }
  }

  let totalBytes = 0;
  for (const path of included) {
    const src = join(repoRoot, path);
    const dest = join(outDir, path);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    totalBytes += statSync(src).size;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim(),
    includedCount: included.length,
    excludedCount: excluded.length,
    totalBytes,
    excluded,
  };
  writeFileSync(join(outDir, "MANIFEST.json"), JSON.stringify(manifest, null, 2));

  console.log(`create-review-bundle: wrote ${included.length} file(s), ${totalBytes} bytes, to ${outDir}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
