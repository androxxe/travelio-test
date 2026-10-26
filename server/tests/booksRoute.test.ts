import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Pool } from "../src/db/pool";
import type { BookSearchResult } from "../src/domain";
import type { WishlistRepository } from "../src/repositories/wishlistRepository";
import type { GoogleBooksClient } from "../src/services/googleBooks";

const emptyWishlist: WishlistRepository = {
  list: async () => [],
  add: async () => {
    throw new Error("not used");
  },
  remove: async () => false,
};

const result: BookSearchResult = {
  query: "dune",
  page: 1,
  limit: 20,
  totalItems: 2,
  hasNextPage: false,
  source: "google",
  notice: null,
  items: [
    {
      id: "1",
      title: "Dune",
      subtitle: null,
      authors: ["Frank Herbert"],
      thumbnail: "https://books.google.com/cover.jpg",
      publishedDate: "1965",
      averageRating: 4.3,
      ratingsCount: 100,
      previewLink: "https://books.google.com/books?id=1",
      categories: ["Fiction"],
    },
  ],
};

function buildApp(googleBooks: GoogleBooksClient) {
  return createApp({
    pool: {} as Pool,
    googleBooks,
    wishlist: emptyWishlist,
    config: {
      isProduction: false,
      clientOrigin: "http://localhost:5173",
      clientDist: null,
      rateLimitMax: 1_000,
      trustProxy: false,
    },
  });
}

describe("GET /api/books", () => {
  it("returns normalized books", async () => {
    const search = vi.fn(async () => result);

    const response = await request(buildApp({ search })).get(
      "/api/books?q=dune",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(result);
    expect(search).toHaveBeenCalledWith({ q: "dune", page: 1, limit: 20 });
  });

  it("rejects a query shorter than two characters", async () => {
    const search = vi.fn(async () => result);

    const response = await request(buildApp({ search })).get("/api/books?q=a");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details[0].path).toBe("q");
    expect(search).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range page", async () => {
    const search = vi.fn(async () => result);

    const response = await request(buildApp({ search })).get(
      "/api/books?q=dune&page=0",
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a startIndex beyond the 1,000-result cap", async () => {
    const search = vi.fn(async () => result);

    const response = await request(buildApp({ search })).get(
      "/api/books?q=dune&page=26&limit=40",
    );

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toBe("page");
    expect(search).not.toHaveBeenCalled();
  });

  it("keeps the Google rate limit status and Retry-After header", async () => {
    const search = vi.fn(async () => {
      const { AppError } = await import("../src/lib/errors");
      throw new AppError(
        429,
        "UPSTREAM_RATE_LIMITED",
        "Google Books is rate-limiting searches right now. Try again in a minute.",
        { retryAfterSeconds: 60 },
      );
    });

    const response = await request(buildApp({ search })).get(
      "/api/books?q=dune",
    );

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    expect(response.body.error.code).toBe("UPSTREAM_RATE_LIMITED");
  });

  it("returns a JSON 404 for unknown API routes", async () => {
    const response = await request(buildApp({ search: async () => result }))
      .get("/api/unknown");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
