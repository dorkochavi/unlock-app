import { describe, expect, it } from "vitest";

import { buildManifest, classifyPath } from "../../../scripts/create-review-bundle.mjs";

describe("classifyPath", () => {
  it.each([
    ".env.local",
    ".env",
    "nested/.env.production",
    "supabase/.temp/project-ref",
    "scratch/telemetry/2026-09-22-008/summary.md",
    "test-results/output.json",
    "playwright-report/index.html",
    "blob-report/report.zip",
    "coverage/lcov.info",
    "tsconfig.tsbuildinfo",
    "packages/app/tsconfig.tsbuildinfo",
    "node_modules/next/package.json",
    ".next/server/app-paths-manifest.json",
  ])("classifies %s as UNSAFE", (path) => {
    expect(classifyPath(path).status).toBe("UNSAFE");
  });

  it.each([
    ".env.example",
    "src/app/page.tsx",
    "docs/DEV_STATUS.md",
    "package.json",
    "src/application/import/preview-import.ts",
  ])("classifies %s as SAFE", (path) => {
    expect(classifyPath(path).status).toBe("SAFE");
  });
});

describe("buildManifest", () => {
  it("splits a mixed path list into included/excluded with reasons", () => {
    const manifest = buildManifest([
      "src/app/page.tsx",
      ".env.local",
      ".env.example",
      "supabase/.temp/project-ref",
    ]);

    expect(manifest.included).toEqual(["src/app/page.tsx", ".env.example"]);
    expect(manifest.excluded).toEqual([
      { path: ".env.local", reason: "env-local-or-secret" },
      { path: "supabase/.temp/project-ref", reason: "supabase-temp" },
    ]);
  });

  it("never includes any sensitive path even if it is somehow tracked", () => {
    const manifest = buildManifest([".env", "scratch/x", "test-results/x", "x.tsbuildinfo"]);
    expect(manifest.included).toEqual([]);
    expect(manifest.excluded).toHaveLength(4);
  });
});
