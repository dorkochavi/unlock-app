/**
 * Label + control + hint + error cluster. Wires `htmlFor`, `aria-describedby`
 * and `aria-invalid` to the control through a render prop, so any of
 * `Input` / `Select` / `Textarea` can be used:
 *
 *   <Field id="email" label="Email" error={error}>
 *     {(controlProps) => <Input type="email" {...controlProps} />}
 *   </Field>
 *
 * Server-safe: the caller supplies a stable `id` (no hooks).
 */
import type { ReactNode } from "react";

import { Notice } from "./notice";

export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (controlProps: FieldControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-secondary font-semibold">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="mt-1 text-meta text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <div id={errorId} className="mt-1">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </div>
  );
}
