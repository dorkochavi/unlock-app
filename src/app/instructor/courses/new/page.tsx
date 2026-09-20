"use client";

/**
 * Create-Course form (Run 005 S3), posting to `POST /api/courses`
 * (`handle-create-course.ts`). A new Course always starts DRAFT/
 * AUTHORIZED_ONLY server-side — this form never sends `status`/`joinPolicy`
 * (Run 005 S3 "Do not auto-publish a Course merely because it was created").
 * On success, redirects straight to the manage page for the new Course so
 * the instructor lands where they configure/publish it next.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getMessages } from "@/messages";

type CreateOutcome =
  | { outcome: "CREATED"; courseId: string }
  | { outcome: "UNAUTHENTICATED" }
  | { outcome: "INVALID_TITLE" }
  | { outcome: "ERROR" };

async function createCourseRequest(title: string, examDate: string | null): Promise<CreateOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, examDate }),
    });
  } catch {
    return { outcome: "ERROR" };
  }
  if (response.status === 401) {
    return { outcome: "UNAUTHENTICATED" };
  }
  if (response.status === 400) {
    return { outcome: "INVALID_TITLE" };
  }
  if (!response.ok) {
    return { outcome: "ERROR" };
  }
  try {
    const body = (await response.json()) as { course: { id: string } };
    return { outcome: "CREATED", courseId: body.course.id };
  } catch {
    return { outcome: "ERROR" };
  }
}

export default function NewInstructorCoursePage() {
  const messages = getMessages();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createCourseRequest(title, examDate === "" ? null : examDate);
      switch (result.outcome) {
        case "UNAUTHENTICATED":
          router.push(`/login?next=${encodeURIComponent("/instructor/courses/new")}`);
          return;
        case "INVALID_TITLE":
          setError(messages.instructor.newCourse.invalidTitleError);
          return;
        case "ERROR":
          setError(messages.instructor.newCourse.genericError);
          return;
        case "CREATED":
          router.push(`/instructor/courses/${result.courseId}`);
          return;
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-start justify-center p-6 sm:p-10">
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          {messages.instructor.newCourse.heading}
        </h1>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">{messages.instructor.newCourse.titleLabel}</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={messages.instructor.newCourse.titlePlaceholder}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            required
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-medium">{messages.instructor.newCourse.examDateLabel}</span>
          <input
            type="date"
            value={examDate}
            onChange={(event) => setExamDate(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {error ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting ? messages.instructor.newCourse.creating : messages.instructor.newCourse.createAction}
          </button>
          <Link
            href="/instructor/courses"
            className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
          >
            {messages.instructor.newCourse.cancelAction}
          </Link>
        </div>
      </form>
    </div>
  );
}
