"use client";

/**
 * Instructor Structured Import Preview + Confirm page (Run 007 S3/S5).
 * Minimal UI under the existing Course authoring surface: format choice,
 * paste/upload input, a "Preview" action with a valid/invalid count summary
 * and per-row error table, and — once the current preview shows zero
 * invalid rows — a "Confirm" action that resubmits the SAME raw
 * `format`/`sourceText` to `POST /api/courses/:courseId/import/confirm`
 * (Run 007 S4). Confirm is disabled whenever the current preview is stale
 * (`idle`/`loading`/`error`) or contains any invalid row — the server
 * re-validates independently regardless, but the UI never offers an action
 * it already knows will be rejected.
 *
 * On a successful confirm, this page shows a success state and links back
 * to the existing (Run 006) Course manage page, where every imported
 * Question already appears as an ordinary `DRAFT_ONLY` Question in the
 * unmodified Question list/editor/publish flow — Run 007 §12 "no separate
 * imported-question lifecycle, list, editor, or publish mechanism."
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { getMessages } from "@/messages";
import type { CourseStatus } from "@/domain/course/types";

type ImportFormat = "JSON" | "CSV";

interface PreviewRowDto {
  sourceRowNumber: number;
  outcome: "VALID" | "INVALID";
  errors: string[] | null;
  topicId: string | null;
  topicName: string | null;
  questionType: string | null;
  prompt: string | null;
}

interface PreviewImportDto {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: PreviewRowDto[];
}

type ViewState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "notFound" }
  | { kind: "notAuthorized" }
  | { kind: "error" }
  | { kind: "ready"; courseStatus: CourseStatus };

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; preview: PreviewImportDto };

type ConfirmState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; createdCount: number };

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}

/**
 * A 413 response is either `SOURCE_TOO_LARGE` (character-count limit,
 * checked before the body is even parsed) or `TOO_MANY_ROWS` (row-count
 * limit, Run 008 S1.D, only knowable after parsing) — distinct causes that
 * previously collapsed into the same "file too large" copy regardless of
 * which one actually happened.
 */
async function tooLargeOrTooManyRowsMessage(response: Response): Promise<string> {
  const messages = getMessages();
  try {
    const body = (await response.json()) as { error?: { code?: string; totalRows?: number } };
    if (body.error?.code === "TOO_MANY_ROWS" && typeof body.error.totalRows === "number") {
      return interpolate(messages.importQuestions.tooManyRowsError, {
        totalRows: String(body.error.totalRows),
      });
    }
  } catch {
    // fall through to the size-limit message below
  }
  return messages.importQuestions.sourceTooLargeError;
}

async function fetchCourseStatus(
  courseId: string,
): Promise<
  | { outcome: "READY"; status: CourseStatus }
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
    const body = (await response.json()) as { course: { status: CourseStatus } };
    return { outcome: "READY", status: body.course.status };
  } catch {
    return { outcome: "ERROR" };
  }
}

export default function InstructorImportPage() {
  const messages = getMessages();
  const params = useParams<{ courseId: string }>();
  const courseId = String(params.courseId);

  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  const [format, setFormat] = useState<ImportFormat>("JSON");
  const [sourceText, setSourceText] = useState("");
  const [previewState, setPreviewState] = useState<PreviewState>({ kind: "idle" });
  const [confirmState, setConfirmState] = useState<ConfirmState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState({ kind: "loading" });
      const result = await fetchCourseStatus(courseId);
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
          setState({ kind: "ready", courseStatus: result.status });
          return;
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, retryCount]);

  /** Any change to what would actually be sent to preview/confirm invalidates the current preview/confirm state — never leave a stale valid/invalid summary or a stale confirm success banner on screen describing input that no longer matches. */
  function resetPreviewAndConfirm() {
    setPreviewState({ kind: "idle" });
    setConfirmState({ kind: "idle" });
  }

  function handleFormatChange(nextFormat: ImportFormat) {
    setFormat(nextFormat);
    resetPreviewAndConfirm();
  }

  function handleSourceTextChange(nextSourceText: string) {
    setSourceText(nextSourceText);
    resetPreviewAndConfirm();
  }

  async function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    handleSourceTextChange(text);
    event.target.value = "";
  }

  async function handlePreview() {
    if (previewState.kind === "loading") return;
    setPreviewState({ kind: "loading" });
    setConfirmState({ kind: "idle" });
    try {
      const response = await fetch(`/api/courses/${courseId}/import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, sourceText }),
      });

      if (!response.ok) {
        if (response.status === 413) {
          setPreviewState({ kind: "error", message: await tooLargeOrTooManyRowsMessage(response) });
          return;
        }
        try {
          const body = (await response.json()) as { error?: { code?: string; message?: string } };
          if (body.error?.code === "MALFORMED_SOURCE" && body.error.message) {
            setPreviewState({
              kind: "error",
              message: interpolate(messages.importQuestions.malformedSourceError, {
                message: body.error.message,
              }),
            });
            return;
          }
        } catch {
          // fall through to the generic error below
        }
        setPreviewState({ kind: "error", message: messages.importQuestions.previewError });
        return;
      }

      const body = (await response.json()) as { preview: PreviewImportDto };
      setPreviewState({ kind: "ready", preview: body.preview });
    } catch {
      setPreviewState({ kind: "error", message: messages.importQuestions.previewError });
    }
  }

  async function handleConfirm() {
    if (previewState.kind !== "ready" || previewState.preview.invalidCount > 0) return;
    if (confirmState.kind === "loading") return;
    setConfirmState({ kind: "loading" });
    try {
      const response = await fetch(`/api/courses/${courseId}/import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, sourceText }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setConfirmState({ kind: "error", message: messages.importQuestions.signedOutTitle });
          return;
        }
        if (response.status === 403) {
          setConfirmState({ kind: "error", message: messages.importQuestions.notAuthorizedBody });
          return;
        }
        if (response.status === 413) {
          setConfirmState({ kind: "error", message: await tooLargeOrTooManyRowsMessage(response) });
          return;
        }
        try {
          const body = (await response.json()) as { error?: { code?: string; message?: string } };
          if (body.error?.code === "MALFORMED_SOURCE" && body.error.message) {
            setConfirmState({
              kind: "error",
              message: interpolate(messages.importQuestions.malformedSourceError, {
                message: body.error.message,
              }),
            });
            return;
          }
          if (body.error?.code === "INVALID_ROWS" || body.error?.code === "STATE_CHANGED") {
            setConfirmState({ kind: "error", message: messages.importQuestions.confirmStateChangedError });
            return;
          }
          if (body.error?.code === "COURSE_ARCHIVED") {
            setConfirmState({ kind: "error", message: messages.importQuestions.archivedNotice });
            return;
          }
        } catch {
          // fall through to the generic error below
        }
        setConfirmState({ kind: "error", message: messages.importQuestions.confirmError });
        return;
      }

      const body = (await response.json()) as { createdCount: number; createdQuestionIds: string[] };
      setConfirmState({ kind: "success", createdCount: body.createdCount });
    } catch {
      setConfirmState({ kind: "error", message: messages.importQuestions.confirmError });
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
            <p className="mb-4 text-lg">{messages.importQuestions.signedOutTitle}</p>
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {messages.importQuestions.signedOutAction}
            </Link>
          </div>
        ) : null}

        {state.kind === "notFound" ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.importQuestions.notFoundTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.importQuestions.notFoundBody}</p>
          </div>
        ) : null}

        {state.kind === "notAuthorized" ? (
          <div className="text-center">
            <p className="mb-2 text-lg">{messages.importQuestions.notAuthorizedTitle}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{messages.importQuestions.notAuthorizedBody}</p>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="text-center">
            <p className="mb-4 text-lg">{messages.importQuestions.genericErrorTitle}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
            >
              {messages.importQuestions.retry}
            </button>
          </div>
        ) : null}

        {state.kind === "ready" ? (
          <div className="w-full max-w-2xl">
            <Link
              href={`/instructor/courses/${courseId}`}
              className="mb-4 inline-block text-sm text-zinc-500 underline dark:text-zinc-400"
            >
              {messages.importQuestions.backToCourse}
            </Link>

            <h1 className="mb-6 text-2xl font-semibold tracking-tight">{messages.importQuestions.heading}</h1>

            {state.courseStatus === "ARCHIVED" ? (
              <p className="mb-6 rounded-md border border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                {messages.importQuestions.archivedNotice}
              </p>
            ) : null}

            <fieldset
              disabled={state.courseStatus === "ARCHIVED"}
              className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 disabled:opacity-60 dark:border-zinc-800"
            >
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{messages.importQuestions.formatLabel}</span>
                <select
                  value={format}
                  onChange={(event) => handleFormatChange(event.target.value as ImportFormat)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="JSON">{messages.importQuestions.formatOption.JSON}</option>
                  <option value="CSV">{messages.importQuestions.formatOption.CSV}</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">{messages.importQuestions.sourceLabel}</span>
                <textarea
                  value={sourceText}
                  onChange={(event) => handleSourceTextChange(event.target.value)}
                  placeholder={messages.importQuestions.sourcePlaceholder}
                  rows={10}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">{messages.importQuestions.uploadAction}</span>
                <input
                  type="file"
                  accept=".json,.csv,text/csv,application/json"
                  onChange={handleUploadFile}
                  className="w-full text-sm"
                />
              </label>

              <button
                type="button"
                onClick={handlePreview}
                disabled={previewState.kind === "loading" || sourceText.trim() === ""}
                className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {previewState.kind === "loading"
                  ? messages.importQuestions.previewing
                  : messages.importQuestions.previewAction}
              </button>

              {previewState.kind === "error" ? (
                <p className="text-sm text-red-600 dark:text-red-400">{previewState.message}</p>
              ) : null}
            </fieldset>

            {previewState.kind === "ready" ? (
              <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="mb-4 text-sm font-medium">
                  {interpolate(messages.importQuestions.summary, {
                    validCount: String(previewState.preview.validCount),
                    totalRows: String(previewState.preview.totalRows),
                    invalidCount: String(previewState.preview.invalidCount),
                  })}
                </p>

                <h2 className="mb-2 text-sm font-medium">{messages.importQuestions.rowsHeading}</h2>
                <ul className="flex flex-col gap-2">
                  {previewState.preview.rows.map((row) => (
                    <li
                      key={row.sourceRowNumber}
                      className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {interpolate(messages.importQuestions.rowNumber, {
                            number: String(row.sourceRowNumber),
                          })}
                        </span>
                        <span
                          className={
                            row.outcome === "VALID"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {row.outcome === "VALID"
                            ? messages.importQuestions.rowValid
                            : messages.importQuestions.rowInvalid}
                        </span>
                      </div>
                      {row.outcome === "VALID" ? (
                        <p className="mt-1 truncate text-zinc-600 dark:text-zinc-400" title={row.prompt ?? undefined}>
                          {row.prompt}
                        </p>
                      ) : (
                        <ul className="mt-1 list-inside list-disc text-red-600 dark:text-red-400">
                          {row.errors?.map((error, index) => <li key={index}>{error}</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>

                {previewState.preview.invalidCount > 0 ? (
                  <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
                    {messages.importQuestions.confirmDisabledHint}
                  </p>
                ) : null}

                {confirmState.kind === "success" ? (
                  <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                    <p className="mb-2">
                      {interpolate(messages.importQuestions.confirmSuccess, {
                        createdCount: String(confirmState.createdCount),
                      })}
                    </p>
                    <Link href={`/instructor/courses/${courseId}`} className="underline">
                      {messages.importQuestions.viewQuestionsAction}
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={
                      confirmState.kind === "loading" ||
                      state.courseStatus === "ARCHIVED" ||
                      previewState.preview.invalidCount > 0
                    }
                    className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-600"
                  >
                    {confirmState.kind === "loading"
                      ? messages.importQuestions.confirming
                      : messages.importQuestions.confirmAction}
                  </button>
                )}

                {confirmState.kind === "error" ? (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{confirmState.message}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
