/**
 * getCourseTopicInsights — Run 009 S3. Topic-level descriptive first-answer
 * Insights for an authorized OWNER/active INSTRUCTOR of one PUBLISHED
 * Course, under the same F-02 privacy contract as Item Analysis.
 *
 * ## Evidence
 * Pooled first accepted Attempt per learner per CURRENT QuestionVersion over
 * the current published Questions of a Topic (Topic is CURRENT-derived,
 * `questions.topic_id`; Plan D6). Intentionally attempt/question weighted:
 * no per-learner Topic normalization in V1.
 *
 * ## Buckets
 * One entry per Topic that has current published Questions — including an
 * archived Topic (flagged `archived: true`, never collapsed into another
 * bucket) — plus a `topicId: null` "no Topic" bucket when published Questions
 * genuinely have no Topic (never silently dropped). Structure only: which
 * buckets exist reveals content organization, not learner data.
 *
 * ## Disclosure
 * Same rule as Item Analysis (>= 5 active LEARNERs in the Course AND >= 5
 * distinct responders in the Topic). Not eligible => `INSUFFICIENT_DATA` and
 * `band: null`. Counts stay inside this function; only the coarse band
 * leaves. Authorization/Course state: `checkAnalysisAccess`.
 */
import { deriveAnswerBand, type AnswerBand } from "../../domain/insights/answer-band";
import {
  decideAggregateDisclosure,
  toPublicDisclosure,
  type PublicDisclosure,
} from "../../domain/insights/aggregate-disclosure";
import { checkAnalysisAccess } from "./analysis-access";
import type { ItemAnalysisRepositories } from "./ports";

export interface GetCourseTopicInsightsCommand {
  actorUserId: string;
  courseId: string;
  /** Explicit read instant, echoed back for the "last updated" display. */
  now: Date;
}

export interface TopicInsight {
  /** Null = the "no Topic" bucket. */
  topicId: string | null;
  /** Null = the "no Topic" bucket (the UI supplies the neutral label). */
  name: string | null;
  archived: boolean;
  disclosure: PublicDisclosure;
  /** Non-null only when `disclosure === "ELIGIBLE"`. */
  band: AnswerBand | null;
}

export type GetCourseTopicInsightsResult =
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_ACTIVE" }
  | { outcome: "READY"; generatedAt: Date; topics: TopicInsight[] };

export async function getCourseTopicInsights(
  command: GetCourseTopicInsightsCommand,
  repos: ItemAnalysisRepositories,
): Promise<GetCourseTopicInsightsResult> {
  const access = await checkAnalysisAccess(command.actorUserId, command.courseId, repos);
  if (access !== "ALLOWED") {
    return { outcome: access };
  }

  const [activeLearnerCount, rows] = await Promise.all([
    repos.itemAnalysis.countActiveLearners(command.courseId),
    repos.itemAnalysis.listTopicFirstAttemptStats(command.courseId),
  ]);

  const topics: TopicInsight[] = rows.map((row) => {
    const disclosure = toPublicDisclosure(
      decideAggregateDisclosure({
        activeLearnerCount,
        distinctResponderCount: row.distinctResponderCount,
      }),
    );
    return {
      topicId: row.topicId,
      name: row.topicName,
      archived: row.topicArchived,
      disclosure,
      band:
        disclosure === "ELIGIBLE"
          ? deriveAnswerBand(row.correctAttemptCount, row.firstAttemptCount)
          : null,
    };
  });

  return { outcome: "READY", generatedAt: command.now, topics };
}
