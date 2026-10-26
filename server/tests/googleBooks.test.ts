import { describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/errors";
import {
  createGoogleBooksClient,
  normalizeVolume,
} from "../src/services/googleBooks";

const volume = {
  id: "zyTCAlFPjgYC",
  volumeInfo: {
    title: "  Dune  ",
    subtitle: "Book One",
    authors: ["Frank Herbert", "  "],
    publishedDate: "1965",
    averageRating: 4.26,
    ratingsCount: 1200,
    previewLink: "http://books.google.com/books?id=zyTCAlFPjgYC",
    categories: ["Fiction", "Science Fiction", "Adventure", "Extra"],
    imageLinks: {
      thumbnail: "http://books.google.com/books/content?id=zyTCAlFPjgYC",
    },
  },
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("normalizeVolume", () => {
  it("normalizes thumbnails, ratings, authors and trims fields", () => {
    const book = normalizeVolume(volume);

    expect(book).not.toBeNull();
    expect(book).toMatchObject({
      id: "zyTCAlFPjgYC",
      title: "Dune",
      subtitle: "Book One",
      authors: ["Frank Herbert"],
      thumbnail:
        "https://books.google.com/books/content?id=zyTCAlFPjgYC",
      averageRating: 4.3,
      ratingsCount: 1200,
      previewLink: "https://books.google.com/books?id=zyTCAlFPjgYC",
    });
    expect(book?.categories).toHaveLength(3);
  });

  it("keeps missing ratings null instead of inventing a zero", () => {
    const book = normalizeVolume({
      id: "abc",
      volumeInfo: { title: "Untitled work" },
    });

    expect(book).toMatchObject({
      averageRating: null,
      ratingsCount: 0,
      authors: [],
      thumbnail: null,
    });
  });

  it("rejects payloads without an id", () => {
    expect(normalizeVolume({ volumeInfo: { title: "No id" } })).toBeNull();
  });

  it("clamps ratings into the 0..5 range", () => {
    const book = normalizeVolume({
      id: "high",
      volumeInfo: { title: "High", averageRating: 9 },
    });
    expect(book?.averageRating).toBe(5);
  });
});

describe("createGoogleBooksClient", () => {
  it("maps the Google payload and sends pagination parameters", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        totalItems: 120,
        items: Array.from({ length: 20 }, (_, index) => ({
          ...volume,
          id: `volume-${index}`,
        })),
      }),
    );
    const client = createGoogleBooksClient({
      baseUrl: "https://example.test/volumes",
      fetchImpl,
    });

    const result = await client.search({ q: "dune", page: 3, limit: 20 });

    expect(result).toMatchObject({
      query: "dune",
      page: 3,
      limit: 20,
      totalItems: 120,
      hasNextPage: true,
      source: "google",
      notice: null,
    });
    expect(result.items[0]?.title).toBe("Dune");

    const requestedUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("q")).toBe("dune");
    expect(requestedUrl.searchParams.get("startIndex")).toBe("40");
    expect(requestedUrl.searchParams.get("maxResults")).toBe("20");
  });

  it("caches identical searches for the TTL window", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ totalItems: 1, items: [volume] }),
    );
    const client = createGoogleBooksClient({
      baseUrl: "https://example.test/volumes",
      fetchImpl,
    });

    await client.search({ q: "Dune", page: 1, limit: 20 });
    await client.search({ q: "dune", page: 1, limit: 20 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("surfaces upstream rate limiting as a 429", async () => {
    const client = createGoogleBooksClient({
      baseUrl: "https://example.test/volumes",
      fetchImpl: async () => jsonResponse({}, { status: 429 }),
      fallbackCatalog: false,
    });

    await expect(
      client.search({ q: "dune", page: 1, limit: 20 }),
    ).rejects.toMatchObject({ status: 429, code: "UPSTREAM_RATE_LIMITED" });
  });

  it("falls back to the labelled demo catalog when Google is rate-limited", async () => {
    const client = createGoogleBooksClient({
      baseUrl: "https://example.test/volumes",
      fetchImpl: async () => jsonResponse({}, { status: 429 }),
    });

    const result = await client.search({ q: "dune", page: 1, limit: 20 });

    expect(result.source).toBe("fallback");
    expect(result.notice).toContain("demo catalog");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.id.startsWith("demo-")).toBe(true);
    expect(result.items.some((book) => book.title === "Dune")).toBe(true);
  });

  it("stops pagination at page 50", async () => {
    const client = createGoogleBooksClient({
      baseUrl: "https://example.test/volumes",
      fetchImpl: async () =>
        jsonResponse({
          totalItems: 10_000,
          items: Array.from({ length: 20 }, (_, index) => ({
            ...volume,
            id: `page-${index}`,
          })),
        }),
    });

    const result = await client.search({ q: "dune", page: 50, limit: 20 });
    expect(result.hasNextPage).toBe(false);
  });

  it("does not mix fallback data into later pages", async () => {
    const client = createGoogleBooksClient({
      baseUrl: "https://example.test/volumes",
      fetchImpl: async () => jsonResponse({}, { status: 429 }),
    });

    await expect(
      client.search({ q: "dune", page: 2, limit: 20 }),
    ).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMITED" });
  });

  it("retries a 5xx once and then fails with 502", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({}, { status: 503 }),
    );
    const client = createGoogleBooksClient({
      baseUrl: "https://example.test/volumes",
      fetchImpl,
      fallbackCatalog: false,
    });

    const error = await client
      .search({ q: "dune", page: 1, limit: 20 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 502, code: "UPSTREAM_UNAVAILABLE" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed upstream payloads", async () => {
    const client = createGoogleBooksClient({
      baseUrl: "https://example.test/volumes",
      fetchImpl: async () => jsonResponse({ items: "not-an-array" }),
      fallbackCatalog: false,
    });

    await expect(
      client.search({ q: "dune", page: 1, limit: 20 }),
    ).rejects.toMatchObject({ code: "UPSTREAM_INVALID_RESPONSE" });
  });
});
