import { BookOpen, Info, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ResultBand } from "@/components/ResultBand";
import { SearchHero } from "@/components/SearchHero";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Button } from "@/components/ui/button";
import { useBooks } from "@/hooks/useBooks";
import { useWishlist, useWishlistMutations } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";
import { toWishlistInput, type Book } from "@/lib/types";

const numberFormat = new Intl.NumberFormat("en-US");
const SKELETON_KEYS = Array.from({ length: 8 }, (_, index) => index);

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const [input, setInput] = useState(query);

  // Keep the field in sync with browser back/forward without writing to state
  // during render or directly inside an effect.
  useEffect(() => {
    function handlePopState() {
      setInput(new URLSearchParams(window.location.search).get("q") ?? "");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed === query) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSearchParams(trimmed ? { q: trimmed } : {}, { replace: true });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [input, query, setSearchParams]);

  const books = useBooks(query);
  const wishlist = useWishlist();
  const { add, remove } = useWishlistMutations();

  const savedIds = new Set(
    wishlist.data?.items.map((item) => item.volumeId) ?? [],
  );
  const pendingIds = new Set<string>();
  if (add.isPending && add.variables) {
    pendingIds.add(add.variables.volumeId);
  }
  if (remove.isPending && remove.variables) {
    pendingIds.add(remove.variables);
  }

  function commitSearch(next: string) {
    const trimmed = next.trim();
    setSearchParams(trimmed ? { q: trimmed } : {});

    if (trimmed.length >= 2) {
      window.requestAnimationFrame(() => {
        document
          .getElementById("results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function handleToggle(book: Book) {
    if (savedIds.has(book.id)) {
      remove.mutate(book.id);
      return;
    }
    add.mutate(toWishlistInput(book));
  }

  const hasQuery = query.length >= 2;
  const isFirstLoad = books.isPending && hasQuery;
  const isRefreshing = books.isFetching && !books.isFetchingNextPage;
  const notice = books.data?.pages[0]?.notice ?? null;

  return (
    <>
      <SearchHero
        value={input}
        onChange={setInput}
        onSubmit={() => commitSearch(input)}
        onSuggestion={(value) => {
          setInput(value);
          commitSearch(value);
        }}
      />

      {!hasQuery ? (
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex items-start gap-3 border-t border-line pt-6 text-sm text-muted-foreground">
            <BookOpen
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={1.6}
              aria-hidden="true"
            />
            <p>
              Results appear here. Tap the heart on any cover to keep a book on
              your shelf.
            </p>
          </div>
        </div>
      ) : (
        <>
          <ResultBand
            id="results"
            title={`“${query}”`}
            meta={`${numberFormat.format(books.totalItems)} ${
              books.totalItems === 1 ? "book" : "books"
            }`}
            isRefreshing={isRefreshing}
          />

          <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
            {notice && (
              <div className="mb-8 flex items-start gap-2.5 border border-line bg-surface px-4 py-3">
                <Info
                  className="mt-0.5 size-4 shrink-0 text-brand-strong"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {notice}
                </p>
              </div>
            )}

            {books.isError ? (
              <ErrorState
                title="Search didn't go through"
                message={
                  books.error instanceof Error
                    ? books.error.message
                    : "Something went wrong while searching. Try again."
                }
                onRetry={() => void books.refetch()}
              />
            ) : isFirstLoad ? (
              <div
                className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4"
                aria-hidden="true"
              >
                {SKELETON_KEYS.map((key) => (
                  <SkeletonCard key={key} />
                ))}
              </div>
            ) : books.books.length === 0 ? (
              <EmptyState
                icon="search"
                title={`No books found for “${query}”`}
                description="Try a shorter query, a different spelling, or an author you already know."
              />
            ) : (
              <>
                <div
                  className={cn(
                    "grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4",
                    isRefreshing && "opacity-60 transition-opacity",
                  )}
                >
                  {books.books.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      saved={savedIds.has(book.id)}
                      pending={pendingIds.has(book.id)}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>

                {books.hasNextPage && (
                  <div className="mt-12 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void books.fetchNextPage()}
                      disabled={books.isFetchingNextPage}
                    >
                      {books.isFetchingNextPage ? (
                        <>
                          <Loader2 className="animate-spin" aria-hidden="true" />
                          Loading…
                        </>
                      ) : (
                        "Load more books"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
