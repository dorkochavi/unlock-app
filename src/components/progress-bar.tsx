/**
 * Rounded decorative progress track (Today / Practice Learn Mode). `aria-hidden`:
 * the numeric position is always rendered as text beside it, so this carries no
 * information of its own. Fill grows from the inline-start edge (RTL-correct).
 * `fraction` is clamped to 0..1.
 *
 * Optional presentation props (no behavior): `segments` (2..20) renders a
 * segmented track (one pill per step, filled = round(fraction * segments));
 * `size="lg"` is the thicker hero/immersive weight; `tone="hero"` is for use on
 * the deep-indigo hero surface (white fill on a translucent track).
 */
export function ProgressBar({
  fraction,
  className,
  segments,
  size = "md",
  tone = "default",
}: {
  fraction: number;
  className?: string;
  segments?: number;
  size?: "md" | "lg";
  tone?: "default" | "hero";
}) {
  const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const track = tone === "hero" ? "bg-hero-soft" : "bg-primary-soft";
  const fill = tone === "hero" ? "bg-white" : "bg-primary";

  if (segments !== undefined && Number.isInteger(segments) && segments >= 2 && segments <= 20) {
    const filled = Math.round(clamped * segments);
    return (
      <div aria-hidden="true" className={`flex gap-1.5 ${className ?? "mb-8"}`}>
        {Array.from({ length: segments }).map((_, index) => (
          <div
            key={index}
            className={`flex-1 rounded-full transition-colors duration-300 ${
              size === "lg" ? "h-2.5" : "h-1.5"
            } ${index < filled ? fill : track}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${size === "lg" ? "h-3" : "h-2"} overflow-hidden rounded-full ${track} ${className ?? "mb-8"}`}
    >
      <div
        className={`h-full rounded-full ${fill} transition-[width] duration-500 ease-out`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
