/**
 * Design Audit 001 P2-01 evidence. The Course-manage page is a heavy client component and the
 * Vitest environment is "node" (no jsdom), so it is not rendered here. This is a SOURCE-LEVEL
 * check (not a rendered accessibility check): both Topic text inputs must carry an explicit
 * accessible name, taken from the message catalogue, and the two names must be distinct.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { he } from "@/messages/he";

const source = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const topics = he.instructor.manage.topics;

describe("Topic input accessible names (source-level)", () => {
  it("uses distinct, non-empty Hebrew names", () => {
    expect(topics.renameLabel.trim()).not.toBe("");
    expect(topics.addPlaceholder.trim()).not.toBe("");
    expect(topics.renameLabel).not.toBe(topics.addPlaceholder);
  });

  it("labels the rename input", () => {
    const m = source.match(/<input\b[^>]*?renameDraft[\s\S]*?\/>/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain("aria-label={messages.instructor.manage.topics.renameLabel}");
  });

  it("labels the add-topic input", () => {
    const m = source.match(/<Input\b[^>]*?newTopicName[\s\S]*?\/>/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain("aria-label={messages.instructor.manage.topics.addPlaceholder}");
  });
});
