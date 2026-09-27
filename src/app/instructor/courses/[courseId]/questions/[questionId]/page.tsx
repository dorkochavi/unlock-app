"use client";

/**
 * Instructor Question draft editor (Run 006 S4) — a dedicated page, kept
 * separate from `/instructor/courses/[courseId]` (the Plan explicitly
 * allows this: "A separate Question edit route/page is allowed if it makes
 * the Course page materially simpler"). Consumes the S2/S3 authoring API
 * (`GET/PATCH .../questions/:questionId`).
 *
 * Important UX rule (CHATGPT_PLAN.md S4): saving a draft is never presented
 * as making it live for learners — a notice is shown whenever there is
 * pending draft content, worded distinctly for a never-published draft
 * (`draftNoticeNeverPublished`: learners see nothing yet) versus an edited
 * already-published Question (`draftNoticePendingChanges`: learners still
 * see the OLD published version). There is no Publish action anywhere on
 * this page (Run 006 S5 scope).
 *
 * When the Question has no pending draft (`state === "PUBLISHED"`), the
 * form is seeded from `publishedContent` (the current QuestionVersion's own
 * content) rather than the empty `draft` fields, so "reopen/edit" shows the
 * instructor what is actually published, not a blank form.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { Input, Label, Select, Textarea } from "@/components/input";
import { LoadingState, StateBlock } from "@/components/state-block";
import { getMessages } from "@/messages";
import type { CourseStatus } from "@/domain/course/types";

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
type QuestionAuthoringState = "DRAFT_ONLY" | "PUBLISHED" | "PUBLISHED_WITH_DRAFT_CHANGES";

interface AnswerOptionDto {
  id: string;
  content: string;
}

interface QuestionDraftContentDto {
  questionType: QuestionType | null;
  prompt: string | null;
  answerOptions: AnswerOptionDto[] | null;
  correctOptionIds: string[] | null;
  explanation: string | null;
}

interface QuestionAuthoringDto {
  id: string;
  courseId: string;
  topicId: string | null;
  state: QuestionAuthoringState;
  draft: QuestionDraftContentDto;
  createdAt: string;
  updatedAt: string;
}

interface TopicDto {
  id: string;
  courseId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface TopicSummaryDto {
  id: string;
  name: string;
  archivedAt: string | null;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "notFound" }
  | { kind: "notAuthorized" }
  | { kind: "error" }
  | {
      kind: "ready";
      question: QuestionAuthoringDto;
      courseStatus: CourseStatus;
      topics: TopicDto[];
      /** The associated Topic's own record, resolved regardless of archived state (Run 006 S1 decision #10) — `null` only when no Topic is associated. */
      associatedTopic: TopicSummaryDto | null;
    };

async function fetchQuestion(
  courseId: string,
  questionId: string,
): Promise<
  | {
      outcome: "READY";
      question: QuestionAuthoringDto;
      publishedContent: QuestionDraftContentDto | null;
      topic: TopicSummaryDto | null;
    }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "NOT_FOUND" }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "ERROR" }
> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/questions/${questionId}`);
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) return { outcome: "UNAUTHENTICATED" };
  if (response.status === 404) return { outcome: "NOT_FOUND" };
  if (response.status === 403) return { outcome: "NOT_AUTHORIZED" };
  if (!response.ok) return { outcome: "ERROR" };
  try {
    const body = (await response.json()) as {
      question: QuestionAuthoringDto;
      publishedContent: QuestionDraftContentDto | null;
      topic: TopicSummaryDto | null;
    };
    return {
      outcome: "READY",
      question: body.question,
      publishedContent: body.publishedContent,
      topic: body.topic,
    };
  } catch {
    return { outcome: "ERROR" };
  }
}

async function fetchCourseStatus(
  courseId: string,
): Promise<{ outcome: "READY"; status: CourseStatus } | { outcome: "ERROR" }> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/manage`);
  } catch {
    return { outcome: "ERROR" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  try {
    const body = (await response.json()) as { course: { status: CourseStatus } };
    return { outcome: "READY", status: body.course.status };
  } catch {
    return { outcome: "ERROR" };
  }
}

async function fetchTopicsList(
  courseId: string,
): Promise<{ outcome: "READY"; topics: TopicDto[] } | { outcome: "ERROR" }> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/topics`);
  } catch {
    return { outcome: "ERROR" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  try {
    const body = (await response.json()) as { topics: TopicDto[] };
    return { outcome: "READY", topics: body.topics };
  } catch {
    return { outcome: "ERROR" };
  }
}

function generateOptionId(): string {
  // crypto.randomUUID() is available in every browser this app targets.
  return crypto.randomUUID();
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}

export default function InstructorQuestionEditorPage() {
  const messages = getMessages();
  const params = useParams<{ courseId: string; questionId: string }>();
  const courseId = String(params.courseId);
  const questionId = String(params.questionId);

  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  const [topicIdDraft, setTopicIdDraft] = useState<string>("");
  const [questionTypeDraft, setQuestionTypeDraft] = useState<QuestionType>("SINGLE_CHOICE");
  const [promptDraft, setPromptDraft] = useState("");
  const [optionsDraft, setOptionsDraft] = useState<AnswerOptionDto[]>([]);
  const [correctOptionIdsDraft, setCorrectOptionIdsDraft] = useState<string[]>([]);
  const [explanationDraft, setExplanationDraft] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState({ kind: "loading" });
      const [questionResult, courseResult, topicsResult] = await Promise.all([
        fetchQuestion(courseId, questionId),
        fetchCourseStatus(courseId),
        fetchTopicsList(courseId),
      ]);
      if (cancelled) return;

      if (questionResult.outcome === "UNAUTHENTICATED") {
        setState({ kind: "signed-out" });
        return;
      }
      if (questionResult.outcome === "NOT_FOUND") {
        setState({ kind: "notFound" });
        return;
      }
      if (questionResult.outcome === "NOT_AUTHORIZED") {
        setState({ kind: "notAuthorized" });
        return;
      }
      if (questionResult.outcome === "ERROR" || courseResult.outcome === "ERROR" || topicsResult.outcome === "ERROR") {
        setState({ kind: "error" });
        return;
      }

      const { question, publishedContent, topic } = questionResult;
      setState({
        kind: "ready",
        question,
        courseStatus: courseResult.status,
        topics: topicsResult.topics,
        associatedTopic: topic,
      });

      // Seed the form from pending draft content when there is any;
      // otherwise from the current published version (so "reopen/edit"
      // shows real content, not a blank form) — never both.
      const effective = question.state === "PUBLISHED" ? publishedContent : question.draft;
      setTopicIdDraft(question.topicId ?? "");
      setQuestionTypeDraft(effective?.questionType ?? "SINGLE_CHOICE");
      setPromptDraft(effective?.prompt ?? "");
      setOptionsDraft(effective?.answerOptions ?? []);
      setCorrectOptionIdsDraft(effective?.correctOptionIds ?? []);
      setExplanationDraft(effective?.explanation ?? "");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, questionId, retryCount]);

  function handleAddOption() {
    setOptionsDraft((previous) => [...previous, { id: generateOptionId(), content: "" }]);
  }

  function handleOptionContentChange(optionId: string, content: string) {
    setOptionsDraft((previous) =>
      previous.map((option) => (option.id === optionId ? { ...option, content } : option)),
    );
  }

  function handleRemoveOption(optionId: string) {
    setOptionsDraft((previous) => previous.filter((option) => option.id !== optionId));
    setCorrectOptionIdsDraft((previous) => previous.filter((id) => id !== optionId));
  }

  function handleQuestionTypeChange(nextType: QuestionType) {
    setQuestionTypeDraft(nextType);
    if (nextType === "SINGLE_CHOICE") {
      setCorrectOptionIdsDraft((previous) => (previous.length > 1 ? previous.slice(0, 1) : previous));
    }
  }

  function handleToggleCorrect(optionId: string) {
    if (questionTypeDraft === "SINGLE_CHOICE") {
      setCorrectOptionIdsDraft([optionId]);
      return;
    }
    setCorrectOptionIdsDraft((previous) =>
      previous.includes(optionId) ? previous.filter((id) => id !== optionId) : [...previous, optionId],
    );
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: topicIdDraft === "" ? null : topicIdDraft,
          questionType: questionTypeDraft,
          prompt: promptDraft,
          answerOptions: optionsDraft,
          correctOptionIds: correctOptionIdsDraft,
          explanation: explanationDraft.trim() === "" ? null : explanationDraft,
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setSaveError(messages.questionEditor.topicArchivedError);
          return;
        }
        if (response.status === 404) {
          setSaveError(messages.questionEditor.topicNotFoundError);
          return;
        }
        try {
          const body = (await response.json()) as { error?: { code?: string; message?: string } };
          if (body.error?.code === "INVALID_DRAFT" && body.error.message) {
            setSaveError(interpolate(messages.questionEditor.invalidDraftError, { message: body.error.message }));
            return;
          }
        } catch {
          // fall through to the generic error below
        }
        setSaveError(messages.questionEditor.saveError);
        return;
      }

      const body = (await response.json()) as { question: QuestionAuthoringDto };
      setState((previous) => (previous.kind === "ready" ? { ...previous, question: body.question } : previous));
      setSavedAt(Date.now());
    } catch {
      setSaveError(messages.questionEditor.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (publishing) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/questions/${questionId}/publish`, {
        method: "POST",
      });

      if (!response.ok) {
        if (response.status === 409) {
          try {
            const body = (await response.json()) as { error?: { code?: string } };
            if (body.error?.code === "COURSE_ARCHIVED") {
              setPublishError(messages.questionEditor.publishCourseArchivedError);
              return;
            }
            if (body.error?.code === "NOTHING_TO_PUBLISH") {
              setPublishError(messages.questionEditor.publishNothingToPublishError);
              return;
            }
          } catch {
            // fall through to the generic error below
          }
          setPublishError(messages.questionEditor.publishError);
          return;
        }
        if (response.status === 400) {
          try {
            const body = (await response.json()) as { error?: { code?: string; reason?: string } };
            if (body.error?.code === "NOT_READY" && body.error.reason) {
              setPublishError(
                interpolate(messages.questionEditor.publishNotReadyError, { reason: body.error.reason }),
              );
              return;
            }
          } catch {
            // fall through to the generic error below
          }
        }
        setPublishError(messages.questionEditor.publishError);
        return;
      }

      const body = (await response.json()) as { question: QuestionAuthoringDto };
      setState((previous) => (previous.kind === "ready" ? { ...previous, question: body.question } : previous));
      setPublishedAt(Date.now());
    } catch {
      setPublishError(messages.questionEditor.publishError);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:max-w-3xl">
      {state.kind === "loading" ? <LoadingState label={messages.questionEditor.loading} /> : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={messages.questionEditor.signedOutTitle}
          action={<ButtonLink href="/login">{messages.questionEditor.signedOutAction}</ButtonLink>}
        />
      ) : null}

      {state.kind === "notFound" ? (
        <StateBlock title={messages.questionEditor.notFoundTitle} body={messages.questionEditor.notFoundBody} />
      ) : null}

      {state.kind === "notAuthorized" ? (
        <StateBlock
          title={messages.questionEditor.notAuthorizedTitle}
          body={messages.questionEditor.notAuthorizedBody}
        />
      ) : null}

      {state.kind === "error" ? (
        <StateBlock
          tone="error"
          title={messages.questionEditor.genericErrorTitle}
          action={
            <Button variant="secondary" onClick={() => setRetryCount((count) => count + 1)}>
              {messages.questionEditor.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" ? (
        <div className="flex flex-col gap-4">
          <Link
            href={`/instructor/courses/${courseId}`}
            className="text-sm text-subtle underline-offset-4 hover:text-foreground hover:underline"
          >
            {messages.questionEditor.backToCourse}
          </Link>

          <p className="text-sm text-muted">{messages.questionEditor.stateLabel[state.question.state]}</p>

          {state.courseStatus === "ARCHIVED" ? (
            <p className="rounded-lg border border-border p-3 text-sm text-muted">
              {messages.questionEditor.archivedNotice}
            </p>
          ) : null}

          {/* No dedicated "informational notice" token exists; reusing the amber
              state-reinforce role here (same visual semantic as NEEDS_REINFORCEMENT
              — a pending, not-yet-final state) rather than a raw amber-* color. */}
          {state.question.state === "DRAFT_ONLY" ? (
            <p className="rounded-lg border border-state-reinforce/30 bg-state-reinforce-soft p-3 text-sm text-state-reinforce">
              {messages.questionEditor.draftNoticeNeverPublished}
            </p>
          ) : null}
          {state.question.state === "PUBLISHED_WITH_DRAFT_CHANGES" ? (
            <p className="rounded-lg border border-state-reinforce/30 bg-state-reinforce-soft p-3 text-sm text-state-reinforce">
              {messages.questionEditor.draftNoticePendingChanges}
            </p>
          ) : null}

          <fieldset disabled={state.courseStatus === "ARCHIVED"} className="disabled:opacity-60">
            <Card as="section">
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <label className="block">
                  <Label>{messages.questionEditor.topicLabel}</Label>
                  <Select value={topicIdDraft} onChange={(event) => setTopicIdDraft(event.target.value)}>
                    <option value="">{messages.questionEditor.topicPlaceholder}</option>
                    {/* The currently-associated Topic may be archived (Run 006 S1 decision #10: no forced
                        reassociation) and therefore absent from `state.topics` (active-only) — shown here
                        explicitly so the select never silently renders a real association as unset. */}
                    {state.associatedTopic !== null &&
                    !state.topics.some((topic) => topic.id === state.associatedTopic!.id) ? (
                      <option value={state.associatedTopic.id}>
                        {state.associatedTopic.name}
                        {state.associatedTopic.archivedAt !== null
                          ? messages.questionEditor.topicArchivedSuffix
                          : ""}
                      </option>
                    ) : null}
                    {state.topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="block">
                  <Label>{messages.questionEditor.typeLabel}</Label>
                  <Select
                    value={questionTypeDraft}
                    onChange={(event) => handleQuestionTypeChange(event.target.value as QuestionType)}
                  >
                    <option value="SINGLE_CHOICE">{messages.questionEditor.typeOption.SINGLE_CHOICE}</option>
                    <option value="MULTIPLE_CHOICE">{messages.questionEditor.typeOption.MULTIPLE_CHOICE}</option>
                  </Select>
                </label>

                <label className="block">
                  <Label>{messages.questionEditor.promptLabel}</Label>
                  <Textarea
                    value={promptDraft}
                    onChange={(event) => setPromptDraft(event.target.value)}
                    placeholder={messages.questionEditor.promptPlaceholder}
                    rows={3}
                  />
                </label>

                <div>
                  <Label>{messages.questionEditor.optionsHeading}</Label>
                  <ul className="flex flex-col gap-2">
                    {optionsDraft.map((option) => (
                      <li key={option.id} className="flex items-center gap-2">
                        <input
                          type={questionTypeDraft === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                          name="correctOption"
                          checked={correctOptionIdsDraft.includes(option.id)}
                          onChange={() => handleToggleCorrect(option.id)}
                          aria-label={
                            questionTypeDraft === "SINGLE_CHOICE"
                              ? messages.questionEditor.correctSingleLabel
                              : messages.questionEditor.correctMultipleLabel
                          }
                        />
                        <Input
                          type="text"
                          value={option.content}
                          onChange={(event) => handleOptionContentChange(option.id, event.target.value)}
                          placeholder={messages.questionEditor.optionContentPlaceholder}
                          className="min-w-0 flex-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(option.id)}
                          className="shrink-0 text-sm text-danger underline-offset-4 hover:underline"
                        >
                          {messages.questionEditor.removeOptionAction}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button variant="secondary" onClick={handleAddOption} className="mt-2">
                    {messages.questionEditor.addOptionAction}
                  </Button>
                </div>

                <label className="block">
                  <Label>{messages.questionEditor.explanationLabel}</Label>
                  <Textarea
                    value={explanationDraft}
                    onChange={(event) => setExplanationDraft(event.target.value)}
                    placeholder={messages.questionEditor.explanationPlaceholder}
                    rows={2}
                  />
                </label>

                {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
                {!saveError && savedAt !== null ? (
                  <p className="text-sm text-state-solid">{messages.questionEditor.saveSuccess}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  {/* Save is a local form action, not the page-level primary (UX_SPEC §11 item 3) —
                      Publish/Re-publish carries that weight below when it is available. */}
                  <Button variant="secondary" type="submit" disabled={saving}>
                    {saving ? messages.questionEditor.saving : messages.questionEditor.saveAction}
                  </Button>

                  {/* Publish/Re-publish: only when there is real pending content to publish
                      (DRAFT_ONLY or PUBLISHED_WITH_DRAFT_CHANGES) — a plain PUBLISHED Question
                      has nothing pending (Run 006 S3's own forward note, resolved server-side
                      by S5's NOTHING_TO_PUBLISH outcome; this hides the action for that case
                      rather than relying only on the server to reject it). */}
                  {state.question.state !== "PUBLISHED" ? (
                    <Button onClick={handlePublish} disabled={publishing}>
                      {publishing
                        ? messages.questionEditor.publishing
                        : state.question.state === "DRAFT_ONLY"
                          ? messages.questionEditor.publishAction
                          : messages.questionEditor.republishAction}
                    </Button>
                  ) : null}
                </div>

                {publishError ? <p className="text-sm text-danger">{publishError}</p> : null}
                {!publishError && publishedAt !== null ? (
                  <p className="text-sm text-state-solid">{messages.questionEditor.publishSuccess}</p>
                ) : null}
              </form>
            </Card>
          </fieldset>
        </div>
      ) : null}
    </main>
  );
}
