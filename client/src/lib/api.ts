import type {
  BookSearchResponse,
  WishlistInput,
  WishlistItem,
  WishlistResponse,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & ErrorEnvelope)
    | null;

  if (!response.ok) {
    const error = (payload as ErrorEnvelope | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "Something went wrong. Try again.",
    );
  }

  return payload as T;
}

export const api = {
  searchBooks({
    query,
    page,
    signal,
  }: {
    query: string;
    page: number;
    signal?: AbortSignal;
  }): Promise<BookSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      limit: "20",
    });
    return request<BookSearchResponse>(`/books?${params.toString()}`, {
      signal,
    });
  },

  async listWishlist(): Promise<WishlistResponse> {
    return request<WishlistResponse>("/wishlist");
  },

  async addWishlist(input: WishlistInput): Promise<WishlistItem> {
    const response = await request<{ item: WishlistItem }>("/wishlist", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return response.item;
  },

  removeWishlist(volumeId: string): Promise<void> {
    return request<void>(`/wishlist/${encodeURIComponent(volumeId)}`, {
      method: "DELETE",
    });
  },
};
