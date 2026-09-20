import { describe, expect, it } from "vitest";

import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts a well-formed UUID", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("accepts uppercase hex", () => {
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isUuid("")).toBe(false);
  });

  it("rejects a UUID missing a segment", () => {
    expect(isUuid("123e4567-e89b-12d3-a456")).toBe(false);
  });

  it("rejects a UUID with extra characters appended", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000-extra")).toBe(false);
  });

  it("rejects SQL-injection-shaped input", () => {
    expect(isUuid("'; drop table courses; --")).toBe(false);
  });
});
