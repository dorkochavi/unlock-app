/**
 * getOrCreateDailyPlanForToday — the PUBLIC DailyPlan entry point (ADR-016
 * §1/§2/§17).
 *
 * Resolves the two inputs `generateDailyPlanForResolvedInputs`
 * (`generate-daily-plan-for-resolved-inputs.ts`) deliberately left to a
 * later caller — persisted-timezone -> local calendar date, and
 * membership-driven Course discovery — then delegates to that unchanged
 * internal core. This file owns NO candidate-generation/ranking/planning
 * logic of its own; it is a thin orchestration boundary, matching the
 * existing `submitAnswer` precedent of keeping every application-layer
 * file free of learning policy.
 *
 * Deliberately accepts no `courseId`/`courseIds`/`scope` parameter —
 * course discovery is this function's own job (ADR-016 §1: "Course Today
 * is NOT a separate plan"). See `generate-daily-plan-for-resolved-inputs
 * .ts`'s own doc comment for why the internal core is shaped the way it
 * is; this file is the caller that shape was designed for.
 *
 * ## Accepted product decision: automatic DailyPlan eligibility is
 * `LEARNER`-role only
 *
 * `CourseMembershipRepository.listActiveForUser` already excludes revoked
 * and archived memberships (ADR-015 §7/§9) but does not filter by role.
 * This file additionally filters to `role === "LEARNER"` before a
 * membership's Course becomes eligible for automatic DailyPlan generation.
 * `OWNER`/`INSTRUCTOR` memberships are Course-MANAGEMENT roles
 * (`domain/course/types.ts`'s `MANAGEMENT_COURSE_ROLES`) and must NOT
 * automatically contribute their Courses to the acting user's own personal
 * DailyPlan — an instructor's own dashboard/authoring surface is a
 * different, not-yet-built concern, not this file's. This is now an
 * accepted product decision (`docs/OPEN_QUESTIONS.md` #44, RESOLVED), not
 * an invented default: nothing before this file existed decided it either
 * way. A `LEARNER` membership on the SAME Course the user also manages
 * (if that ever becomes possible) would still be eligible under this rule
 * — the filter is per-membership-row `role`, not per-user-per-Course.
 *
 * ## Accepted product decision: an ARCHIVED Course is excluded too (Run 008 S4)
 *
 * `listActiveForUser` (ADR-015 §7/§9) already excludes a membership the
 * LEARNER has personally archived (`CourseMembership.archivedAt`) — a
 * per-user fact, unrelated to the Course's own lifecycle. It says nothing
 * about the Course's own `status` (Run 005's DRAFT/PUBLISHED/ARCHIVED
 * lifecycle, `domain/course/types.ts`). `canSelfJoinCourse`'s own doc
 * comment already states the accepted rule this file was missing: "an
 * ARCHIVED Course is no longer active for normal learner participation...
 * regardless of `join_policy`" (Run 005 CHATGPT_PLAN.md "Course
 * lifecycle"/"Join behavior") — that rule was enforced only at JOIN time;
 * an existing membership whose Course is archived AFTERWARD kept
 * contributing that Course's progress/unseen candidates to the learner's
 * DailyPlan indefinitely. This closes that gap by additionally filtering
 * `eligibleCourseIds` to Courses whose CURRENT status is `PUBLISHED`,
 * applying the same already-accepted rule consistently rather than only
 * at the moment of joining. A DRAFT Course is already structurally
 * unreachable here (no membership can exist without having passed through
 * `canSelfJoinCourse`, which requires `PUBLISHED`, or being the Course's
 * own OWNER — a management role this file already excludes above), so
 * this filter's only observable effect in practice is excluding ARCHIVED.
 *
 * ## Timezone resolution
 *
 * `UserRepository.findTimezone` is the sole source of truth (`docs
 * /OPEN_QUESTIONS.md` #35, RESOLVED) — never UTC, never the server's own
 * timezone, never a client/request-supplied value, and `command.now` is
 * the only clock reference (never `Date.now()` internally, matching every
 * other module in this codebase's own stated discipline). No user record
 * -> `USER_NOT_FOUND`. A user record with `timezone: null` -> a clean,
 * typed `TIMEZONE_NOT_SET` — this is a legitimate pre-detection state
 * (`docs/OPEN_QUESTIONS.md` #35: timezone is detected client-side "on
 * first registration / first relevant client session"), never defaulted
 * around. The persisted string is re-validated via `parseIanaTimezone`
 * before use — cheap, and consistent with this codebase's existing
 * "re-validate at the application boundary even though the writer already
 * validated" posture (e.g. `submitAnswer`'s QuestionVersion consistency
 * check) — rather than an unchecked cast to the branded `IanaTimezone`
 * type.
 *
 * ## Same-day resume: membership lookup is NOT skipped, by design
 *
 * `plannedForDate` (needed to even ask "does a plan already exist for
 * today") can only be computed AFTER timezone resolution, so the timezone
 * read can never be avoided. Given `plannedForDate`, THIS function still
 * unconditionally resolves active memberships and calls
 * `generateDailyPlanForResolvedInputs` on every call, even when a plan for
 * that day already exists and the internal core's own `findByKey`
 * short-circuit (`generate-daily-plan-for-resolved-inputs.ts`) will return
 * immediately without generating anything. **Consequence, stated
 * explicitly**: a same-day resume call still performs one
 * `listActiveForUser` read that turns out to be unnecessary. This is a
 * deliberate choice, not an oversight — the only way to avoid it cleanly
 * would be either a new non-transactional `DailyPlanRepository` read port
 * outside `DailyPlanUnitOfWork` (not authorized by this slice), or a
 * second, separate `runInTransaction` call made JUST to check existence
 * before the membership read (which would open two transactions per
 * resume instead of one — a net loss, and exactly the "duplicating
 * repository access/transaction logic" this slice was told to avoid).
 * One extra indexed, non-transactional read per resume is judged an
 * acceptable, cheap cost against that alternative; this may be revisited
 * if `listActiveForUser` ever becomes expensive or membership lists grow
 * large.
 */
import { parseIanaTimezone } from "../../domain/user/timezone";
import { deriveLocalDateString } from "../../domain/user/local-date";
import type { CourseMembershipRepository, CourseRepository } from "../course/ports";
import type { UserRepository } from "../user/ports";
import {
  generateDailyPlanForResolvedInputs,
  type DailyPlanGenerationContext,
} from "./generate-daily-plan-for-resolved-inputs";
import type { DailyPlan, DailyPlanUnitOfWork } from "./ports";

export interface GetOrCreateDailyPlanForTodayCommand {
  userId: string;
  /** Explicit current instant — the only clock reference this file uses. */
  now: Date;
}

/**
 * The generation core's own context, minus `now` — `now` lives on
 * `GetOrCreateDailyPlanForTodayCommand` instead, so there is exactly ONE
 * authoritative clock value per call. Accepting a second, independently
 * suppliable `now` on the generation context here would let a caller pass
 * mismatched instants for "what day is it" vs. "what is due right now" —
 * a landmine this shape removes structurally rather than by convention.
 */
export type DailyPlanGenerationSettings = Omit<DailyPlanGenerationContext, "now">;

export interface GetOrCreateDailyPlanForTodayPorts {
  users: UserRepository;
  courseMemberships: CourseMembershipRepository;
  /**
   * Read-only, used only for `listStatuses` (Run 008 S4) — see this file's
   * own "Accepted product decision" doc comment below for why.
   */
  courses: CourseRepository;
  dailyPlanUnitOfWork: DailyPlanUnitOfWork;
}

export type GetOrCreateDailyPlanForTodayResult =
  | { outcome: "READY"; plan: DailyPlan }
  | { outcome: "USER_NOT_FOUND" }
  | { outcome: "TIMEZONE_NOT_SET" };

export async function getOrCreateDailyPlanForToday(
  command: GetOrCreateDailyPlanForTodayCommand,
  settings: DailyPlanGenerationSettings,
  ports: GetOrCreateDailyPlanForTodayPorts,
): Promise<GetOrCreateDailyPlanForTodayResult> {
  const userRecord = await ports.users.findTimezone(command.userId);
  if (userRecord === null) {
    return { outcome: "USER_NOT_FOUND" };
  }
  if (userRecord.timezone === null) {
    return { outcome: "TIMEZONE_NOT_SET" };
  }

  const timezone = parseIanaTimezone(userRecord.timezone);
  const plannedForDate = deriveLocalDateString(command.now, timezone);

  // LEARNER-only (see module doc comment). `listActiveForUser` already
  // excludes revoked/archived memberships (ADR-015 §7/§9) — this file adds
  // only the role filter. Any duplicate courseId this could theoretically
  // produce (real schema's `UNIQUE (user_id, course_id)` prevents it) is
  // already handled defensively by `generateDailyPlanForResolvedInputs`'s
  // own deduplication — not re-implemented here.
  const activeMemberships = await ports.courseMemberships.listActiveForUser(
    command.userId,
  );
  const learnerCourseIds = activeMemberships
    .filter((membership) => membership.role === "LEARNER")
    .map((membership) => membership.courseId);

  // ARCHIVED-Course exclusion (see module doc comment).
  const eligibleCourseIds = await filterToPublishedCourseIds(learnerCourseIds, ports.courses);

  const plan = await generateDailyPlanForResolvedInputs(
    { userId: command.userId, plannedForDate, eligibleCourseIds },
    { ...settings, now: command.now },
    ports.dailyPlanUnitOfWork,
  );

  return { outcome: "READY", plan };
}

/** ARCHIVED-Course exclusion (see this file's own module doc comment). */
async function filterToPublishedCourseIds(
  courseIds: string[],
  courses: CourseRepository,
): Promise<string[]> {
  if (courseIds.length === 0) {
    return [];
  }
  const statuses = await courses.listStatuses(courseIds);
  const publishedIds = new Set(
    statuses.filter((course) => course.status === "PUBLISHED").map((course) => course.id),
  );
  return courseIds.filter((courseId) => publishedIds.has(courseId));
}
