import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import type { Book } from "@/lib/types";

export function useBooks(query: string) {
  const result = useInfiniteQuery({
    queryKey: ["books", query],
    queryFn: ({ pageParam, signal }) =>
      api.searchBooks({ query, page: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const books = useMemo(() => {
    const seen = new Set<string>();
    const items: Book[] = [];

    for (const page of result.data?.pages ?? []) {
      for (const book of page.items) {
        if (!seen.has(book.id)) {
          seen.add(book.id);
          items.push(book);
        }
      }
    }

    return items;
  }, [result.data]);

  return {
    ...result,
    books,
    totalItems: result.data?.pages[0]?.totalItems ?? 0,
  };
}
