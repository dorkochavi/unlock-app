/**
 * PREVIEW-QA-FIX-001 evidence. The Question editor page itself is NOT rendered
 * here (Vitest env is "node", no jsdom; the page is a heavy client component):
 * coverage is at the pure-helper level (`editor-logic.ts`) plus server-rendered
 * markup of the presentational `CreateAnotherAction`. The page wires these
 * together (baseline snapshot at load/save, `shouldShowCreateAnother`).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { assertQuestionPublishReady } from "@/domain/question/types";
import { he } from "@/messages/he";

import { CreateAnotherAction } from "../create-another-action";
import {
  createEmptyQuestion,
  isEditorDirty,
  optionControlLabel,
  publishNotReadyMessage,
  shouldShowCreateAnother,
  type EditorFormValues,
} from "../editor-logic";

const base: EditorFormValues = {
  topicId: "t1",
  questionType: "MULTIPLE_CHOICE",
  prompt: "p",
  options: [
    { id: "a", content: "A" },
    { id: "b", content: "B" },
  ],
  correctOptionIds: ["a", "b"],
  explanation: "e",
};

const okFlags = {
  courseArchived: false,
  dirty: false,
  savedOk: false,
  publishedOk: false,
  saveError: false,
  publishError: false,
};

describe("isEditorDirty", () => {
  it("is clean for an identical (cloned) form, regardless of correct-id order", () => {
    expect(isEditorDirty(base, structuredClone(base))).toBe(false);
    expect(isEditorDirty(base, { ...base, correctOptionIds: ["b", "a"] })).toBe(false);
  });

  it.each<[string, Partial<EditorFormValues>]>([
    ["topic", { topicId: "" }],
    ["type", { questionType: "SINGLE_CHOICE" }],
    ["prompt", { prompt: "p2" }],
    ["explanation", { explanation: "" }],
    ["option content", { options: [{ id: "a", content: "A!" }, base.options[1]] }],
    ["option added", { options: [...base.options, { id: "c", content: "" }] }],
    ["option removed", { options: [base.options[0]], correctOptionIds: ["a", "b"] }],
    ["option reordered", { options: [base.options[1], base.options[0]] }],
    ["correct toggled off", { correctOptionIds: ["a"] }],
    ["correct changed", { correctOptionIds: ["a", "c"] }],
  ])("detects a %s change", (_name, patch) => {
    expect(isEditorDirty(base, { ...base, ...patch })).toBe(true);
  });

  it("returns to clean when an edit is reverted", () => {
    const edited = { ...base, prompt: "x" };
    expect(isEditorDirty(base, edited)).toBe(true);
    expect(isEditorDirty(base, { ...edited, prompt: "p" })).toBe(false);
  });
});

describe("shouldShowCreateAnother", () => {
  it("is hidden before any save/publish", () => {
    expect(shouldShowCreateAnother(okFlags)).toBe(false);
  });
  it("is shown after a clean successful save and after a clean successful publish", () => {
    expect(shouldShowCreateAnother({ ...okFlags, savedOk: true })).toBe(true);
    expect(shouldShowCreateAnother({ ...okFlags, publishedOk: true })).toBe(true);
  });
  it("is hidden when dirty (edit after save), and shown again once clean (save again)", () => {
    expect(shouldShowCreateAnother({ ...okFlags, savedOk: true, dirty: true })).toBe(false);
    expect(shouldShowCreateAnother({ ...okFlags, savedOk: true, dirty: false })).toBe(true);
  });
  it("is hidden on save/publish error", () => {
    expect(shouldShowCreateAnother({ ...okFlags, savedOk: true, saveError: true })).toBe(false);
    expect(shouldShowCreateAnother({ ...okFlags, publishedOk: true, publishError: true })).toBe(false);
  });
  it("is never available for an ARCHIVED Course", () => {
    expect(shouldShowCreateAnother({ ...okFlags, savedOk: true, publishedOk: true, courseArchived: true })).toBe(false);
  });
});

describe("createEmptyQuestion", () => {
  it("POSTs to the Course questions route with no body and returns the new id", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ question: { id: "q-new" } }), { status: 201 }));
    const result = await createEmptyQuestion("course-1", fetchFn as unknown as typeof fetch);
    expect(result).toEqual({ outcome: "CREATED", questionId: "q-new" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith("/api/courses/course-1/questions", { method: "POST" });
  });
  it("reports ERROR on non-ok, malformed body, and network failure", async () => {
    const notOk = vi.fn(async () => new Response("{}", { status: 500 }));
    const noId = vi.fn(async () => new Response("{}", { status: 201 }));
    const boom = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await createEmptyQuestion("c", notOk as unknown as typeof fetch)).toEqual({ outcome: "ERROR" });
    expect(await createEmptyQuestion("c", noId as unknown as typeof fetch)).toEqual({ outcome: "ERROR" });
    expect(await createEmptyQuestion("c", boom as unknown as typeof fetch)).toEqual({ outcome: "ERROR" });
  });
});

describe("CreateAnotherAction markup", () => {
  const props = {
    onCreate: vi.fn(),
    label: he.questionEditor.createAnotherAction,
    creatingLabel: he.questionEditor.creatingAnother,
  };
  it("renders the Hebrew action, enabled", () => {
    const html = renderToStaticMarkup(<CreateAnotherAction {...props} creating={false} error={null} />);
    expect(html).toContain("יצירת שאלה נוספת");
    expect(html).toContain('type="button"');
    expect(html).not.toMatch(/disabled=""/);
  });
  it("is disabled with the in-flight label while creating (prevents double create)", () => {
    const html = renderToStaticMarkup(<CreateAnotherAction {...props} creating error={null} />);
    expect(html).toMatch(/disabled=""/);
    expect(html).toContain(he.questionEditor.creatingAnother);
    expect(html).not.toContain("יצירת שאלה נוספת");
  });
  it("shows the Hebrew create error", () => {
    const html = renderToStaticMarkup(
      <CreateAnotherAction {...props} creating={false} error={he.questionEditor.createAnotherError} />,
    );
    expect(html).toContain(he.questionEditor.createAnotherError);
  });
});

describe("publishNotReadyMessage (Hebrew publish-readiness mapping)", () => {
  it("maps the REAL wire reason (domain error message, prefixed) to Hebrew only", () => {
    // The publish API sends `reason: error.message`; take it from the real domain rule, not a hand-typed string.
    let wireReason = "";
    try {
      assertQuestionPublishReady({
        topicId: null,
        questionType: "SINGLE_CHOICE",
        prompt: "p",
        answerOptions: [],
        correctOptionIds: [],
        explanation: null,
      } as unknown as Parameters<typeof assertQuestionPublishReady>[0]);
    } catch (error) {
      wireReason = (error as Error).message;
    }
    expect(wireReason).toBe("Question is not publish-ready: a Topic must be selected before publishing");

    const message = publishNotReadyMessage(wireReason, he.questionEditor);
    expect(message).toBe(he.questionEditor.publishTopicRequiredError);
    expect(message).not.toMatch(/publish-ready|Topic must be selected/);
  });
  it("also maps the bare Topic-required reason to Hebrew only", () => {
    const message = publishNotReadyMessage("a Topic must be selected before publishing", he.questionEditor);
    expect(message).toBe(he.questionEditor.publishTopicRequiredError);
    expect(message).not.toMatch(/Topic must be selected/);
  });
  it("keeps the generic interpolated message for other reasons (prefixed or not)", () => {
    expect(publishNotReadyMessage("some other reason", he.questionEditor)).toBe("לא ניתן לפרסם: some other reason");
    expect(publishNotReadyMessage("Question is not publish-ready: prompt must not be empty", he.questionEditor)).toBe(
      "לא ניתן לפרסם: Question is not publish-ready: prompt must not be empty",
    );
  });
});

describe("createEmptyQuestion — 401 (FUB-044)", () => {
  it("reports UNAUTHENTICATED (single request, no replay) while other failures stay ERROR", async () => {
    const unauth = vi.fn(async () => new Response("{}", { status: 401 }));
    expect(await createEmptyQuestion("c", unauth as unknown as typeof fetch)).toEqual({
      outcome: "UNAUTHENTICATED",
    });
    expect(unauth).toHaveBeenCalledTimes(1);
    const forbidden = vi.fn(async () => new Response("{}", { status: 403 }));
    expect(await createEmptyQuestion("c", forbidden as unknown as typeof fetch)).toEqual({ outcome: "ERROR" });
  });
});

describe("optionControlLabel (Q3-B accessible names)", () => {
  const options = (n: number) => Array.from({ length: n }, (_, i) => ({ id: "o" + i }));
  const names = (template: string, opts: { id: string }[]) => opts.map((_, i) => optionControlLabel(template, i));

  it("numbers option inputs and correct-answer controls 1-based with the approved Hebrew wording", () => {
    expect(optionControlLabel(he.questionEditor.optionInputLabel, 0)).toBe("אפשרות 1");
    expect(optionControlLabel(he.questionEditor.correctOptionLabel, 3)).toBe("סימון אפשרות 4 כתשובה נכונה");
  });

  it("yields distinct names for every option, for any option count", () => {
    for (const n of [2, 4, 7]) {
      for (const key of ["optionInputLabel", "correctOptionLabel"] as const) {
        const got = names(he.questionEditor[key], options(n));
        expect(new Set(got).size).toBe(n);
      }
    }
  });

  it("follows the current rendered order after a removal (option 2 of 4 removed -> 1,2,3)", () => {
    const rendered = options(4).filter((o) => o.id !== "o1");
    expect(names(he.questionEditor.optionInputLabel, rendered)).toEqual(["אפשרות 1", "אפשרות 2", "אפשרות 3"]);
    expect(names(he.questionEditor.correctOptionLabel, rendered)).toEqual([
      "סימון אפשרות 1 כתשובה נכונה",
      "סימון אפשרות 2 כתשובה נכונה",
      "סימון אפשרות 3 כתשובה נכונה",
    ]);
  });
});
