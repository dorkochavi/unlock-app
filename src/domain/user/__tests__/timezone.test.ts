import { describe, expect, it } from "vitest";

import {
  InvalidTimezoneError,
  isValidIanaTimezone,
  parseIanaTimezone,
} from "../timezone";

describe("isValidIanaTimezone", () => {
  it("accepts well-known IANA identifiers", () => {
    expect(isValidIanaTimezone("Asia/Jerusalem")).toBe(true);
    expect(isValidIanaTimezone("Europe/London")).toBe(true);
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
    expect(isValidIanaTimezone("UTC")).toBe(true);
  });

  it("rejects an empty or blank string", () => {
    expect(isValidIanaTimezone("")).toBe(false);
    expect(isValidIanaTimezone("   ")).toBe(false);
  });

  it("rejects a string that is not a real IANA identifier", () => {
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
    expect(isValidIanaTimezone("1234")).toBe(false);
    expect(isValidIanaTimezone("GMT+7")).toBe(false);
  });
});

describe("parseIanaTimezone", () => {
  it("returns the canonical form for a valid identifier", () => {
    expect(parseIanaTimezone("Asia/Jerusalem")).toBe("Asia/Jerusalem");
    expect(parseIanaTimezone("Europe/London")).toBe("Europe/London");
    expect(parseIanaTimezone("America/New_York")).toBe("America/New_York");
  });

  it("canonicalizes a differently-cased valid identifier", () => {
    expect(parseIanaTimezone("asia/jerusalem")).toBe("Asia/Jerusalem");
  });

  it("throws InvalidTimezoneError for an invalid identifier", () => {
    expect(() => parseIanaTimezone("Not/AZone")).toThrow(InvalidTimezoneError);
    expect(() => parseIanaTimezone("")).toThrow(InvalidTimezoneError);
  });
});
