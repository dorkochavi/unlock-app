/**
 * Thin decorative progress track (Today / Practice Learn Mode). `aria-hidden`:
 * the numeric position is always rendered as text beside it, so this carries no
 * information of its own. Fill grows from the inline-start edge (RTL-correct).
 * `fraction` is clamped to 0..1.
 */
export function ProgressBar({ fraction, className }: { fraction: number; className?: string }) {
  const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return (
    <div
      aria-hidden="true"
      className={`h-1 overflow-hidden rounded-full bg-surface-muted ${className ?? "mb-8"}`}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
