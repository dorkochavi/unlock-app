import { describe, expect, it } from "vitest";

import { getUserTimezone } from "../get-user-timezone";
import { setUserTimezone } from "../set-user-timezone";
import { InMemoryUserDatabase } from "./in-memory-fakes";

describe("setUserTimezone", () => {
  it("persists a valid timezone (round-trip through getUserTimezone)", async () => {
    const db = new InMemoryUserDatabase();
    db.seedUser("user-1");
    const repo = db.repo();

    const result = await setUserTimezone(
      { actorUserId: "user-1", timezone: "Asia/Jerusalem" },
      repo,
    );

    expect(result).toEqual({ outcome: "UPDATED", timezone: "Asia/Jerusalem" });

    const read = await getUserTimezone({ actorUserId: "user-1" }, repo);
    expect(read).toEqual({ outcome: "FOUND", timezone: "Asia/Jerusalem" });
  });

  it("canonicalizes a differently-cased valid timezone before persisting", async () => {
    const db = new InMemoryUserDatabase();
    db.seedUser("user-1");
    const repo = db.repo();

    const result = await setUserTimezone(
      { actorUserId: "user-1", timezone: "america/new_york" },
      repo,
    );

    expect(result).toEqual({ outcome: "UPDATED", timezone: "America/New_York" });
  });

  it("rejects an invalid timezone without persisting anything", async () => {
    const db = new InMemoryUserDatabase();
    db.seedUser("user-1", "Europe/London");
    const repo = db.repo();

    const result = await setUserTimezone(
      { actorUserId: "user-1", timezone: "Not/AZone" },
      repo,
    );

    expect(result).toEqual({ outcome: "INVALID_TIMEZONE" });
    const read = await getUserTimezone({ actorUserId: "user-1" }, repo);
    expect(read).toEqual({ outcome: "FOUND", timezone: "Europe/London" });
  });

  it("returns USER_NOT_FOUND for a nonexistent user", async () => {
    const db = new InMemoryUserDatabase();
    const repo = db.repo();

    const result = await setUserTimezone(
      { actorUserId: "nobody", timezone: "UTC" },
      repo,
    );

    expect(result).toEqual({ outcome: "USER_NOT_FOUND" });
  });
});
