import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "validate-import-cli-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const ROW = {
  topic: "Alpha",
  type: "SINGLE_CHOICE",
  prompt: "UNIQUE-PROMPT-TEXT",
  options: [
    { key: "A", content: "UNIQUE-OPTION-TEXT" },
    { key: "B", content: "b" },
  ],
  correctOptions: ["A"],
};

function run(args: string[]) {
  const result = spawnSync(process.execPath, ["scripts/validate-import.mjs", ...args], { encoding: "utf8" });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}
function write(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

describe("scripts/validate-import.mjs (synthetic files)", () => {
  // This test protects against: a BOM-prefixed JSON export (Notepad/Excel) failing the offline gate although the
  // in-app file upload (browser UTF-8 decoding strips the BOM) accepts it — a false NO-GO on content day.
  it("accepts a BOM-prefixed JSON file and a BOM-prefixed topics file (exit 0)", () => {
    const file = write("bom.json", "﻿" + JSON.stringify([ROW]));
    const topics = write("topics.txt", "﻿Alpha\r\n");
    const { status } = run([file, "--topics-file", topics]);
    expect(status).toBe(0);
  });

  // This test protects against: exit codes drifting (0 PASS / 1 FAIL / 2 usage-IO), which the Content Go/No-Go relies on.
  it("exit codes: 1 for a failing file, 2 for usage/IO errors", () => {
    expect(run([write("bad.json", JSON.stringify([{ ...ROW, correctOptions: ["A", "B"] }]))]).status).toBe(1);
    expect(run([]).status).toBe(2);
    expect(run([join(dir, "missing.json")]).status).toBe(2);
    expect(run([write("x.txt", "hi")]).status).toBe(2);
    expect(run([write("ok.json", JSON.stringify([ROW])), "--min-questions", "-1"]).status).toBe(2);
  });

  // This test protects against: authored prompt/option text leaking to terminal output or logs.
  it("never prints prompt or option text, for PASS or FAIL", () => {
    const pass = run([write("p.json", JSON.stringify([ROW]))]);
    const fail = run([write("f.json", JSON.stringify([{ ...ROW, correctOptions: ["A", "B"] }]))]);
    for (const { out } of [pass, fail]) {
      expect(out).not.toContain("UNIQUE-PROMPT-TEXT");
      expect(out).not.toContain("UNIQUE-OPTION-TEXT");
    }
  });
});
