"use client";

import { useEffect, useRef } from "react";

import { ButtonLink } from "@/components/button";
import { getMessages } from "@/messages";

/**
 * FUB-044 Instructor 401 recovery. Shown INLINE when an Instructor mutation
 * returns 401: the page and any unsaved React draft stay mounted. Sign-in opens
 * in a NEW tab (the Supabase session cookie is shared across tabs), after which
 * the Instructor returns here and retries explicitly. Deliberately has no
 * retry/replay, no navigation and no storage. `signInHref` must come from
 * `buildSignInHref` (allowlisted `next` only).
 */
export function InstructorSessionExpiredNotice({ signInHref }: { signInHref: string }) {
  const messages = getMessages().instructor.sessionExpired;
  const ref = useRef<HTMLDivElement>(null);

  // The failing control may be far from the notice: bring it into view once.
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest" });
  }, []);

  return (
    <div
      ref={ref}
      role="alert"
      className="mb-4 flex flex-col gap-2 rounded-control bg-danger-soft px-4 py-3 text-danger"
    >
      <p className="text-body font-bold">{messages.title}</p>
      <p className="break-words text-secondary">{messages.body}</p>
      <div>
        <ButtonLink href={signInHref} target="_blank" rel="noopener noreferrer" variant="secondary" compact>
          {messages.action}
        </ButtonLink>
      </div>
    </div>
  );
}
