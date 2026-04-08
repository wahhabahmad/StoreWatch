import { HOT_RATING_THRESHOLD } from "@/lib/itunes-lookup-batch";

/** Apple does not publish download counts; we use user ratings as a popularity signal. */
export function HotRatingBadge({
  userRatingCount,
  className = "",
}: {
  userRatingCount: number;
  className?: string;
}) {
  const label = `Hot: ${userRatingCount.toLocaleString()} App Store ratings (threshold ${HOT_RATING_THRESHOLD}+; install counts are not public on iOS)`;
  return (
    <span
      className={`inline-flex items-center text-base leading-none text-orange-500 ${className}`}
      title={label}
      role="img"
      aria-label={label}
    >
      🔥
    </span>
  );
}

export { HOT_RATING_THRESHOLD };
