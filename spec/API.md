# API contract

Base path: `/api` (same origin in production, proxied to `http://localhost:3000` in development).

Production origins:

- App + API: `https://travelio.andriosirait.com/api`
- API-only hostname: `https://travelio-api.andriosirait.com/api` (same container; root returns a JSON descriptor; non-API paths return 404)
All responses are JSON except `204 No Content`. Request bodies are limited to 16 KB.

## Conventions

- **Success** responses return the resource directly, not wrapped in a `data` envelope. The payloads are small and single-purpose; an envelope would add a layer without adding information.
- **Errors** always use one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid search parameters",
    "details": [{ "path": "q", "message": "Search with at least 2 characters" }],
    "requestId": "0f0f5b0e-6f1f-4b4a-9f9a-3a3d0f0c9a11"
  }
}
```

`details` is present only for validation errors. `requestId` matches the `X-Request-Id` response header and the server log entry.

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Query, path or body failed Zod validation |
| `NOT_FOUND` | 404 | Unknown `/api` route |
| `RATE_LIMITED` | 429 | This client exceeded 60 requests/minute |
| `UPSTREAM_RATE_LIMITED` | 429 | Google Books quota exhausted (add `GOOGLE_BOOKS_API_KEY`) |
| `UPSTREAM_UNAVAILABLE` | 502 | Google Books timed out or returned 5xx after one retry |
| `UPSTREAM_REJECTED` | 502 | Google Books returned 400/403 |
| `UPSTREAM_INVALID_RESPONSE` | 502 | Upstream JSON did not match the expected schema |
| `INTERNAL_ERROR` | 500 | Unhandled server error; details are logged, never returned |

Every response carries `X-Request-Id`. API responses also send `Cache-Control: no-store` because wishlist data is visitor-scoped.

## Visitor identity

No accounts. On the first request under `/api`, the server issues:

```
Set-Cookie: tv_visitor=<uuid>; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax[; Secure]
```

`Secure` is set whenever the request arrives over HTTPS (`req.secure`), which requires `TRUST_PROXY=true` behind nginx/Railway/Render. The cookie is the only identity; losing it loses the wishlist. Wishlist rows are keyed by `(visitor_id, volume_id)`.

## Operational endpoints

### `GET /api/health`

Liveness only; never touches Postgres.

```json
{ "status": "ok", "uptimeSeconds": 412 }
```

### `GET /api/ready`

Readiness; executes `select 1`.

```json
{ "status": "ready", "db": "up" }
```

`503` when the database is unreachable:

```json
{ "status": "not_ready", "db": "down" }
```

Docker `HEALTHCHECK` and `docker-compose` use `/api/ready`.

## Search

### `GET /api/books`

| Parameter | Type | Default | Rules |
|---|---|---|---|
| `q` | string | — | required, trimmed, 2–120 chars |
| `page` | integer | `1` | 1–50 (Google caps `startIndex` at 1000) |
| `limit` | integer | `20` | 1–40 (Google's max) |

`200 OK`:

```json
{
  "query": "dune",
  "page": 1,
  "limit": 20,
  "totalItems": 842,
  "hasNextPage": true,
  "source": "google",
  "notice": null,
  "items": [
    {
      "id": "zyTCAlFPjgYC",
      "title": "Dune",
      "subtitle": "Book One",
      "authors": ["Frank Herbert"],
      "thumbnail": "https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1",
      "publishedDate": "1965",
      "averageRating": 4.3,
      "ratingsCount": 1200,
      "previewLink": "https://books.google.com/books?id=zyTCAlFPjgYC",
      "categories": ["Fiction", "Science Fiction"]
    }
  ]
}
```

Normalisation applied per volume:

| Google field | Rule |
|---|---|
| `id` | required; volumes without one are dropped |
| `title` | trimmed, `"Untitled"` fallback |
| `authors` | trimmed, blanks removed, max 10 |
| `thumbnail` | `thumbnail` → `smallThumbnail`; `http://` upgraded to `https://`; `null` if absent |
| `averageRating` | clamped 0–5, rounded to 1 decimal, `null` when absent |
| `ratingsCount` | non-negative integer, `0` when absent |
| `categories` | max 3 |
| duplicates | removed by `id` within a page |

`hasNextPage` is true only when the upstream returned a full page **and** `page * limit < totalItems`. Google's `totalItems` is approximate, so a short page is treated as the end.

`source` is `google` for live results. On **page 1 only**, when Google fails (429, 5xx, timeout, rejected key, or malformed payload) and `FALLBACK_CATALOG_ENABLED=true` (default), the endpoint still returns `200` with `source: "fallback"`, a human-readable `notice`, and up to 24 curated books. Later pages never mix catalog data into a live result set: they return the upstream error so load-more fails visibly. Every fallback item has an `id` starting with `demo-`, and the UI renders a `Demo` badge on the cover plus the notice above the grid, so demo data stays identifiable even after it is saved to the wishlist. Set the flag to `false` to surface upstream errors on page 1 as well.

Responses are cached in-process for 5 minutes (max 100 entries) keyed by lowercased `q|page|limit`. This is a single-instance cache; a multi-instance deployment would move it to Redis.

`400` example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid search parameters",
    "details": [{ "path": "q", "message": "Search with at least 2 characters" }],
    "requestId": "..."
  }
}
```

`429` from Google passes through with `Retry-After: 60`:

```json
{
  "error": {
    "code": "UPSTREAM_RATE_LIMITED",
    "message": "Google Books is rate-limiting searches right now. Try again in a minute.",
    "requestId": "..."
  }
}
```

## Wishlist

### `GET /api/wishlist`

```json
{
  "items": [
    {
      "volumeId": "zyTCAlFPjgYC",
      "title": "Dune",
      "authors": ["Frank Herbert"],
      "thumbnail": "https://books.google.com/...",
      "averageRating": 4.3,
      "ratingsCount": 1200,
      "addedAt": "2026-10-26T04:12:33.000Z"
    }
  ]
}
```

Ordered newest first, capped at 500 rows.

### `POST /api/wishlist`

```json
{
  "volumeId": "zyTCAlFPjgYC",
  "title": "Dune",
  "authors": ["Frank Herbert"],
  "thumbnail": "https://books.google.com/...",
  "averageRating": 4.3,
  "ratingsCount": 1200
}
```

| Status | Meaning | Body |
|---|---|---|
| `201` | Created | `{ "item": { ... } }` |
| `200` | Already saved — idempotent | `{ "item": { ...stored snapshot } }` |

The snapshot is stored at save time and is not overwritten on a duplicate save, so `addedAt` and the original metadata stay stable. Duplicate detection is the database unique constraint `(visitor_id, volume_id)`, not an application check.

Validation: `volumeId` 1–64 chars, `title` 1–500, `authors` ≤ 20, `thumbnail` absolute URL ≤ 2000 chars or `null`, `averageRating` 0–5 or `null`, `ratingsCount` 0–10,000,000.

### `DELETE /api/wishlist/:volumeId`

Always `204 No Content`, including when the item is not present. Deletes are naturally idempotent and this avoids a race where the UI removes an item twice.

## Database

```sql
create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  volume_id text not null,
  title text not null,
  authors text[] not null default '{}',
  thumbnail_url text,
  average_rating numeric(2, 1),
  ratings_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint wishlist_items_visitor_volume_unique unique (visitor_id, volume_id),
  constraint wishlist_items_rating_range check (
    average_rating is null or (average_rating >= 0 and average_rating <= 5)
  ),
  constraint wishlist_items_ratings_count_positive check (ratings_count >= 0)
);

create index wishlist_items_visitor_created_idx
  on wishlist_items (visitor_id, created_at desc);
```

Migrations are forward-only SQL files under `server/migrations`, applied inside a transaction and recorded in `schema_migrations`. They run at boot (`RUN_MIGRATIONS=true`) and are safe to run twice.
