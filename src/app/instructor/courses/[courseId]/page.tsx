"use client";

/**
 * Instructor Course manage page (Run 005 S3) — the "narrowest coherent
 * instructor workspace" for one Course: edit title/exam date, edit join
 * policy, publish, archive, and (once PUBLISHED) copy the learner join link.
 * Consumes the S2 authoring API (`GET/PATCH .../manage`,
 * `POST .../publish`, `POST .../archive`) plus this Slice's new
 * `PATCH .../join-policy`.
 *
 * Publishing/archiving are explicit, separate actions from the metadata
 * save — "Do not auto-publish a Course merely because it was created" (Run
 * 005 S3) applies just as much to editing: saving title/exam date never
 * changes `status`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { Input, Label, Select } from "@/components/input";
import { PageHeader } from "@/components/page-header";
import { SkeletonRows } from "@/components/skeleton";
import { LoadingState, StateBlock } from "@/components/state-block";
import { getMessages } from "@/messages";
import { canSelfJoinCourse, type CourseJoinPolicy, type CourseStatus } from "@/domain/course/types";
import { canOpenAnswerAnalysis } from "@/domain/insights/analysis-entry";

interface CourseAuthoringDto {
  id: string;
  title: string;
  status: CourseStatus;
  joinPolicy: CourseJoinPolicy;
  examDate: string | null;
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

type QuestionAuthoringState = "DRAFT_ONLY" | "PUBLISHED" | "PUBLISHED_WITH_DRAFT_CHANGES";

interface QuestionAuthoringDto {
  id: string;
  courseId: string;
  topicId: string | null;
  state: QuestionAuthoringState;
  draft: {
    questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | null;
    prompt: string | null;
    answerOptions: { id: string; content: string }[] | null;
    correctOptionIds: string[] | null;
    explanation: string | null;
  };
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
  | { kind: "ready"; course: CourseAuthoringDto };

type TopicsState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; topics: TopicDto[] };

type QuestionsState =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      questions: QuestionAuthoringDto[];
      publishedPromptByQuestionId: Record<string, string>;
      topicById: Record<string, TopicSummaryDto>;
    };

async function fetchCourseForAuthoring(
  courseId: string,
): Promise<
  | { outcome: "READY"; course: CourseAuthoringDto }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "NOT_FOUND" }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "ERROR" }
> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/manage`);
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) return { outcome: "UNAUTHENTICATED" };
  if (response.status === 404) return { outcome: "NOT_FOUND" };
  if (response.status === 403) return { outcome: "NOT_AUTHORIZED" };
  if (!response.ok) return { outcome: "ERROR" };
  try {
    const body = (await response.json()) as { course: CourseAuthoringDto };
    return { outcome: "READY", course: body.course };
  } catch {
    return { outcome: "ERROR" };
  }
}

async function fetchTopics(
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

async function fetchQuestions(
  courseId: string,
): Promise<
  | {
      outcome: "READY";
      questions: QuestionAuthoringDto[];
      publishedPromptByQuestionId: Record<string, string>;
      topicById: Record<string, TopicSummaryDto>;
    }
  | { outcome: "ERROR" }
> {
  let response: Response;
  try {
    response = await fetch(`/api/courses/${courseId}/questions`);
  } catch {
    return { outcome: "ERROR" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  try {
    const body = (await response.json()) as {
      questions: QuestionAuthoringDto[];
      publishedPromptByQuestionId: Record<string, string>;
      topicById: Record<string, TopicSummaryDto>;
    };
    return {
      outcome: "READY",
      questions: body.questions,
      publishedPromptByQuestionId: body.publishedPromptByQuestionId,
      topicById: body.topicById,
    };
  } catch {
    return { outcome: "ERROR" };
  }
}

export default function InstructorCourseManagePage() {
  const messages = getMessages();
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const courseId = String(params.courseId);

  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  const [titleDraft, setTitleDraft] = useState("");
  const [examDateDraft, setExamDateDraft] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSavedAt, setDetailsSavedAt] = useState<number | null>(null);

  const [savingJoinPolicy, setSavingJoinPolicy] = useState(false);
  const [joinPolicyError, setJoinPolicyError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);

  const [topicsState, setTopicsState] = useState<TopicsState>({ kind: "loading" });
  const [topicsRetryCount, setTopicsRetryCount] = useState(0);
  const [newTopicName, setNewTopicName] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);
  const [addTopicError, setAddTopicError] = useState<string | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [archivingTopicId, setArchivingTopicId] = useState<string | null>(null);
  const [archiveTopicError, setArchiveTopicError] = useState<string | null>(null);

  const [questionsState, setQuestionsState] = useState<QuestionsState>({ kind: "loading" });
  const [questionsRetryCount, setQuestionsRetryCount] = useState(0);
  const [creatingQuestion, setCreatingQuestion] = useState(false);
  const [createQuestionError, setCreateQuestionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await fetchCourseForAuthoring(courseId);
      if (cancelled) return;
      switch (result.outcome) {
        case "UNAUTHENTICATED":
          setState({ kind: "signed-out" });
          return;
        case "NOT_FOUND":
          setState({ kind: "notFound" });
          return;
        case "NOT_AUTHORIZED":
          setState({ kind: "notAuthorized" });
          return;
        case "ERROR":
          setState({ kind: "error" });
          return;
        case "READY":
          setState({ kind: "ready", course: result.course });
          setTitleDraft(result.course.title);
          setExamDateDraft(result.course.examDate ?? "");
          return;
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, retryCount]);

  useEffect(() => {
    if (state.kind !== "ready") return;
    let cancelled = false;

    async function run() {
      setTopicsState({ kind: "loading" });
      const result = await fetchTopics(courseId);
      if (cancelled) return;
      setTopicsState(
        result.outcome === "READY" ? { kind: "ready", topics: result.topics } : { kind: "error" },
      );
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, state.kind === "ready", topicsRetryCount]);

  useEffect(() => {
    if (state.kind !== "ready") return;
    let cancelled = false;

    async function run() {
      setQuestionsState({ kind: "loading" });
      const result = await fetchQuestions(courseId);
      if (cancelled) return;
      setQuestionsState(
        result.outcome === "READY"
          ? {
              kind: "ready",
              questions: result.questions,
              publishedPromptByQuestionId: result.publishedPromptByQuestionId,
              topicById: result.topicById,
            }
          : { kind: "error" },
      );
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, state.kind === "ready", questionsRetryCount]);

  async function handleCreateQuestion() {
    if (creatingQuestion) return;
    setCreatingQuestion(true);
    setCreateQuestionError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/questions`, { method: "POST" });
      if (!response.ok) {
        setCreateQuestionError(messages.instructor.manage.questions.createError);
        return;
      }
      const body = (await response.json()) as { question: QuestionAuthoringDto };
      router.push(`/instructor/courses/${courseId}/questions/${body.question.id}`);
    } catch {
      setCreateQuestionError(messages.instructor.manage.questions.createError);
    } finally {
      setCreatingQuestion(false);
    }
  }

  async function handleAddTopic(event: React.FormEvent) {
    event.preventDefault();
    if (addingTopic) return;
    setAddingTopic(true);
    setAddTopicError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTopicName }),
      });
      if (!response.ok) {
        setAddTopicError(messages.instructor.manage.topics.addError);
        return;
      }
      const body = (await response.json()) as { topic: TopicDto };
      setTopicsState((previous) =>
        previous.kind === "ready"
          ? { kind: "ready", topics: [...previous.topics, body.topic] }
          : { kind: "ready", topics: [body.topic] },
      );
      setNewTopicName("");
    } catch {
      setAddTopicError(messages.instructor.manage.topics.addError);
    } finally {
      setAddingTopic(false);
    }
  }

  function handleStartRename(topic: TopicDto) {
    setEditingTopicId(topic.id);
    setRenameDraft(topic.name);
    setRenameError(null);
  }

  function handleCancelRename() {
    setEditingTopicId(null);
    setRenameError(null);
  }

  async function handleSaveRename(topicId: string) {
    if (savingTopicId !== null) return;
    setSavingTopicId(topicId);
    setRenameError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameDraft }),
      });
      if (!response.ok) {
        setRenameError(messages.instructor.manage.topics.renameError);
        return;
      }
      const body = (await response.json()) as { topic: TopicDto };
      setTopicsState((previous) =>
        previous.kind === "ready"
          ? { kind: "ready", topics: previous.topics.map((t) => (t.id === topicId ? body.topic : t)) }
          : previous,
      );
      setEditingTopicId(null);
    } catch {
      setRenameError(messages.instructor.manage.topics.renameError);
    } finally {
      setSavingTopicId(null);
    }
  }

  async function handleArchiveTopic(topicId: string) {
    if (archivingTopicId !== null) return;
    if (!window.confirm(messages.instructor.manage.topics.archiveConfirm)) return;
    setArchivingTopicId(topicId);
    setArchiveTopicError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/topics/${topicId}/archive`, {
        method: "POST",
      });
      if (!response.ok) {
        setArchiveTopicError(messages.instructor.manage.topics.archiveError);
        return;
      }
      setTopicsState((previous) =>
        previous.kind === "ready"
          ? { kind: "ready", topics: previous.topics.filter((t) => t.id !== topicId) }
          : previous,
      );
    } catch {
      setArchiveTopicError(messages.instructor.manage.topics.archiveError);
    } finally {
      setArchivingTopicId(null);
    }
  }

  async function handleSaveDetails(event: React.FormEvent) {
    event.preventDefault();
    if (savingDetails) return;
    setSavingDetails(true);
    setDetailsError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/manage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleDraft,
          examDate: examDateDraft === "" ? null : examDateDraft,
        }),
      });
      if (!response.ok) {
        setDetailsError(messages.instructor.manage.saveError);
        return;
      }
      const body = (await response.json()) as { course: CourseAuthoringDto };
      setState({ kind: "ready", course: body.course });
      setTitleDraft(body.course.title);
      setExamDateDraft(body.course.examDate ?? "");
      setDetailsSavedAt(Date.now());
    } catch {
      setDetailsError(messages.instructor.manage.saveError);
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleJoinPolicyChange(joinPolicy: CourseJoinPolicy) {
    if (savingJoinPolicy) return;
    setSavingJoinPolicy(true);
    setJoinPolicyError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/join-policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinPolicy }),
      });
      if (!response.ok) {
        setJoinPolicyError(messages.instructor.manage.saveError);
        return;
      }
      setState((previous) =>
        previous.kind === "ready" ? { ...previous, course: { ...previous.course, joinPolicy } } : previous,
      );
    } catch {
      setJoinPolicyError(messages.instructor.manage.saveError);
    } finally {
      setSavingJoinPolicy(false);
    }
  }

  async function handlePublish() {
    if (publishing) return;
    setPublishing(true);
    setTransitionError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/publish`, { method: "POST" });
      if (!response.ok) {
        setTransitionError(messages.instructor.manage.transitionError);
        return;
      }
      const body = (await response.json()) as { course: CourseAuthoringDto };
      setState({ kind: "ready", course: body.course });
    } catch {
      setTransitionError(messages.instructor.manage.transitionError);
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    if (archiving) return;
    if (!window.confirm(messages.instructor.manage.archiveConfirm)) return;
    setArchiving(true);
    setTransitionError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/archive`, { method: "POST" });
      if (!response.ok) {
        setTransitionError(messages.instructor.manage.transitionError);
        return;
      }
      const body = (await response.json()) as { course: CourseAuthoringDto };
      setState({ kind: "ready", course: body.course });
    } catch {
      setTransitionError(messages.instructor.manage.transitionError);
    } finally {
      setArchiving(false);
    }
  }

  async function handleCopyLink(joinUrl: string) {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard access may be unavailable (permissions/insecure context) —
      // the URL text remains visible and selectable regardless.
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
      {state.kind === "loading" ? <LoadingState label={messages.instructor.manage.loading} /> : null}

      {state.kind === "signed-out" ? (
        <StateBlock
          title={messages.instructor.manage.signedOutTitle}
          action={<ButtonLink href="/login">{messages.instructor.manage.signedOutAction}</ButtonLink>}
        />
      ) : null}

      {state.kind === "notFound" ? (
        <StateBlock
          title={messages.instructor.manage.notFoundTitle}
          body={messages.instructor.manage.notFoundBody}
        />
      ) : null}

      {state.kind === "notAuthorized" ? (
        <StateBlock
          title={messages.instructor.manage.notAuthorizedTitle}
          body={messages.instructor.manage.notAuthorizedBody}
        />
      ) : null}

      {state.kind === "error" ? (
        <StateBlock
          tone="error"
          title={messages.instructor.manage.genericErrorTitle}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
            >
              {messages.instructor.manage.retry}
            </Button>
          }
        />
      ) : null}

      {state.kind === "ready" ? (
        <div className="flex flex-col gap-6">
          <PageHeader
            title={state.course.title}
            subtitle={messages.instructor.manage.statusLabel[state.course.status]}
          />

          <Card as="section">
            <form onSubmit={handleSaveDetails} className="flex flex-col gap-4">
              <label className="block">
                <Label>{messages.instructor.manage.titleLabel}</Label>
                <Input
                  type="text"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  disabled={state.course.status === "ARCHIVED"}
                  required
                />
              </label>

              <label className="block">
                <Label>{messages.instructor.manage.examDateLabel}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={examDateDraft}
                    onChange={(event) => setExamDateDraft(event.target.value)}
                    disabled={state.course.status === "ARCHIVED"}
                  />
                  {examDateDraft !== "" && state.course.status !== "ARCHIVED" ? (
                    <button
                      type="button"
                      onClick={() => setExamDateDraft("")}
                      className="shrink-0 text-sm text-subtle underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {messages.instructor.manage.clearExamDate}
                    </button>
                  ) : null}
                </div>
              </label>

              {detailsError ? <p className="text-sm text-danger">{detailsError}</p> : null}
              {!detailsError && detailsSavedAt !== null ? (
                <p className="text-sm text-state-solid">{messages.instructor.manage.saveSuccess}</p>
              ) : null}

              <div>
                <Button type="submit" disabled={savingDetails || state.course.status === "ARCHIVED"}>
                  {savingDetails ? messages.instructor.manage.saving : messages.instructor.manage.saveAction}
                </Button>
              </div>
            </form>
          </Card>

          <Card as="section">
            <label className="block">
              <Label>{messages.instructor.manage.joinPolicyLabel}</Label>
              <Select
                value={state.course.joinPolicy}
                disabled={savingJoinPolicy || state.course.status === "ARCHIVED"}
                onChange={(event) => handleJoinPolicyChange(event.target.value as CourseJoinPolicy)}
              >
                <option value="AUTHORIZED_ONLY">
                  {messages.instructor.manage.joinPolicyOption.AUTHORIZED_ONLY}
                </option>
                <option value="OPEN">{messages.instructor.manage.joinPolicyOption.OPEN}</option>
              </Select>
            </label>
            {joinPolicyError ? <p className="mt-3 text-sm text-danger">{joinPolicyError}</p> : null}
          </Card>

          <Card as="section">
            <h2 className="mb-3 text-lg font-semibold">{messages.instructor.manage.topics.heading}</h2>

            {topicsState.kind === "loading" ? (
              <SkeletonRows count={2} label={messages.instructor.manage.topics.loading} rowClassName="h-11 w-full" />
            ) : null}

            {topicsState.kind === "error" ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-danger">{messages.instructor.manage.topics.genericError}</p>
                <Button variant="secondary" onClick={() => setTopicsRetryCount((count) => count + 1)}>
                  {messages.instructor.manage.retry}
                </Button>
              </div>
            ) : null}

            {topicsState.kind === "ready" ? (
              <>
                {topicsState.topics.length === 0 ? (
                  <p className="mb-3 text-sm text-muted">{messages.instructor.manage.topics.emptyTitle}</p>
                ) : (
                  <ul className="mb-4 flex flex-col gap-2">
                    {topicsState.topics.map((topic) => (
                      <li
                        key={topic.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        {editingTopicId === topic.id ? (
                          <>
                            <input
                              type="text"
                              value={renameDraft}
                              onChange={(event) => setRenameDraft(event.target.value)}
                              className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              autoFocus
                            />
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveRename(topic.id)}
                                disabled={savingTopicId === topic.id}
                                className="text-sm font-medium text-foreground disabled:opacity-50"
                              >
                                {messages.instructor.manage.topics.renameSave}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelRename}
                                className="text-sm text-subtle"
                              >
                                {messages.instructor.manage.topics.renameCancel}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="min-w-0 truncate text-sm" title={topic.name}>
                              {topic.name}
                            </span>
                            <div className="flex shrink-0 gap-3">
                              <button
                                type="button"
                                onClick={() => handleStartRename(topic)}
                                className="text-sm text-subtle underline-offset-4 hover:text-foreground hover:underline"
                              >
                                {messages.instructor.manage.topics.renameAction}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleArchiveTopic(topic.id)}
                                disabled={archivingTopicId === topic.id}
                                className="text-sm text-danger underline-offset-4 hover:underline disabled:opacity-50"
                              >
                                {archivingTopicId === topic.id
                                  ? messages.instructor.manage.topics.archiving
                                  : messages.instructor.manage.topics.archiveAction}
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {renameError ? <p className="mb-2 text-sm text-danger">{renameError}</p> : null}
                {archiveTopicError ? <p className="mb-2 text-sm text-danger">{archiveTopicError}</p> : null}

                <form onSubmit={handleAddTopic} className="flex gap-2">
                  <Input
                    type="text"
                    value={newTopicName}
                    onChange={(event) => setNewTopicName(event.target.value)}
                    placeholder={messages.instructor.manage.topics.addPlaceholder}
                    className="min-w-0 flex-1 text-sm"
                    required
                  />
                  <Button variant="secondary" type="submit" disabled={addingTopic} className="shrink-0">
                    {addingTopic ? messages.instructor.manage.topics.adding : messages.instructor.manage.topics.addAction}
                  </Button>
                </form>
                {addTopicError ? <p className="mt-2 text-sm text-danger">{addTopicError}</p> : null}
              </>
            ) : null}
          </Card>

          <Card as="section">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{messages.instructor.manage.questions.heading}</h2>
              <div className="flex shrink-0 items-center gap-4">
                {canOpenAnswerAnalysis(state.course.status) ? (
                  <Link
                    href={`/instructor/courses/${courseId}/item-analysis`}
                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {messages.instructor.manage.questions.itemAnalysisAction}
                  </Link>
                ) : null}
                <Link
                  href={`/instructor/courses/${courseId}/import`}
                  className="text-sm text-subtle underline-offset-4 hover:text-foreground hover:underline"
                >
                  {messages.instructor.manage.questions.importAction}
                </Link>
              </div>
            </div>

            {questionsState.kind === "loading" ? (
              <SkeletonRows
                count={3}
                label={messages.instructor.manage.questions.loading}
                rowClassName="h-14 w-full"
              />
            ) : null}

            {questionsState.kind === "error" ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-danger">{messages.instructor.manage.questions.genericError}</p>
                <Button variant="secondary" onClick={() => setQuestionsRetryCount((count) => count + 1)}>
                  {messages.instructor.manage.retry}
                </Button>
              </div>
            ) : null}

            {questionsState.kind === "ready" ? (
              <>
                {questionsState.questions.length === 0 ? (
                  <p className="mb-3 text-sm text-muted">{messages.instructor.manage.questions.emptyTitle}</p>
                ) : (
                  <ul className="mb-4 flex flex-col gap-2">
                    {questionsState.questions.map((question) => {
                      const topic = question.topicId !== null ? questionsState.topicById[question.topicId] : undefined;
                      const topicLabel = topic
                        ? topic.name + (topic.archivedAt !== null ? messages.questionEditor.topicArchivedSuffix : "")
                        : messages.instructor.manage.questions.noTopic;
                      const displayPrompt =
                        question.draft.prompt ?? questionsState.publishedPromptByQuestionId[question.id] ?? null;
                      return (
                        <li
                          key={question.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm" title={displayPrompt ?? undefined}>
                              {displayPrompt ?? messages.instructor.manage.questions.untitled}
                            </p>
                            <p className="mt-0.5 text-xs text-subtle">
                              {topicLabel}
                              {" · "}
                              {messages.instructor.manage.questions.stateLabel[question.state]}
                            </p>
                          </div>
                          <Link
                            href={`/instructor/courses/${courseId}/questions/${question.id}`}
                            className="shrink-0 text-sm text-subtle underline-offset-4 hover:text-foreground hover:underline"
                          >
                            {messages.instructor.manage.questions.editAction}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {createQuestionError ? <p className="mb-2 text-sm text-danger">{createQuestionError}</p> : null}

                <Button
                  variant="secondary"
                  onClick={handleCreateQuestion}
                  disabled={creatingQuestion || state.course.status === "ARCHIVED"}
                >
                  {creatingQuestion
                    ? messages.instructor.manage.questions.creating
                    : messages.instructor.manage.questions.createAction}
                </Button>
              </>
            ) : null}
          </Card>

          <Card as="section">
            {transitionError ? <p className="mb-3 text-sm text-danger">{transitionError}</p> : null}

            {state.course.status === "ARCHIVED" ? (
              <p className="text-sm text-muted">{messages.instructor.manage.archivedNotice}</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {state.course.status === "DRAFT" ? (
                  <Button onClick={handlePublish} disabled={publishing}>
                    {publishing ? messages.instructor.manage.publishing : messages.instructor.manage.publishAction}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={handleArchive} disabled={archiving}>
                  {archiving ? messages.instructor.manage.archiving : messages.instructor.manage.archiveAction}
                </Button>
              </div>
            )}
            {state.course.status !== "ARCHIVED" && questionsState.kind === "ready" && questionsState.questions.length > 0 ? (
              <p className="mt-3 text-sm text-subtle">
                {messages.instructor.manage.questionPublishSummary
                  .replace(
                    "{published}",
                    String(questionsState.questions.filter((q) => q.state !== "DRAFT_ONLY").length),
                  )
                  .replace("{total}", String(questionsState.questions.length))}
              </p>
            ) : null}
            {state.course.status === "DRAFT" ? (
              <p className="mt-1 text-sm text-subtle">{messages.instructor.manage.publishHint}</p>
            ) : null}
          </Card>

          {state.course.status === "PUBLISHED" && !canSelfJoinCourse(state.course) ? (
            // Same rule the join API enforces: a link to an AUTHORIZED_ONLY
            // Course would reject ordinary learners, so do not offer it.
            <Card as="section">
              <h2 className="mb-2 text-lg font-semibold">{messages.instructor.manage.shareHeading}</h2>
              <p className="text-sm text-muted">{messages.instructor.manage.shareUnavailableBody}</p>
            </Card>
          ) : null}

          {canSelfJoinCourse(state.course) ? (
            <Card as="section">
              <h2 className="mb-2 text-lg font-semibold">{messages.instructor.manage.shareHeading}</h2>
              <p className="mb-3 text-sm text-muted">{messages.instructor.manage.shareBody}</p>
              <div className="flex flex-wrap items-center gap-3">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-muted px-3 py-2 text-sm">
                  {typeof window !== "undefined" ? `${window.location.origin}/join/${state.course.id}` : `/join/${state.course.id}`}
                </code>
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={() =>
                    handleCopyLink(
                      typeof window !== "undefined"
                        ? `${window.location.origin}/join/${state.course.id}`
                        : `/join/${state.course.id}`,
                    )
                  }
                >
                  {linkCopied ? messages.instructor.manage.linkCopied : messages.instructor.manage.copyLink}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
