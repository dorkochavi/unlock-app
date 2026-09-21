import { describe, expect, it, vi } from "vitest";

import { handlePreviewImport } from "../handle-preview-import";
import { MAX_IMPORT_SOURCE_LENGTH } from "../../limits";

import type { PreviewImportResult } from "@/application/import/preview-import";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handlePreviewImport", () => {
  it("unauthenticated: 401, never calls preview", async () => {
    const preview = vi.fn();
    const response = await handlePreviewImport({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[]" },
      preview,
    });

    expect(response.status).toBe(401);
    expect(preview).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND, preview never called", async () => {
    const preview = vi.fn();
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      body: { format: "JSON", sourceText: "[]" },
      preview,
    });

    expect(response.status).toBe(404);
    expect(preview).not.toHaveBeenCalled();
  });

  it("null body: 400 INVALID_REQUEST, preview never called", async () => {
    const preview = vi.fn();
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: null,
      preview,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_REQUEST" } });
    expect(preview).not.toHaveBeenCalled();
  });

  it("unknown format: 400 INVALID_REQUEST, preview never called", async () => {
    const preview = vi.fn();
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "XML", sourceText: "[]" },
      preview,
    });

    expect(response.status).toBe(400);
    expect(preview).not.toHaveBeenCalled();
  });

  it("non-string sourceText: 400 INVALID_REQUEST, preview never called", async () => {
    const preview = vi.fn();
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: 123 },
      preview,
    });

    expect(response.status).toBe(400);
    expect(preview).not.toHaveBeenCalled();
  });

  it("sourceText over the size limit: 413 SOURCE_TOO_LARGE, preview never called", async () => {
    const preview = vi.fn();
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "a".repeat(MAX_IMPORT_SOURCE_LENGTH + 1) },
      preview,
    });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: { code: "SOURCE_TOO_LARGE" } });
    expect(preview).not.toHaveBeenCalled();
  });

  it("sourceText exactly at the size limit: passes through to preview", async () => {
    const preview = vi.fn(
      async (): Promise<PreviewImportResult> => ({
        outcome: "PREVIEWED",
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        rows: [],
      }),
    );
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "a".repeat(MAX_IMPORT_SOURCE_LENGTH) },
      preview,
    });

    expect(response.status).toBe(200);
    expect(preview).toHaveBeenCalledTimes(1);
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const preview = vi.fn(async (): Promise<PreviewImportResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[]" },
      preview,
    });

    expect(response.status).toBe(403);
  });

  it("COURSE_ARCHIVED: 409", async () => {
    const preview = vi.fn(async (): Promise<PreviewImportResult> => ({ outcome: "COURSE_ARCHIVED" }));
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[]" },
      preview,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "COURSE_ARCHIVED" } });
  });

  it("MALFORMED_SOURCE: 400 with the adapter's own message", async () => {
    const preview = vi.fn(
      async (): Promise<PreviewImportResult> => ({ outcome: "MALFORMED_SOURCE", error: "not valid JSON" }),
    );
    const response = await handlePreviewImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "not json" },
      preview,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "MALFORMED_SOURCE", message: "not valid JSON" } });
  });

  it("PREVIEWED: 200 with a DTO-mapped preview, passing actor/courseId/format/sourceText through", async () => {
    const preview = vi.fn(
      async (): Promise<PreviewImportResult> => ({
        outcome: "PREVIEWED",
        totalRows: 2,
        validCount: 1,
        invalidCount: 1,
        rows: [
          {
            sourceRowNumber: 1,
            outcome: "VALID",
            topicId: "topic-1",
            row: {
              sourceRowNumber: 1,
              topicName: "Intro",
              questionType: "SINGLE_CHOICE",
              prompt: "What is 2+2?",
              answerOptions: [
                { id: "A", content: "3" },
                { id: "B", content: "4" },
              ],
              correctOptionIds: ["B"],
              explanation: null,
            },
          },
          { sourceRowNumber: 2, outcome: "INVALID", errors: ["prompt must not be empty"] },
        ],
      }),
    );
    const response = await handlePreviewImport({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      body: { format: "CSV", sourceText: "topic,type\nIntro,SINGLE_CHOICE" },
      preview,
    });

    expect(response.status).toBe(200);
    expect(preview).toHaveBeenCalledWith({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      format: "CSV",
      sourceText: "topic,type\nIntro,SINGLE_CHOICE",
    });
    expect(response.body).toEqual({
      preview: {
        totalRows: 2,
        validCount: 1,
        invalidCount: 1,
        rows: [
          {
            sourceRowNumber: 1,
            outcome: "VALID",
            errors: null,
            topicId: "topic-1",
            topicName: "Intro",
            questionType: "SINGLE_CHOICE",
            prompt: "What is 2+2?",
          },
          {
            sourceRowNumber: 2,
            outcome: "INVALID",
            errors: ["prompt must not be empty"],
            topicId: null,
            topicName: null,
            questionType: null,
            prompt: null,
          },
        ],
      },
    });
  });
});
