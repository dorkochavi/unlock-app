/**
 * Client-side composition for the learner Progress page (Run 009 S2).
 *
 * Progress is a GLOBAL destination composed from two EXISTING read models —
 * no new endpoint, aggregate, or persistence:
 * 1. `GET /api/courses/mine` — the learner's active/discoverable Courses
 *    (same listing the Courses page uses: not revoked, not archived).
 *    Archived memberships are therefore NOT surfaced, and no archived-Course
 *    navigation path is added. OWNER/INSTRUCTOR entries are dropped: the S1
 *    endpoint is learner-only (they would only ever 403), and Progress is the
 *    learner's own state.
 * 2. `GET /api/courses/:id/topic-progress` (S1) once per displayed Course,
 *    in parallel after the list resolves. This is a bounded, pilot-scale
 *    composition (one list request + one request per learner Course, one
 *    round of waterfall), consistent with the existing per-Course endpoints;
 *    no cross-Course aggregate is invented.
 *
 * Each Course resolves independently so one failing Course does not blank the
 * page. The outcomes are deliberately distinct: `ready` with `topics: []`
 * (Course has no Topics — NOT the same as a Topic in `NOT_STARTED`),
 * `unavailable` (409 `COURSE_NOT_ACTIVE`), and `error` (network/other).
 *
 * Only the caller's own session is used: no user id is ever sent.
 */
export type LearnerTopicState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "NEEDS_REINFORCEMENT"
  | "SOLID";

export interface TopicProgressDto {
  topicId: string;
  name: string;
  state: LearnerTopicState;
  attemptedCount: number;
  totalCount: number;
}

interface MyCourseDto {
  id: string;
  title: string;
  role: string;
}

export type CourseProgress =
  | { kind: "ready"; topics: TopicProgressDto[] }
  | { kind: "unavailable" }
  | { kind: "error" };

export interface ProgressCourse {
  id: string;
  title: string;
  progress: CourseProgress;
}

export type ProgressLoadResult =
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "ERROR" }
  | { outcome: "READY"; courses: ProgressCourse[] };

export type FetchFn = (url: string, init?: { cache?: "no-store" }) => Promise<Response>;

const STATES: readonly string[] = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REINFORCEMENT", "SOLID"];

function isTopicProgressDto(value: unknown): value is TopicProgressDto {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.topicId === "string" &&
    typeof v.name === "string" &&
    typeof v.state === "string" &&
    STATES.includes(v.state) &&
    Number.isInteger(v.attemptedCount) &&
    Number.isInteger(v.totalCount)
  );
}

type CourseOutcome = { kind: "unauthenticated" } | CourseProgress;

async function loadCourseProgress(fetchFn: FetchFn, courseId: string): Promise<CourseOutcome> {
  let response: Response;
  try {
    response = await fetchFn(`/api/courses/${courseId}/topic-progress`, { cache: "no-store" });
  } catch {
    return { kind: "error" };
  }
  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 409) return { kind: "unavailable" };
  if (!response.ok) return { kind: "error" };
  try {
    const body = (await response.json()) as { topics?: unknown };
    if (!Array.isArray(body.topics) || !body.topics.every(isTopicProgressDto)) {
      return { kind: "error" };
    }
    return { kind: "ready", topics: body.topics };
  } catch {
    return { kind: "error" };
  }
}

export async function loadProgress(fetchFn: FetchFn): Promise<ProgressLoadResult> {
  let listResponse: Response;
  try {
    listResponse = await fetchFn("/api/courses/mine");
  } catch {
    return { outcome: "ERROR" };
  }
  if (listResponse.status === 401) return { outcome: "UNAUTHENTICATED" };
  if (!listResponse.ok) return { outcome: "ERROR" };

  let learnerCourses: MyCourseDto[];
  try {
    const body = (await listResponse.json()) as { courses: MyCourseDto[] };
    learnerCourses = body.courses.filter((course) => course.role === "LEARNER");
  } catch {
    return { outcome: "ERROR" };
  }

  const outcomes = await Promise.all(
    learnerCourses.map((course) => loadCourseProgress(fetchFn, course.id)),
  );
  if (outcomes.some((outcome) => outcome.kind === "unauthenticated")) {
    return { outcome: "UNAUTHENTICATED" };
  }

  return {
    outcome: "READY",
    courses: learnerCourses.map((course, index) => ({
      id: course.id,
      title: course.title,
      progress: outcomes[index] as CourseProgress,
    })),
  };
}
