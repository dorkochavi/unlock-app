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
import { useParams } from "next/navigation";

import { getMessages } from "@/messages";
import type { CourseJoinPolicy, CourseStatus } from "@/domain/course/types";

interface CourseAuthoringDto {
  id: string;
  title: string;
  status: CourseStatus;
  joinPolicy: CourseJoinPolicy;
  examDate: string | null;
  createdAt: string;
  updatedAt: string;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "notFound" }
  | { kind: "notAuthorized" }
  | { kind: "error" }
  | { kind: "ready"; course: CourseAuthoringDto };

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

export default function InstructorCourseManagePage() {
  const messages = getMessages();
  const params = useParams<{ courseId: string }>();
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
    <div className="flex flex-1 flex-col p-6 sm:p-10">
      <main className="flex flex-1 items-start justify-center">
        {state.kind === "loading" ? (
          <p className="text-zinc-600 dark:text-zinc-400">{messages.instructor.manage.loading}</p>
        ) : null}

        {state.kind === "signed-out" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.instructor.manage.signedOutTitle}</p>
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {messages.instructor.manage.signedOutAction}
            </Link>
          </div>
        ) : null}

        {state.kind === "notFound" ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.instructor.manage.notFoundTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.instructor.manage.notFoundBody}</p>
          </div>
        ) : null}

        {state.kind === "notAuthorized" ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.instructor.manage.notAuthorizedTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.instructor.manage.notAuthorizedBody}</p>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.instructor.manage.genericErrorTitle}</p>
            <button
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                setRetryCount((count) => count + 1);
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
            >
              {messages.instructor.manage.retry}
            </button>
          </div>
        ) : null}

        {state.kind === "ready" ? (
          <div className="w-full max-w-2xl">
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">{state.course.title}</h1>
            <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
              {messages.instructor.manage.statusLabel[state.course.status]}
            </p>

            <form onSubmit={handleSaveDetails} className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <label className="mb-4 block">
                <span className="mb-1 block text-sm font-medium">{messages.instructor.manage.titleLabel}</span>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  disabled={state.course.status === "ARCHIVED"}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                  required
                />
              </label>

              <label className="mb-4 block">
                <span className="mb-1 block text-sm font-medium">{messages.instructor.manage.examDateLabel}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={examDateDraft}
                    onChange={(event) => setExamDateDraft(event.target.value)}
                    disabled={state.course.status === "ARCHIVED"}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  {examDateDraft !== "" && state.course.status !== "ARCHIVED" ? (
                    <button
                      type="button"
                      onClick={() => setExamDateDraft("")}
                      className="shrink-0 text-sm text-zinc-500 underline dark:text-zinc-400"
                    >
                      {messages.instructor.manage.clearExamDate}
                    </button>
                  ) : null}
                </div>
              </label>

              {detailsError ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{detailsError}</p> : null}
              {!detailsError && detailsSavedAt !== null ? (
                <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">
                  {messages.instructor.manage.saveSuccess}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={savingDetails || state.course.status === "ARCHIVED"}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {savingDetails ? messages.instructor.manage.saving : messages.instructor.manage.saveAction}
              </button>
            </form>

            <div className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{messages.instructor.manage.joinPolicyLabel}</span>
                <select
                  value={state.course.joinPolicy}
                  disabled={savingJoinPolicy || state.course.status === "ARCHIVED"}
                  onChange={(event) => handleJoinPolicyChange(event.target.value as CourseJoinPolicy)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="AUTHORIZED_ONLY">
                    {messages.instructor.manage.joinPolicyOption.AUTHORIZED_ONLY}
                  </option>
                  <option value="OPEN">{messages.instructor.manage.joinPolicyOption.OPEN}</option>
                </select>
              </label>
              {joinPolicyError ? (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{joinPolicyError}</p>
              ) : null}
            </div>

            <div className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              {transitionError ? (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">{transitionError}</p>
              ) : null}

              {state.course.status === "ARCHIVED" ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {messages.instructor.manage.archivedNotice}
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {state.course.status === "DRAFT" ? (
                    <button
                      type="button"
                      onClick={handlePublish}
                      disabled={publishing}
                      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {publishing ? messages.instructor.manage.publishing : messages.instructor.manage.publishAction}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={archiving}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
                  >
                    {archiving ? messages.instructor.manage.archiving : messages.instructor.manage.archiveAction}
                  </button>
                </div>
              )}
              {state.course.status === "DRAFT" ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {messages.instructor.manage.publishHint}
                </p>
              ) : null}
            </div>

            {state.course.status === "PUBLISHED" ? (
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h2 className="mb-2 text-lg font-medium">{messages.instructor.manage.shareHeading}</h2>
                <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {messages.instructor.manage.shareBody}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800">
                    {typeof window !== "undefined" ? `${window.location.origin}/join/${state.course.id}` : `/join/${state.course.id}`}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyLink(
                        typeof window !== "undefined"
                          ? `${window.location.origin}/join/${state.course.id}`
                          : `/join/${state.course.id}`,
                      )
                    }
                    className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
                  >
                    {linkCopied ? messages.instructor.manage.linkCopied : messages.instructor.manage.copyLink}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
