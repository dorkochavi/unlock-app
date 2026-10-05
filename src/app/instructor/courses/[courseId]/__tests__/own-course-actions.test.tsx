/**
 * Slice A evidence: Author -> Learner self-enrollment discoverability.
 * Server-renders the view (Vitest env is "node") and exercises the join-call
 * mapping against the EXISTING `POST /api/courses/:id/join` contract.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { enrollSelfAsLearner, OwnCourseActionsView } from "../own-course-actions";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("OwnCourseActionsView", () => {
  it("shows both manage and learn actions", () => {
    const html = renderToStaticMarkup(
      <OwnCourseActionsView manageHref="#course-management" onLearn={vi.fn()} learning={false} errorMessage={null} />,
    );
    expect(html).toContain("לניהול הקורס");
    expect(html).toContain("ללמוד את הקורס");
    expect(html).toContain('href="#course-management"');
    expect(html).not.toContain("role=\"alert\"");
  });

  it("disables the learn action while joining and renders an error when given", () => {
    const html = renderToStaticMarkup(
      <OwnCourseActionsView manageHref="#x" onLearn={vi.fn()} learning errorMessage="שגיאה" />,
    );
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain("שגיאה");
  });
});

describe("enrollSelfAsLearner (existing join endpoint mapping)", () => {
  it("POSTs to the existing join route and treats JOINED and ALREADY_MEMBER (200) as ready", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { status: "JOINED", role: "LEARNER" }));
    expect(await enrollSelfAsLearner("c-1", fetchImpl as unknown as typeof fetch)).toBe("READY");
    expect(fetchImpl).toHaveBeenCalledWith("/api/courses/c-1/join", { method: "POST" });

    const again = vi.fn().mockResolvedValue(jsonResponse(200, { status: "ALREADY_MEMBER", role: "LEARNER" }));
    expect(await enrollSelfAsLearner("c-1", again as unknown as typeof fetch)).toBe("READY");
  });

  it("maps 401/404/403/ACCESS_REVOKED/500/network failure to distinct non-ready outcomes", async () => {
    const run = (r: Response | Error) =>
      enrollSelfAsLearner(
        "c-1",
        (r instanceof Error ? vi.fn().mockRejectedValue(r) : vi.fn().mockResolvedValue(r)) as unknown as typeof fetch,
      );
    expect(await run(jsonResponse(401, {}))).toBe("UNAUTHENTICATED");
    expect(await run(jsonResponse(404, {}))).toBe("NOT_FOUND");
    expect(await run(jsonResponse(403, { error: { code: "NOT_AUTHORIZED" } }))).toBe("NOT_AUTHORIZED");
    expect(await run(jsonResponse(403, { error: { code: "ACCESS_REVOKED" } }))).toBe("ACCESS_REVOKED");
    expect(await run(jsonResponse(500, {}))).toBe("ERROR");
    expect(await run(new Error("net"))).toBe("ERROR");
  });
});
