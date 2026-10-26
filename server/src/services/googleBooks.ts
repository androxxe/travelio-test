import { z } from "zod";
import { AppError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import type { Book, BookSearchResult } from "../domain";
import { delay } from "../lib/delay";
import { FALLBACK_NOTICE, searchFallbackBooks } from "./fallbackCatalog";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const volumeSchema = z.object({
  id: z.string().min(1),
  volumeInfo: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      authors: z.array(z.string()).optional(),
      publishedDate: z.string().optional(),
      averageRating: z.number().optional(),
      ratingsCount: z.number().optional(),
      previewLink: z.string().optional(),
      categories: z.array(z.string()).optional(),
      imageLinks: z
        .object({
          thumbnail: z.string().optional(),
          smallThumbnail: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const googleResponseSchema = z.object({
  totalItems: z.number().int().nonnegative().optional(),
  items: z.array(z.unknown()).optional(),
});

export interface GoogleBooksClient {
  search(params: {
    q: string;
    page: number;
    limit: number;
  }): Promise<BookSearchResult>;
}

interface GoogleBooksClientOptions {
  baseUrl: string;
  apiKey?: string | null;
  fetchImpl?: FetchLike;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  timeoutMs?: number;
  logger?: Logger;
  fallbackCatalog?: boolean;
}

interface CacheEntry {
  expiresAt: number;
  value: BookSearchResult;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 100;
const DEFAULT_TIMEOUT_MS = 8_000;

function toHttps(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^http:\/\//i, "https://");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Google returns a mix of missing fields, http-only thumbnails and duplicate
 * volumes. Normalise once here so every consumer sees the same shape.
 */
export function normalizeVolume(raw: unknown): Book | null {
  const parsed = volumeSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const { id, volumeInfo } = parsed.data;
  const info = volumeInfo ?? {};
  const thumbnail = toHttps(
    info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail,
  );
  const rating =
    typeof info.averageRating === "number"
      ? Math.round(clamp(info.averageRating, 0, 5) * 10) / 10
      : null;
  const ratingsCount = Math.max(0, Math.trunc(info.ratingsCount ?? 0));

  return {
    id,
    title: info.title?.trim() || "Untitled",
    subtitle: info.subtitle?.trim() || null,
    authors: (info.authors ?? [])
      .map((author) => author.trim())
      .filter(Boolean)
      .slice(0, 10),
    thumbnail,
    publishedDate: info.publishedDate ?? null,
    averageRating: rating,
    ratingsCount,
    previewLink: toHttps(info.previewLink),
    categories: (info.categories ?? []).slice(0, 3),
  };
}

async function requestJson(
  url: string,
  fetchImpl: FetchLike,
  { timeoutMs, logger }: { timeoutMs: number; logger?: Logger },
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 429) {
        throw new AppError(
          429,
          "UPSTREAM_RATE_LIMITED",
          "Google Books is rate-limiting searches right now. Try again in a minute.",
          { retryAfterSeconds: 60 },
        );
      }

      if (response.status === 400 || response.status === 403) {
        const body = await response.text().catch(() => "");
        logger?.error(
          { status: response.status, body: body.slice(0, 300) },
          "google books rejected the request",
        );
        throw new AppError(
          502,
          "UPSTREAM_REJECTED",
          "Google Books rejected the request. Try a different search.",
        );
      }

      if (response.status >= 500) {
        lastError = new Error(`Google Books responded with ${response.status}`);
      } else if (!response.ok) {
        throw new AppError(
          502,
          "UPSTREAM_UNAVAILABLE",
          "Could not reach Google Books. Try again.",
        );
      } else {
        return await response.json();
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      lastError = error;
      logger?.warn(
        { attempt, error: error instanceof Error ? error.message : error },
        "google books request failed",
      );
    }

    if (attempt === 0) {
      // One retry with jittered backoff keeps a blip from failing the search
      // without stacking requests during a real outage.
      await delay(250 + Math.floor(Math.random() * 250));
    }
  }

  throw new AppError(
    502,
    "UPSTREAM_UNAVAILABLE",
    "Could not reach Google Books. Try again.",
    { cause: lastError },
  );
}

export function createGoogleBooksClient({
  baseUrl,
  apiKey,
  fetchImpl = fetch,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  cacheMaxEntries = DEFAULT_CACHE_MAX_ENTRIES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logger,
  fallbackCatalog = true,
}: GoogleBooksClientOptions): GoogleBooksClient {
  const cache = new Map<string, CacheEntry>();

  async function search({
    q,
    page,
    limit,
  }: {
    q: string;
    page: number;
    limit: number;
  }): Promise<BookSearchResult> {
    const cacheKey = `${q.toLowerCase()}|${page}|${limit}`;
    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const url = new URL(baseUrl);
    url.searchParams.set("q", q);
    url.searchParams.set("startIndex", String((page - 1) * limit));
    url.searchParams.set("maxResults", String(limit));
    url.searchParams.set("printType", "books");
    if (apiKey) {
      url.searchParams.set("key", apiKey);
    }

    try {
      const payload = await requestJson(url.toString(), fetchImpl, {
        timeoutMs,
        logger,
      });
      const parsed = googleResponseSchema.safeParse(payload);

      if (!parsed.success) {
        throw new AppError(
          502,
          "UPSTREAM_INVALID_RESPONSE",
          "Google Books returned an unexpected response.",
        );
      }

      const rawItems = parsed.data.items ?? [];
      const seen = new Set<string>();
      const items: Book[] = [];

      for (const rawItem of rawItems) {
        const book = normalizeVolume(rawItem);
        if (book && !seen.has(book.id)) {
          seen.add(book.id);
          items.push(book);
        }
      }

      const result: BookSearchResult = {
        query: q,
        page,
        limit,
        totalItems: parsed.data.totalItems ?? items.length,
        hasNextPage:
          rawItems.length === limit &&
          page * limit < (parsed.data.totalItems ?? 0),
        items,
        source: "google",
        notice: null,
      };

      cache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        value: result,
      });
      if (cache.size > cacheMaxEntries) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }

      return result;
    } catch (error) {
      if (
        fallbackCatalog &&
        error instanceof AppError &&
        (error.status === 429 || error.code.startsWith("UPSTREAM_"))
      ) {
        logger?.warn(
          { code: error.code },
          "google books unavailable, serving the fallback catalog",
        );
        const fallback = searchFallbackBooks(q, page, limit);
        const fallbackResult: BookSearchResult = {
          query: q,
          page,
          limit,
          totalItems: fallback.totalItems,
          hasNextPage: page * limit < fallback.totalItems,
          items: fallback.items,
          source: "fallback",
          notice: FALLBACK_NOTICE,
        };

        // Short cache so a burst of identical searches does not keep hammering
        // an upstream that is already out of quota.
        cache.set(cacheKey, {
          expiresAt: Date.now() + 60_000,
          value: fallbackResult,
        });

        return fallbackResult;
      }

      throw error;
    }
  }

  return { search };
}
