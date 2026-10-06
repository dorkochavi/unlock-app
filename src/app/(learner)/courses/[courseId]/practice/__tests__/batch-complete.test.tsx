/**
 * Slice E: the continue control keeps the summary visible with an inline
 * pending/retry state — no LoadingState (full-screen) replaces it.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMessages } from "@/messages";

import { BatchComplete, type MoreStatus } from "../batch-complete";

function render(moreStatus: MoreStatus, hasMore = true) {
  return renderToStaticMarkup(
    <BatchComplete
      answered={10}
      skipped={0}
      correctCount={7}
      topicsTouched={2}
      hasMore={hasMore}
      originHref="/courses/c"
      backLabelText="BACK"
      moreStatus={moreStatus}
      onMore={() => {}}
    />,
  );
}

const m = getMessages().practice;

describe("BatchComplete inline continue states", () => {
  it("idle: summary + enabled 'more' button", () => {
    const html = render("idle");
    expect(html).toContain(m.batchCompleteTitle);
    expect(html).toContain(m.more);
    expect(html).not.toContain(" disabled=");
  });
  it("pending: summary retained, button disabled+busy with inline loading copy, no alert", () => {
    const html = render("pending");
    expect(html).toContain(m.batchCompleteTitle);
    expect(html).toContain(m.batchEncouragement);
    expect(html).toContain(" disabled=");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(m.loading);
    expect(html).not.toContain('role="alert"');
  });
  it("error: summary retained, alert shown, same button is the retry", () => {
    const html = render("error");
    expect(html).toContain(m.batchCompleteTitle);
    expect(html).toContain('role="alert"');
    expect(html).toContain(m.genericErrorTitle);
    expect(html).toContain(m.retry);
    expect(html).not.toContain(" disabled=");
  });
  it("no-more continuation: no 'more' button when hasMore is false", () => {
    const html = render("idle", false);
    expect(html).not.toContain(m.more);
    expect(html).toContain("BACK");
  });
});
