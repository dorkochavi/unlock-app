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
import { Notice } from "@/components/notice";
import { SkeletonRows } from "@/components/skeleton";
import { LoadingState, StateBlock } from "@/components/state-block";
import { interpolate } from "@/lib/interpolate";
import { getMessages } from "@/messages";
import { canSelfJoinCourse, type CourseJoinPolicy, type CourseStatus } from "@/domain/course/types";
import { canOpenAnswerAnalysis } from "@/domain/insights/analysis-entry";

import { OwnCourseActions } from "./own-course-actions";
import { QuestionRow } from "./question-row";

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

  // UX-03-QA1 Finding 1: bulk review/publish for imported (or any pending-draft)
  // Questions. Reuses the EXISTING single-Question publish endpoint/transaction
  // once per selected id — no new persistence model, no batch source-of-truth,
  // no new validation path. Selection is cleared whenever the underlying
  // Question list reloads (a fresh fetch may drop/rename ids).
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [bulkPublishResult, setBulkPublishResult] = useState<{
    published: number;
    failed: number;
  } | null>(null);

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

  // Fires in parallel with the Course-metadata fetch above rather than waiting
  // for it (UX3-6, measured waterfall: this used to start only after `manage`
  // resolved). Safe: this route only needs `courseId` and authenticates/
  // authorizes itself independently (defense in depth unchanged); the render
  // below still only shows Topics once the page is otherwise `ready`.
  useEffect(() => {
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
  }, [courseId, topicsRetryCount]);

  // Same reasoning as the Topics effect above — fires in parallel, not gated
  // on `state.kind === "ready"`.
  useEffect(() => {
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
      // A fresh fetch may drop/rename ids (or change readiness) — never keep
      // a stale selection across a reload.
      setSelectedQuestionIds(new Set());
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, questionsRetryCount]);

  function toggleQuestionSelection(questionId: string) {
    setSelectedQuestionIds((previous) => {
      const next = new Set(previous);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  /**
   * "Select all approved/valid" (UX-03-QA1 Finding 1): every Question that
   * currently has a pending draft (`state !== "PUBLISHED"`) — not a claim
   * that each one will actually pass server-side publish-ready validation.
   * A NOT_READY Question stays selectable and, if published anyway, simply
   * fails its own individual publish call in `handleBulkPublish` below (never
   * silently skipped, never force-published) — this button is a convenience
   * for selection, not a second validation pass.
   */
  function selectAllPublishable() {
    if (questionsState.kind !== "ready") return;
    const ids = questionsState.questions
      .filter((question) => question.state !== "PUBLISHED")
      .map((question) => question.id);
    setSelectedQuestionIds(new Set(ids));
  }

  async function handleBulkPublish() {
    if (bulkPublishing || selectedQuestionIds.size === 0) return;
    setBulkPublishing(true);
    setBulkPublishResult(null);
    const ids = [...selectedQuestionIds];
    let published = 0;
    let failed = 0;
    // Sequential, not Promise.all: each call is its own independent,
    // already-transactional publish (publishQuestion) — sequencing here is
    // only to keep server load bounded for a bulk instructor action, not a
    // correctness requirement.
    for (const id of ids) {
      try {
        const response = await fetch(`/api/courses/${courseId}/questions/${id}/publish`, {
          method: "POST",
        });
        if (response.ok) {
          published++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    setBulkPublishResult({ published, failed });
    setBulkPublishing(false);
    setQuestionsRetryCount((count) => count + 1);
  }

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
        setAddTopicError(
          response.status === 409
            ? messages.instructor.manage.topics.duplicateNameError
            : messages.instructor.manage.topics.addError,
        );
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
        setRenameError(
          response.status === 409
            ? messages.instructor.manage.topics.duplicateNameError
            : messages.instructor.manage.topics.renameError,
        );
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:max-w-5xl xl:max-w-6xl">
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
          <Card variant="tint" as="section" className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="flex flex-col items-start gap-3">
              <span className="chip">
                {messages.instructor.manage.statusLabel[state.course.status]}
              </span>
              <h1 className="break-words text-page font-extrabold">{state.course.title}</h1>
            </div>
            <OwnCourseActions courseId={courseId} />
          </Card>

          <div
            id="course-management"
            className="grid grid-cols-1 gap-6 scroll-mt-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_20rem]"
          >
            <div className="flex min-w-0 flex-col gap-6">
            <Card as="section">
              <h2 className="mb-4 text-section">{messages.instructor.manage.detailsHeading}</h2>
              <form onSubmit={handleSaveDetails} className="flex flex-col gap-4">
                <div className="grid gap-4 md:grid-cols-2">
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
                        className="min-h-control shrink-0 rounded-full px-3 text-secondary font-medium text-subtle underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {messages.instructor.manage.clearExamDate}
                      </button>
                    ) : null}
                  </div>
                </label>
                </div>

                {detailsError ? <Notice tone="error">{detailsError}</Notice> : null}
                {!detailsError && detailsSavedAt !== null ? (
                  <Notice tone="success">{messages.instructor.manage.saveSuccess}</Notice>
                ) : null}

                <div>
                  {/* Local form action, not the page-level primary (UX_SPEC §11 item 3) — Publish carries that weight below. */}
                  <Button
                    variant="secondary"
                    type="submit"
                    disabled={savingDetails || state.course.status === "ARCHIVED"}
                  >
                    {savingDetails ? messages.instructor.manage.saving : messages.instructor.manage.saveAction}
                  </Button>
                </div>
              </form>
            </Card>

          <Card as="section">
            <h2 className="mb-4 text-section">{messages.instructor.manage.topics.heading}</h2>

            {topicsState.kind === "loading" ? (
              <SkeletonRows count={2} label={messages.instructor.manage.topics.loading} rowClassName="h-11 w-full" />
            ) : null}

            {topicsState.kind === "error" ? (
              <div className="flex flex-col items-start gap-2">
                <Notice tone="error">{messages.instructor.manage.topics.genericError}</Notice>
                <Button variant="secondary" onClick={() => setTopicsRetryCount((count) => count + 1)}>
                  {messages.instructor.manage.retry}
                </Button>
              </div>
            ) : null}

            {topicsState.kind === "ready" ? (
              <>
                {topicsState.topics.length === 0 ? (
                  <p className="mb-3 text-secondary text-muted">{messages.instructor.manage.topics.emptyTitle}</p>
                ) : (
                  <ul className="mb-4 grid grid-cols-1 gap-2 xl:grid-cols-2">
                    {topicsState.topics.map((topic) => (
                      <li
                        key={topic.id}
                        className="flex min-h-12 items-center justify-between gap-2 rounded-control bg-surface-muted px-3 py-1"
                      >
                        {editingTopicId === topic.id ? (
                          <>
                            <input
                              type="text"
                              value={renameDraft}
                              onChange={(event) => setRenameDraft(event.target.value)}
                              className="min-h-control min-w-0 flex-1 rounded-field border border-field-border bg-surface px-3 py-1 text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              autoFocus
                            />
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveRename(topic.id)}
                                disabled={savingTopicId === topic.id}
                                className="min-h-control rounded-full px-2 text-secondary font-semibold text-primary-soft-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                {messages.instructor.manage.topics.renameSave}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelRename}
                                className="min-h-control rounded-full px-2 text-secondary text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                {messages.instructor.manage.topics.renameCancel}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="min-w-0 truncate text-secondary font-medium" title={topic.name}>
                              {topic.name}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartRename(topic)}
                                className="min-h-control rounded-full px-2 text-secondary text-subtle underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                {messages.instructor.manage.topics.renameAction}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleArchiveTopic(topic.id)}
                                disabled={archivingTopicId === topic.id}
                                className="min-h-control rounded-full px-2 text-secondary text-danger underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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

                {renameError ? <Notice tone="error" className="mb-2">{renameError}</Notice> : null}
                {archiveTopicError ? <Notice tone="error" className="mb-2">{archiveTopicError}</Notice> : null}

                <form onSubmit={handleAddTopic} className="flex gap-2">
                  <Input
                    type="text"
                    value={newTopicName}
                    onChange={(event) => setNewTopicName(event.target.value)}
                    placeholder={messages.instructor.manage.topics.addPlaceholder}
                    className="min-w-0 flex-1"
                    required
                  />
                  <Button variant="secondary" type="submit" disabled={addingTopic} className="shrink-0">
                    {addingTopic ? messages.instructor.manage.topics.adding : messages.instructor.manage.topics.addAction}
                  </Button>
                </form>
                {addTopicError ? <Notice tone="error" className="mt-2">{addTopicError}</Notice> : null}
              </>
            ) : null}
          </Card>

          <Card as="section">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <h2 className="text-section">{messages.instructor.manage.questions.heading}</h2>
              <div className="flex flex-wrap items-center gap-x-1">
                {canOpenAnswerAnalysis(state.course.status) ? (
                  <Link
                    href={`/instructor/courses/${courseId}/item-analysis`}
                    className="inline-flex min-h-control items-center rounded-full px-3 text-secondary font-semibold text-primary-soft-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {messages.instructor.manage.questions.itemAnalysisAction}
                  </Link>
                ) : null}
                <Link
                  href={`/instructor/courses/${courseId}/import`}
                  className="inline-flex min-h-control items-center rounded-full px-3 text-secondary text-subtle underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                <Notice tone="error">{messages.instructor.manage.questions.genericError}</Notice>
                <Button variant="secondary" onClick={() => setQuestionsRetryCount((count) => count + 1)}>
                  {messages.instructor.manage.retry}
                </Button>
              </div>
            ) : null}

            {questionsState.kind === "ready" ? (
              <>
                {questionsState.questions.length === 0 ? (
                  <p className="mb-3 text-secondary text-muted">{messages.instructor.manage.questions.emptyTitle}</p>
                ) : (
                  <ul className="mb-4 divide-y divide-border">
                    {questionsState.questions.map((question) => {
                      const topic = question.topicId !== null ? questionsState.topicById[question.topicId] : undefined;
                      const topicLabel = topic
                        ? topic.name + (topic.archivedAt !== null ? messages.questionEditor.topicArchivedSuffix : "")
                        : messages.instructor.manage.questions.noTopic;
                      const displayPrompt =
                        question.draft.prompt ?? questionsState.publishedPromptByQuestionId[question.id] ?? null;
                      const publishable = question.state !== "PUBLISHED";
                      return (
                        <QuestionRow
                          key={question.id}
                          displayPrompt={displayPrompt ?? messages.instructor.manage.questions.untitled}
                          topicLabel={topicLabel}
                          state={question.state}
                          stateLabel={messages.instructor.manage.questions.stateLabel[question.state]}
                          selectable={publishable && state.course.status !== "ARCHIVED"}
                          selected={selectedQuestionIds.has(question.id)}
                          onToggleSelected={() => toggleQuestionSelection(question.id)}
                          selectAriaLabel={interpolate(messages.instructor.manage.questions.selectQuestionLabel, {
                            prompt: displayPrompt ?? messages.instructor.manage.questions.untitled,
                          })}
                          editHref={`/instructor/courses/${courseId}/questions/${question.id}`}
                          editLabel={messages.instructor.manage.questions.editAction}
                        />
                      );
                    })}
                  </ul>
                )}

                {createQuestionError ? <Notice tone="error" className="mb-2">{createQuestionError}</Notice> : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleCreateQuestion}
                    disabled={creatingQuestion || state.course.status === "ARCHIVED"}
                  >
                    {creatingQuestion
                      ? messages.instructor.manage.questions.creating
                      : messages.instructor.manage.questions.createAction}
                  </Button>
                  {state.course.status !== "ARCHIVED" &&
                  questionsState.questions.some((q) => q.state !== "PUBLISHED") ? (
                    <>
                      <Button variant="tertiary" onClick={selectAllPublishable} disabled={bulkPublishing}>
                        {messages.instructor.manage.questions.selectAllAction}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleBulkPublish}
                        disabled={bulkPublishing || selectedQuestionIds.size === 0}
                      >
                        {bulkPublishing
                          ? messages.instructor.manage.questions.publishingSelected
                          : interpolate(messages.instructor.manage.questions.publishSelectedAction, {
                              count: selectedQuestionIds.size,
                            })}
                      </Button>
                    </>
                  ) : null}
                </div>
                {bulkPublishResult !== null ? (
                  <p className="mt-2 text-secondary text-muted" role="status">
                    {bulkPublishResult.failed > 0
                      ? interpolate(messages.instructor.manage.questions.bulkPublishSummaryWithFailures, {
                          published: bulkPublishResult.published,
                          failed: bulkPublishResult.failed,
                        })
                      : interpolate(messages.instructor.manage.questions.bulkPublishSummary, {
                          published: bulkPublishResult.published,
                        })}
                  </p>
                ) : null}
              </>
            ) : null}
          </Card>
            </div>

            <div className="flex min-w-0 flex-col gap-6 lg:[@media(min-height:760px)]:sticky lg:[@media(min-height:760px)]:top-4">
          {transitionError ? <Notice tone="error">{transitionError}</Notice> : null}

          {state.course.status === "DRAFT" ||
          (state.course.status !== "ARCHIVED" && questionsState.kind === "ready" && questionsState.questions.length > 0) ? (
            <Card as="section">
              <h2 className="mb-3 text-section">{messages.instructor.manage.lifecycleHeading}</h2>
              {state.course.status === "DRAFT" ? (
                <Button size="lg" onClick={handlePublish} disabled={publishing} fullWidth className="sm:w-auto">
                  {publishing ? messages.instructor.manage.publishing : messages.instructor.manage.publishAction}
                </Button>
              ) : null}
              {questionsState.kind === "ready" && questionsState.questions.length > 0 ? (
                <p className="mt-3 text-secondary text-subtle">
                  {messages.instructor.manage.questionPublishSummary
                    .replace(
                      "{published}",
                      String(questionsState.questions.filter((q) => q.state !== "DRAFT_ONLY").length),
                    )
                    .replace("{total}", String(questionsState.questions.length))}
                </p>
              ) : null}
              {state.course.status === "DRAFT" ? (
                <p className="mt-1 text-secondary text-subtle">{messages.instructor.manage.publishHint}</p>
              ) : null}
            </Card>
          ) : null}

          {state.course.status === "PUBLISHED" && !canSelfJoinCourse(state.course) ? (
            // Same rule the join API enforces: a link to an AUTHORIZED_ONLY
            // Course would reject ordinary learners, so do not offer it.
            <Card as="section">
              <h2 className="mb-2 text-section">{messages.instructor.manage.shareHeading}</h2>
              <p className="text-secondary text-muted">{messages.instructor.manage.shareUnavailableBody}</p>
            </Card>
          ) : null}

          {canSelfJoinCourse(state.course) ? (
            <Card as="section">
              <h2 className="mb-2 text-section">{messages.instructor.manage.shareHeading}</h2>
              <p className="mb-3 text-secondary text-muted">{messages.instructor.manage.shareBody}</p>
              <div className="flex flex-wrap items-center gap-3">
                <code dir="ltr" className="block min-h-control min-w-0 flex-1 basis-48 truncate rounded-control bg-surface-muted px-3 py-2.5 text-secondary leading-6">
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
              {joinPolicyError ? (
                <Notice tone="error" className="mt-3">
                  {joinPolicyError}
                </Notice>
              ) : null}
            </Card>

          {/* Danger zone: de-emphasised, quiet danger-tonal action; confirmation (window.confirm) unchanged. */}
          <section
            aria-labelledby="danger-zone-heading"
            className="rounded-card border border-danger/25 p-5"
          >
            <h2 id="danger-zone-heading" className="mb-3 text-section text-danger">
              {messages.instructor.manage.dangerZoneHeading}
            </h2>
            {state.course.status === "ARCHIVED" ? (
              <p className="text-secondary text-muted">{messages.instructor.manage.archivedNotice}</p>
            ) : (
              <Button
                variant="dangerTertiary"
                className="border border-danger/30 px-5"
                onClick={handleArchive}
                disabled={archiving}
              >
                {archiving ? messages.instructor.manage.archiving : messages.instructor.manage.archiveAction}
              </Button>
            )}
          </section>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
