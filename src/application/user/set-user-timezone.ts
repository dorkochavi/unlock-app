/**
 * setUserTimezone — persists the authenticated user's own detected
 * timezone (`docs/OPEN_QUESTIONS.md` #35: detected client-side on first
 * relevant session, then server-authoritative). Self-service only: a user
 * sets their OWN timezone, matching `archive-course-membership.ts`'s own
 * self-service framing — no product requirement exists for one user to set
 * another's timezone.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `get-user-timezone.ts`'s module doc comment for why.
 */
import { isValidIanaTimezone, parseIanaTimezone } from "../../domain/user/timezone";
import type { UserRepository } from "./ports";

export interface SetUserTimezoneCommand {
  actorUserId: string;
  /** Raw client-supplied candidate — validated here, never trusted as-is. */
  timezone: string;
}

export type SetUserTimezoneResult =
  | { outcome: "UPDATED"; timezone: string }
  | { outcome: "INVALID_TIMEZONE" }
  | { outcome: "USER_NOT_FOUND" };

export async function setUserTimezone(
  command: SetUserTimezoneCommand,
  repo: UserRepository,
): Promise<SetUserTimezoneResult> {
  if (!isValidIanaTimezone(command.timezone)) {
    return { outcome: "INVALID_TIMEZONE" };
  }
  const canonical = parseIanaTimezone(command.timezone);

  const updated = await repo.setTimezone(command.actorUserId, canonical);
  return updated === null
    ? { outcome: "USER_NOT_FOUND" }
    : { outcome: "UPDATED", timezone: canonical };
}
