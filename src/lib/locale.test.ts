import { describe, expect, it } from "vitest";
import { locale } from "./locale";

describe("locale", () => {
  it("defaults to Hebrew RTL he-IL", () => {
    expect(locale.lang).toBe("he");
    expect(locale.dir).toBe("rtl");
    expect(locale.locale).toBe("he-IL");
  });
});
