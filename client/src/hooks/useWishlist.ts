import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { WishlistInput, WishlistItem, WishlistResponse } from "@/lib/types";

export const wishlistKeys = {
  all: ["wishlist"] as const,
};

interface MutationContext {
  previous?: WishlistResponse;
}

export function useWishlist() {
  return useQuery({
    queryKey: wishlistKeys.all,
    queryFn: api.listWishlist,
    staleTime: 30 * 1000,
  });
}

export function useWishlistMutations() {
  const queryClient = useQueryClient();

  const add = useMutation<WishlistItem, Error, WishlistInput, MutationContext>({
    mutationFn: api.addWishlist,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: wishlistKeys.all });
      const previous = queryClient.getQueryData<WishlistResponse>(
        wishlistKeys.all,
      );

      queryClient.setQueryData<WishlistResponse>(
        wishlistKeys.all,
        (current) => {
          const items = current?.items ?? [];
          if (items.some((item) => item.volumeId === input.volumeId)) {
            return current ?? { items: [] };
          }
          return {
            items: [
              { ...input, addedAt: new Date().toISOString() },
              ...items,
            ],
          };
        },
      );

      return { previous };
    },
    onError: (error, _input, context) => {
      if (context) {
        queryClient.setQueryData(
          wishlistKeys.all,
          context.previous ?? { items: [] },
        );
      }
      toast.error(error.message);
    },
    onSuccess: (item) => {
      queryClient.setQueryData<WishlistResponse>(
        wishlistKeys.all,
        (current) => {
          const items = current?.items ?? [];
          const exists = items.some(
            (entry) => entry.volumeId === item.volumeId,
          );
          return {
            items: exists
              ? items.map((entry) =>
                  entry.volumeId === item.volumeId ? item : entry,
                )
              : [item, ...items],
          };
        },
      );
      toast.success("Saved to your shelf");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
    },
  });

  const remove = useMutation<void, Error, string, MutationContext>({
    mutationFn: api.removeWishlist,
    onMutate: async (volumeId) => {
      await queryClient.cancelQueries({ queryKey: wishlistKeys.all });
      const previous = queryClient.getQueryData<WishlistResponse>(
        wishlistKeys.all,
      );

      queryClient.setQueryData<WishlistResponse>(
        wishlistKeys.all,
        (current) => ({
          items: (current?.items ?? []).filter(
            (item) => item.volumeId !== volumeId,
          ),
        }),
      );

      return { previous };
    },
    onError: (error, _volumeId, context) => {
      if (context) {
        queryClient.setQueryData(
          wishlistKeys.all,
          context.previous ?? { items: [] },
        );
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast("Removed from your shelf");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
    },
  });

  return { add, remove };
}
