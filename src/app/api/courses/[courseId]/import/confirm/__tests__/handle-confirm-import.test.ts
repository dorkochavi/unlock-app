import { describe, expect, it, vi } from "vitest";

import { handleConfirmImport } from "../handle-confirm-import";
import { MAX_IMPORT_SOURCE_LENGTH } from "../../limits";

import type { ConfirmImportResult } from "@/application/import/confirm-import";

function authenticated(userId = "supabase-user-1") {
  return vi.fn(async () => ({ outcome: "AUTHENTICATED" as const, userId }));
}

const COURSE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("handleConfirmImport", () => {
  it("unauthenticated: 401, never calls confirm", async () => {
    const confirm = vi.fn();
    const response = await handleConfirmImport({
      authenticate: async () => ({ outcome: "UNAUTHENTICATED" }),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[]" },
      confirm,
    });

    expect(response.status).toBe(401);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("malformed courseId: 404 COURSE_NOT_FOUND, confirm never called", async () => {
    const confirm = vi.fn();
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: "not-a-uuid",
      body: { format: "JSON", sourceText: "[]" },
      confirm,
    });

    expect(response.status).toBe(404);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("null body: 400 INVALID_REQUEST, confirm never called", async () => {
    const confirm = vi.fn();
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: null,
      confirm,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "INVALID_REQUEST" } });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("sourceText over the size limit: 413 SOURCE_TOO_LARGE, confirm never called", async () => {
    const confirm = vi.fn();
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "a".repeat(MAX_IMPORT_SOURCE_LENGTH + 1) },
      confirm,
    });

    expect(response.status).toBe(413);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("NOT_AUTHORIZED: 403", async () => {
    const confirm = vi.fn(async (): Promise<ConfirmImportResult> => ({ outcome: "NOT_AUTHORIZED" }));
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[]" },
      confirm,
    });

    expect(response.status).toBe(403);
  });

  it("COURSE_ARCHIVED: 409", async () => {
    const confirm = vi.fn(async (): Promise<ConfirmImportResult> => ({ outcome: "COURSE_ARCHIVED" }));
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[]" },
      confirm,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "COURSE_ARCHIVED" } });
  });

  it("MALFORMED_SOURCE: 400 with the adapter's own message", async () => {
    const confirm = vi.fn(
      async (): Promise<ConfirmImportResult> => ({ outcome: "MALFORMED_SOURCE", error: "not valid JSON" }),
    );
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "not json" },
      confirm,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "MALFORMED_SOURCE", message: "not valid JSON" } });
  });

  it("TOO_MANY_ROWS: 413 with the reported row count", async () => {
    const confirm = vi.fn(
      async (): Promise<ConfirmImportResult> => ({ outcome: "TOO_MANY_ROWS", totalRows: 2001 }),
    );
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[]" },
      confirm,
    });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: { code: "TOO_MANY_ROWS", totalRows: 2001 } });
  });

  it("INVALID_ROWS: 400 with row-level errors, zero writes implied by the outcome itself", async () => {
    const confirm = vi.fn(
      async (): Promise<ConfirmImportResult> => ({
        outcome: "INVALID_ROWS",
        totalRows: 2,
        invalidCount: 1,
        errors: [{ sourceRowNumber: 2, errors: ["prompt must not be empty"] }],
      }),
    );
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[...]" },
      confirm,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_ROWS",
        totalRows: 2,
        invalidCount: 1,
        errors: [{ sourceRowNumber: 2, errors: ["prompt must not be empty"] }],
      },
    });
  });

  it("STATE_CHANGED: 409", async () => {
    const confirm = vi.fn(async (): Promise<ConfirmImportResult> => ({ outcome: "STATE_CHANGED" }));
    const response = await handleConfirmImport({
      authenticate: authenticated(),
      courseId: COURSE_ID,
      body: { format: "JSON", sourceText: "[]" },
      confirm,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: "STATE_CHANGED" } });
  });

  it("CONFIRMED: 201 with createdCount/createdQuestionIds, passing actor/courseId/format/sourceText through", async () => {
    const confirm = vi.fn(
      async (): Promise<ConfirmImportResult> => ({
        outcome: "CONFIRMED",
        createdCount: 2,
        createdQuestionIds: ["question-1", "question-2"],
      }),
    );
    const response = await handleConfirmImport({
      authenticate: authenticated("real-user"),
      courseId: COURSE_ID,
      body: { format: "CSV", sourceText: "topic,type\nIntro,SINGLE_CHOICE" },
      confirm,
    });

    expect(response.status).toBe(201);
    expect(confirm).toHaveBeenCalledWith({
      actorUserId: "real-user",
      courseId: COURSE_ID,
      format: "CSV",
      sourceText: "topic,type\nIntro,SINGLE_CHOICE",
    });
    expect(response.body).toEqual({ createdCount: 2, createdQuestionIds: ["question-1", "question-2"] });
  });
});
