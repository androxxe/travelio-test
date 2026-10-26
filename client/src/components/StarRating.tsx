import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number | null;
  ratingsCount?: number;
  className?: string;
}

const STARS = [0, 1, 2, 3, 4];

export function formatRatingCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

/**
 * Read-only fractional star meter. The filled row is clipped by width, which
 * keeps half-star rendering exact without an extra dependency.
 */
export function StarRating({
  rating,
  ratingsCount = 0,
  className,
}: StarRatingProps) {
  const clamped =
    rating === null ? 0 : Math.min(Math.max(rating, 0), 5);
  const percentage = (clamped / 5) * 100;
  const label =
    rating === null
      ? "No ratings yet"
      : `Rated ${clamped.toFixed(1)} out of 5${
          ratingsCount > 0 ? ` from ${ratingsCount} ratings` : ""
        }`;

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={label}
    >
      <span className="relative inline-flex" aria-hidden="true">
        <span className="flex gap-0.5 text-[#DCD8D0]">
          {STARS.map((index) => (
            <Star
              key={index}
              className="size-3.5 shrink-0 fill-current"
              strokeWidth={0}
            />
          ))}
        </span>
        <span
          className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-rating"
          style={{ width: `${percentage}%` }}
        >
          {STARS.map((index) => (
            <Star
              key={index}
              className="size-3.5 shrink-0 fill-current"
              strokeWidth={0}
            />
          ))}
        </span>
      </span>

      {rating === null ? (
        <span className="text-[11px] text-muted-foreground">
          No ratings yet
        </span>
      ) : (
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {clamped.toFixed(1)}
          {ratingsCount > 0 && (
            <span className="font-normal">
              {" "}
              ({formatRatingCount(ratingsCount)})
            </span>
          )}
        </span>
      )}
    </div>
  );
}
