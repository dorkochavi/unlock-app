/**
 * getUserTimezone — reads the authenticated user's own persisted timezone.
 *
 * `actorUserId` is trusted as-is at this boundary, matching
 * `SubmitAnswerCommand.userId`'s existing precedent
 * (`src/application/learning/submit-answer.ts`) — deriving it from a real
 * authenticated principal is the API boundary's job, not this use case's
 * (the sibling `setUserTimezone` is already served that way by
 * `src/app/api/user/timezone/route.ts`; this read use case has no route
 * caller yet).
 */
import type { UserRepository } from "./ports";

export interface GetUserTimezoneCommand {
  actorUserId: string;
}

export type GetUserTimezoneResult =
  | { outcome: "FOUND"; timezone: string | null }
  | { outcome: "USER_NOT_FOUND" };

export async function getUserTimezone(
  command: GetUserTimezoneCommand,
  repo: UserRepository,
): Promise<GetUserTimezoneResult> {
  const record = await repo.findTimezone(command.actorUserId);
  return record === null
    ? { outcome: "USER_NOT_FOUND" }
    : { outcome: "FOUND", timezone: record.timezone };
}
