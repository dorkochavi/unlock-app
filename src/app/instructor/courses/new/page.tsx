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
import { useRouter } from "next/navigation";

import { Button, ButtonLink } from "@/components/button";
import { Card } from "@/components/card";
import { Input, Label } from "@/components/input";
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{messages.instructor.newCourse.heading}</h1>

      <Card as="section">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block">
            <Label>{messages.instructor.newCourse.titleLabel}</Label>
            <Input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={messages.instructor.newCourse.titlePlaceholder}
              required
            />
          </label>

          <label className="block">
            <Label>{messages.instructor.newCourse.examDateLabel}</Label>
            <Input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
          </label>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? messages.instructor.newCourse.creating : messages.instructor.newCourse.createAction}
            </Button>
            <ButtonLink href="/instructor/courses" variant="secondary">
              {messages.instructor.newCourse.cancelAction}
            </ButtonLink>
          </div>
        </form>
      </Card>
    </main>
  );
}
