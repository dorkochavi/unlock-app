import { describe, expect, it } from "vitest";

import { getUserTimezone } from "../get-user-timezone";
import { InMemoryUserDatabase } from "./in-memory-fakes";

describe("getUserTimezone", () => {
  it("returns the persisted timezone for a user who has one", async () => {
    const db = new InMemoryUserDatabase();
    db.seedUser("user-1", "Asia/Jerusalem");

    const result = await getUserTimezone({ actorUserId: "user-1" }, db.repo());

    expect(result).toEqual({ outcome: "FOUND", timezone: "Asia/Jerusalem" });
  });

  it("returns FOUND with a null timezone for an uninitialized user", async () => {
    const db = new InMemoryUserDatabase();
    db.seedUser("user-1");

    const result = await getUserTimezone({ actorUserId: "user-1" }, db.repo());

    expect(result).toEqual({ outcome: "FOUND", timezone: null });
  });

  it("returns USER_NOT_FOUND for a nonexistent user", async () => {
    const db = new InMemoryUserDatabase();

    const result = await getUserTimezone({ actorUserId: "nobody" }, db.repo());

    expect(result).toEqual({ outcome: "USER_NOT_FOUND" });
  });
});
