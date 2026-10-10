/**
 * FUB-068 Option B evidence. Evidence class: UNIT (pure helpers, node env) plus a SOURCE-WIRING check of
 * page.tsx. The page is not rendered (no DOM test library in this repo) and no real browser was driven,
 * so real `beforeunload` dialogs, link clicks, and browser back/forward are NOT proven here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { he } from "@/messages/he";

import {
  beforeUnloadHandler,
  confirmLeave,
  isGuardDirty,
  isPlainNavigationClick,
  syncBeforeUnloadGuard,
  type EditorFormValues,
} from "../editor-logic";

const base: EditorFormValues = {
  topicId: "t1",
  questionType: "SINGLE_CHOICE",
  prompt: "p",
  options: [{ id: "a", content: "A" }],
  correctOptionIds: ["a"],
  explanation: "e",
};
const edited = { ...base, prompt: "p changed" };

function fakeWindow() {
  const listeners = new Set<unknown>();
  return {
    listeners,
    addEventListener: vi.fn((_t: string, l: unknown) => void listeners.add(l)),
    removeEventListener: vi.fn((_t: string, l: unknown) => void listeners.delete(l)),
  };
}

describe("isGuardDirty", () => {
  it("is false before the baseline exists (loading) and when unchanged", () => {
    expect(isGuardDirty(null, edited)).toBe(false);
    expect(isGuardDirty(base, structuredClone(base))).toBe(false);
  });
  it("is true on edit, and false again after Save resets the baseline to the submitted values (case 10)", () => {
    expect(isGuardDirty(base, edited)).toBe(true);
    expect(isGuardDirty(edited, edited)).toBe(false);
  });
});

describe("confirmLeave (Back / Create Another)", () => {
  it("clean: proceeds without asking (cases 1, 5)", () => {
    const ask = vi.fn(() => false);
    expect(confirmLeave(false, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
  it("dirty: asks; cancel stays, confirm proceeds (cases 2, 3, 4, 6)", () => {
    expect(confirmLeave(true, vi.fn(() => false))).toBe(false);
    const ask = vi.fn(() => true);
    expect(confirmLeave(true, ask)).toBe(true);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});

describe("isPlainNavigationClick", () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  it("guards plain clicks only; modified/non-primary clicks open elsewhere and keep this editor", () => {
    expect(isPlainNavigationClick(click)).toBe(true);
    expect(isPlainNavigationClick({ ...click, ctrlKey: true })).toBe(false);
    expect(isPlainNavigationClick({ ...click, metaKey: true })).toBe(false);
    expect(isPlainNavigationClick({ ...click, shiftKey: true })).toBe(false);
    expect(isPlainNavigationClick({ ...click, button: 1 })).toBe(false);
  });
});

describe("syncBeforeUnloadGuard (case 11)", () => {
  it("installs the listener only while dirty and removes it on cleanup", () => {
    const w = fakeWindow();
    const cleanup = syncBeforeUnloadGuard(w, true);
    expect(w.listeners.size).toBe(1);
    expect(w.addEventListener).toHaveBeenCalledWith("beforeunload", beforeUnloadHandler);
    cleanup();
    expect(w.listeners.size).toBe(0);
  });
  it("installs nothing when clean or without a window; cleanup is a safe no-op", () => {
    const w = fakeWindow();
    syncBeforeUnloadGuard(w, false)();
    syncBeforeUnloadGuard(null, true)();
    expect(w.addEventListener).not.toHaveBeenCalled();
    expect(w.removeEventListener).not.toHaveBeenCalled();
  });
  it("dirty -> clean -> dirty never leaks more than one listener", () => {
    const w = fakeWindow();
    const c1 = syncBeforeUnloadGuard(w, true);
    c1();
    syncBeforeUnloadGuard(w, false)();
    const c3 = syncBeforeUnloadGuard(w, true);
    expect(w.listeners.size).toBe(1);
    c3();
    expect(w.listeners.size).toBe(0);
  });
  it("handler requests the browser prompt", () => {
    const event = { preventDefault: vi.fn(), returnValue: undefined as unknown } as unknown as BeforeUnloadEvent;
    beforeUnloadHandler(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("");
  });
});

describe("page wiring (source check; not a rendered test)", () => {
  const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
  const publishBody = src.slice(src.indexOf("async function handlePublish()"), src.indexOf("return (\n    <main"));

  it("handlePublish returns before any fetch when dirty (cases 7-9)", () => {
    const guardAt = publishBody.indexOf("if (guardDirty)");
    const fetchAt = publishBody.indexOf("fetch(");
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(fetchAt);
    expect(publishBody.slice(guardAt, fetchAt)).toContain("publishUnsavedError");
    expect(publishBody.slice(guardAt, fetchAt)).toContain("return;");
    expect(publishBody.slice(guardAt, fetchAt)).toContain("setPublishedAt(null)");
  });
  it("back link and create-another are guarded; Create Another confirms before creating", () => {
    expect(src).toContain("onClick={handleBackClick}");
    const create = src.slice(src.indexOf("async function handleCreateAnother()"), src.indexOf("async function handleSave"));
    expect(create.indexOf("confirmDiscardEdits()")).toBeGreaterThan(-1);
    expect(create.indexOf("confirmDiscardEdits()")).toBeLessThan(create.indexOf("createEmptyQuestion("));
  });
  it("Save success clears the stale publish notice", () => {
    expect(src).toMatch(/setBaseline\(submitted\);[\s\S]{0,200}setPublishError\(null\)/);
  });
  it("hides the save-first notice once the form is clean again", () => {
    expect(src).toContain("!guardDirty && publishError === messages.questionEditor.publishUnsavedError ? null : publishError");
    expect(src).toContain("{shownPublishError ? <Notice");
  });
  it("introduces no local persistence or autosave (case 12)", () => {
    for (const file of ["page.tsx", "editor-logic.ts", "create-another-action.tsx"]) {
      const text = readFileSync(join(__dirname, "..", file), "utf8");
      expect(text).not.toMatch(/localStorage|sessionStorage|indexedDB|setInterval|autosave/i);
    }
  });
});

describe("Hebrew copy", () => {
  it("publish notice says unsaved + not published; confirm asks to discard", () => {
    expect(he.questionEditor.publishUnsavedError).toContain("לא נשמרו");
    expect(he.questionEditor.publishUnsavedError).toContain("הפרסום לא בוצע");
    expect(he.questionEditor.leaveUnsavedConfirm).toContain("לעזוב");
  });
});
