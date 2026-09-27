/**
 * Loading placeholder shaped like the content it replaces, so a page keeps
 * its layout/hierarchy visible while waiting instead of collapsing to a
 * plain line and then jumping once data arrives (Run UX-03 audit finding:
 * no route showed a shaped loading state). `motion-reduce:animate-none`
 * honors `prefers-reduced-motion` per-element in addition to the global
 * rule in `globals.css`.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none ${className ?? ""}`}
    />
  );
}

/** A vertical stack of row-shaped skeletons, announced once via `role="status"`. */
export function SkeletonRows({
  count,
  label,
  rowClassName,
}: {
  count: number;
  label: string;
  rowClassName?: string;
}) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} className={rowClassName ?? "h-12 w-full"} />
        ))}
      </div>
    </div>
  );
}
