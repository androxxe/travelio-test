import { Link } from "react-router-dom";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ResultBand } from "@/components/ResultBand";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Button } from "@/components/ui/button";
import { useWishlist, useWishlistMutations } from "@/hooks/useWishlist";
import type { Book } from "@/lib/types";

const SKELETON_KEYS = Array.from({ length: 4 }, (_, index) => index);

function itemToBook(item: {
  volumeId: string;
  title: string;
  authors: string[];
  thumbnail: string | null;
  averageRating: number | null;
  ratingsCount: number;
}): Book {
  return {
    id: item.volumeId,
    title: item.title,
    subtitle: null,
    authors: item.authors,
    thumbnail: item.thumbnail,
    publishedDate: null,
    averageRating: item.averageRating,
    ratingsCount: item.ratingsCount,
    previewLink: null,
    categories: [],
  };
}

export function WishlistPage() {
  const wishlist = useWishlist();
  const { remove } = useWishlistMutations();

  const items = wishlist.data?.items ?? [];
  const pendingId = remove.isPending ? remove.variables : undefined;

  return (
    <>
      <ResultBand
        tone="ink"
        title="Your shelf"
        meta={
          wishlist.isPending
            ? "Loading your shelf…"
            : `${items.length} ${items.length === 1 ? "book" : "books"} saved`
        }
        isRefreshing={wishlist.isFetching && !wishlist.isPending}
      />

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {wishlist.isPending ? (
          <div
            className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4"
            aria-hidden="true"
          >
            {SKELETON_KEYS.map((key) => (
              <SkeletonCard key={key} />
            ))}
          </div>
        ) : wishlist.isError ? (
          <ErrorState
            title="Couldn't load your shelf"
            message={
              wishlist.error instanceof Error
                ? wishlist.error.message
                : "Something went wrong while loading your wishlist."
            }
            onRetry={() => void wishlist.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Your shelf is empty."
            description="Search for a book and tap the heart on its cover to keep it here."
            action={
              <Button asChild>
                <Link to="/">Find books</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
            {items.map((item) => {
              const book = itemToBook(item);
              return (
                <BookCard
                  key={item.volumeId}
                  book={book}
                  saved
                  pending={pendingId === item.volumeId}
                  onToggle={() => remove.mutate(item.volumeId)}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
