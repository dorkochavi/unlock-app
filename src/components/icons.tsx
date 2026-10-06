/**
 * Small inline SVG glyphs shared by state/notice primitives (no dependency).
 * Always decorative (`aria-hidden`): meaning is carried by adjacent text, so a
 * tone is never conveyed by color alone.
 */
export type NoticeTone = "error" | "success" | "info";

export function ToneIcon({ tone, className }: { tone: NoticeTone | "neutral"; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-5"}
    >
      {tone === "error" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5h.01" />
        </>
      ) : tone === "success" ? (
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.5h.01" />
        </>
      )}
    </svg>
  );
}
