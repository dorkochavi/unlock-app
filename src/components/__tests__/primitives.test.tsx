/**
 * Behavior evidence for shared presentational primitives. Server-renders
 * (Vitest environment is "node") and asserts semantics only, never class
 * strings.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, ButtonLink, buttonClasses } from "../button";
import { Card, setsPadding } from "../card";
import { Field } from "../field";
import { Input } from "../input";
import { LinkRow } from "../link-row";
import { Notice } from "../notice";
import { ProgressBar } from "../progress-bar";
import { StateBlock } from "../state-block";

describe("Button", () => {
  it("renders native disabled and passes aria-disabled through", () => {
    const html = renderToStaticMarkup(
      <>
        <Button disabled>a</Button>
        <ButtonLink href="/x" aria-disabled="true">
          b
        </ButtonLink>
      </>,
    );
    expect(html).toMatch(/<button[^>]*type="button"[^>]*disabled/);
    expect(html).toContain('aria-disabled="true"');
  });
});

describe("Notice", () => {
  it("uses alert for errors and status otherwise, overridable", () => {
    expect(renderToStaticMarkup(<Notice tone="error">x</Notice>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Notice tone="success">x</Notice>)).toContain('role="status"');
    expect(renderToStaticMarkup(<Notice>x</Notice>)).toContain('role="status"');
    expect(renderToStaticMarkup(<Notice tone="error" role="none">x</Notice>)).not.toContain("role=");
  });

  it("keeps the message text visible next to a decorative icon", () => {
    const html = renderToStaticMarkup(<Notice tone="error">Bad</Notice>);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Bad");
  });
});

describe("Field", () => {
  it("associates label, hint and error with the control", () => {
    const html = renderToStaticMarkup(
      <Field id="email" label="Email" hint="We never share" error="Required">
        {(props) => <Input type="email" {...props} />}
      </Field>,
    );
    expect(html).toContain('<label for="email"');
    expect(html).toMatch(/<input[^>]*id="email"/);
    expect(html).toContain('aria-describedby="email-hint email-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="email-hint"');
    expect(html).toContain('id="email-error"');
    expect(html).toContain('role="alert"');
  });

  it("omits describedby/invalid when there is no hint or error", () => {
    const html = renderToStaticMarkup(
      <Field id="n" label="Name">
        {(props) => <Input {...props} />}
      </Field>,
    );
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("aria-invalid=");
  });
});

describe("LinkRow", () => {
  it("renders one real link with a decorative chevron and no nested controls", () => {
    const html = renderToStaticMarkup(
      <LinkRow href="/courses/1" trailing={<span>Owner</span>}>
        Algebra
      </LinkRow>,
    );
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toContain('href="/courses/1"');
    expect(html).not.toMatch(/<button/);
    expect(html).toContain("Algebra");
    expect(html).toContain("Owner");
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("ProgressBar", () => {
  it("is decorative and clamps the fill width", () => {
    const html = renderToStaticMarkup(<ProgressBar fraction={2} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("width:100%");
    expect(renderToStaticMarkup(<ProgressBar fraction={Number.NaN} />)).toContain("width:0%");
  });
});

describe("StateBlock", () => {
  it("keeps role=alert only for errors and shows the supplied copy", () => {
    expect(renderToStaticMarkup(<StateBlock tone="error" title="Oops" body="Try later" />)).toContain(
      'role="alert"',
    );
    const neutral = renderToStaticMarkup(<StateBlock title="Empty" />);
    expect(neutral).not.toContain("role=");
    expect(neutral).toContain("Empty");
  });
});

describe("buttonClasses", () => {
  it("applies the disabled token only to filled/bordered variants and selects the height", () => {
    expect(buttonClasses("primary")).toContain("state-disabled");
    expect(buttonClasses("tertiary")).not.toContain("state-disabled");
    expect(buttonClasses("tertiary")).toContain("min-h-control");
    expect(buttonClasses("primary", { compact: true })).toContain("min-h-control-compact");
  });
});

describe("setsPadding (DS-01: regex lost its backslashes)", () => {
  it.each(["p-6", "mt-4 p-6", "sm:p-8", "mt-4 sm:p-8", "flex gap-4 hover:p-2", "md:hover:p-3"])(
    "detects a p-* shorthand in %j",
    (cls) => {
      expect(setsPadding(cls)).toBe(true);
    },
  );

  it.each(["px-5 py-4", "mt-4 px-5", "snap-start", "sp-1", "stop-x", "flex gap-4", "", undefined])(
    "does not treat %j as a p-* shorthand",
    (cls) => {
      expect(setsPadding(cls)).toBe(false);
    },
  );

  it("omits the default p-5 on Card and LinkRow when a non-first-token p-* is passed, keeps it otherwise", () => {
    const hasDefault = (html: string) => /(^|[\s"])p-5([\s"]|$)/.test(html);
    expect(hasDefault(renderToStaticMarkup(<Card className="mt-4 sm:p-8">x</Card>))).toBe(false);
    expect(hasDefault(renderToStaticMarkup(<Card className="mt-4 p-6">x</Card>))).toBe(false);
    expect(hasDefault(renderToStaticMarkup(<Card className="px-5 py-4">x</Card>))).toBe(true);
    expect(hasDefault(renderToStaticMarkup(<Card>x</Card>))).toBe(true);
    expect(hasDefault(renderToStaticMarkup(<LinkRow href="/a" className="mt-4 sm:p-8">x</LinkRow>))).toBe(false);
    expect(hasDefault(renderToStaticMarkup(<LinkRow href="/a" className="px-5 py-4">x</LinkRow>))).toBe(true);
    expect(hasDefault(renderToStaticMarkup(<LinkRow href="/a">x</LinkRow>))).toBe(true);
  });
});
