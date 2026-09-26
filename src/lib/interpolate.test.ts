import { describe, expect, it } from "vitest";

import { interpolate } from "./interpolate";

describe("interpolate", () => {
  it("replaces every placeholder, including repeated ones", () => {
    expect(interpolate("{a} מתוך {b}, שוב {a}", { a: 2, b: "5" })).toBe("2 מתוך 5, שוב 2");
  });

  it("leaves unknown placeholders visible", () => {
    expect(interpolate("{known} {unknown}", { known: 1 })).toBe("1 {unknown}");
  });
});
