"use client";

/**
 * Instructor Structured Import Preview page (Run 007 S3). Minimal UI under
 * the existing Course authoring surface: format choice, paste/upload input,
 * a "Preview" action, and a valid/invalid count summary with a per-row
 * error table — consuming `POST /api/courses/:courseId/import/preview`
 * (Run 007 S3, stateless, no writes).
 *
 * Confirm/persistence is Run 007 S4/S5 — this page has no confirm action
 * yet.
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

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
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

  async function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSourceText(text);
    event.target.value = "";
  }

  async function handlePreview() {
    if (previewState.kind === "loading") return;
    setPreviewState({ kind: "loading" });
    try {
      const response = await fetch(`/api/courses/${courseId}/import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, sourceText }),
      });

      if (!response.ok) {
        if (response.status === 413) {
          setPreviewState({ kind: "error", message: messages.importQuestions.sourceTooLargeError });
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
                  onChange={(event) => setFormat(event.target.value as ImportFormat)}
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
                  onChange={(event) => setSourceText(event.target.value)}
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
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
