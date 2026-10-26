import { BookOpen, Heart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Book } from "@/lib/types";
import { StarRating } from "./StarRating";

interface BookCardProps {
  book: Book;
  saved: boolean;
  pending?: boolean;
  onToggle: (book: Book) => void;
}

function CoverPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col justify-between bg-[#EFEDE8] p-3">
      <span className="h-1 w-7 bg-brand" />
      <BookOpen
        className="mx-auto size-7 text-[#B9B4AA]"
        strokeWidth={1.2}
        aria-hidden="true"
      />
      <span className="line-clamp-3 font-serif text-[11px] leading-tight text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

export function BookCard({ book, saved, pending = false, onToggle }: BookCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showCover = Boolean(book.thumbnail) && !imageFailed;
  const isDemo = book.id.startsWith("demo-");

  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-[0_18px_35px_-30px_rgba(23,24,26,0.65)] transition-shadow duration-300 group-hover:shadow-[0_28px_50px_-28px_rgba(23,24,26,0.5)]">
        <div className="aspect-[2/3] w-full">
          {showCover ? (
            <img
              src={book.thumbnail ?? undefined}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
            />
          ) : (
            <CoverPlaceholder title={book.title} />
          )}
        </div>

        {isDemo && (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-medium text-white">
            Demo
          </span>
        )}

        <button
          type="button"
          onClick={() => onToggle(book)}
          disabled={pending}
          aria-pressed={saved}
          aria-busy={pending}
          aria-label={
            saved
              ? `Remove ${book.title} from your shelf`
              : `Save ${book.title} to your shelf`
          }
          className={cn(
            "absolute right-2 top-2 grid size-9 place-items-center rounded-full border transition-colors duration-200 disabled:opacity-70",
            saved
              ? "border-brand bg-brand text-white hover:border-brand-strong hover:bg-brand-strong"
              : "border-line/80 bg-surface/95 text-ink hover:border-brand hover:text-brand",
          )}
        >
          <Heart
            className={cn("size-4", saved && "scale-105 fill-current")}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <div className="mt-3 flex flex-1 flex-col">
        <h3
          className="line-clamp-2 min-h-[2.6em] font-serif text-[1.05rem] font-medium leading-[1.3] text-ink"
          title={book.title}
        >
          {book.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-[0.8rem] text-muted-foreground">
          {book.authors.length > 0 ? book.authors.join(", ") : "Unknown author"}
        </p>
        <StarRating
          rating={book.averageRating}
          ratingsCount={book.ratingsCount}
          className="mt-2"
        />
      </div>
    </article>
  );
}
