# Shelf

Book search and wishlist app built for the Travelio engineering test.

Search Google Books, read the ratings as stars, and keep the books you care about on a wishlist that survives a reload — without creating an account.

**Live demo:** https://travelio.andriosirait.com
**API:** https://travelio-api.andriosirait.com/api
**API contract:** [`spec/API.md`](spec/API.md) · **Design notes:** [`spec/DESIGN.md`](spec/DESIGN.md) · **Plan and decisions:** [`spec/PLAN.md`](spec/PLAN.md)

## Screenshots

| Search | Wishlist |
| --- | --- |
| ![Search results](docs/screenshots/search-desktop.jpg) | ![Wishlist](docs/screenshots/wishlist-desktop.jpg) |

<img src="docs/screenshots/search-mobile.jpg" alt="Mobile search results" width="320" />

## Features

- Search Google Books by title, author, or topic, debounced and synced to the URL so a search is shareable and the back button works.
- Results show cover, title, authors, and a fractional star rating with the rating count.
- Missing ratings are shown honestly as "No ratings yet" — many Google Books volumes have no `averageRating`.
- If Google is down or out of quota, a clearly-labelled 24-book demo catalog keeps the app usable instead of showing a dead end.
- Wishlist with optimistic add/remove, persisted in PostgreSQL and scoped to an anonymous browser cookie.
- Covers upgrade `http://` Google thumbnails to `https://` and fall back to a designed placeholder when Google has no image or the image 404s.
- Loading skeletons, empty states, retryable errors, mobile layout, keyboard focus, reduced-motion support.
- Server-side proxy with a 5-minute cache, request timeouts, one retry with jitter, and a 60 req/min rate limit to protect the Google quota.
- JSON error envelope with validation details and a request id for support.
- Docker image, compose stack with Postgres, health/readiness endpoints, and CI.

## Stack

| Layer | Choice |
|---|---|
| UI | React 19, Vite 7, TypeScript, Tailwind CSS 4, shadcn/ui primitives (Button, Input, Skeleton, Sonner) |
| Data fetching | TanStack Query 5 (infinite search, optimistic wishlist mutations) |
| API | Node 22, Express 5, Zod 4, pino |
| Database | PostgreSQL 17, raw `pg` with forward-only SQL migrations |
| Tests | Vitest, Testing Library, Supertest, Playwright |
| Package manager | pnpm 10 workspaces |
| Delivery | Multi-stage Docker image, Docker Compose, GitHub Actions |

## Quick start

### Docker (recommended)

```bash
cp .env.example .env          # optional: add GOOGLE_BOOKS_API_KEY
docker compose up --build
open http://localhost:3000
```

The app waits for Postgres, applies migrations, and serves the built SPA and the API from one container. Compose exposes Postgres on host port `5433` for local tooling; the container talks to it on `5432`.

### Local development

```bash
pnpm install
cp .env.example .env
docker compose up -d db
pnpm dev
```

- UI: http://localhost:5173 (Vite proxies `/api` to `localhost:3000`)
- API: http://localhost:3000
- Postgres: `localhost:5433`

### Environment

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | required, e.g. `postgres://shelf:shelf@localhost:5433/shelf` |
| `PORT` | `3000` | |
| `GOOGLE_BOOKS_API_KEY` | empty | optional; strongly recommended for a busy demo, unkeyed traffic is quota-limited per IP |
| `GOOGLE_BOOKS_BASE_URL` | Google's endpoint | overridden by the e2e mock |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS origin for development |
| `CLIENT_DIST` | unset | set to the built SPA directory to serve the UI from Express |
| `MIGRATIONS_DIR` | `migrations` | |
| `RUN_MIGRATIONS` | `true` | |
| `RATE_LIMIT_MAX` | `60` | requests/minute/IP on `/api` |
| `FALLBACK_CATALOG_ENABLED` | `true` | serve the labelled demo catalog when Google is unavailable |
| `TRUST_PROXY` | `false` | **set `true` behind nginx/Railway/Render** so cookies are `Secure` and client IPs are real |
| `LOG_LEVEL` | `info` | pino level |

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | API + Vite dev server together |
| `pnpm build` | Build the API (`tsup`) and the SPA (`vite`) |
| `pnpm start` | Run the built API; serves `client/dist` when `CLIENT_DIST` is set |
| `pnpm lint` | ESLint flat config |
| `pnpm typecheck` | `tsc --noEmit` in both workspaces |
| `pnpm test` | Vitest: server unit/route tests + client component tests |
| `pnpm test:e2e` | Playwright against a real server and Postgres, with a mocked Google upstream |
| `pnpm db:migrate` | Apply migrations manually |
| `pnpm db:up` / `db:down` | Start/stop the compose Postgres |

## API

Full contract with examples: [`spec/API.md`](spec/API.md).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/books?q=&page=&limit=` | Search and normalise Google Books |
| `GET` | `/api/wishlist` | List the visitor's saved books |
| `POST` | `/api/wishlist` | Save a book snapshot (idempotent) |
| `DELETE` | `/api/wishlist/:volumeId` | Remove a book (idempotent, always 204) |
| `GET` | `/api/health` | Liveness; no database call |
| `GET` | `/api/ready` | Readiness; checks Postgres |

Errors are always `{ "error": { code, message, details?, requestId } }`. Every response includes `X-Request-Id`; API responses are `Cache-Control: no-store`.

The wishlist is identified by an httpOnly `tv_visitor` cookie (UUID, one year). There are no accounts: clearing cookies clears the wishlist.

## Architecture

```
Browser ── /api/* ──▶ Express 5 ──▶ WishlistRepository ──▶ PostgreSQL
   │                     │
   │                     └── GoogleBooksClient ──▶ googleapis.com/books/v1/volumes
   └── static SPA (client/dist) served by Express in production
```

- `client/` — React SPA. Dev server proxies `/api`.
- `server/` — Express API. Routes validate with Zod, call a repository or the Google service, and hand errors to one mapper.
- `server/migrations/` — SQL, applied in a transaction and recorded in `schema_migrations`.
- `e2e/` — Playwright specs and a fixture Google Books server.

Search results are cached in-process for 5 minutes (max 100 entries, keyed by `q|page|limit`). That is single-instance by design; a multi-instance deploy would move it to Redis.

## Testing

```bash
pnpm test                 # unit + route tests, no database required
docker compose up -d db
pnpm test:e2e         # Playwright: search → save → reload → remove
```

- **Server unit tests** cover Google normalisation (http→https covers, missing authors/ratings, clamping, dedupe), pagination parameters, caching, retry, and 429/502 mapping.
- **Route tests** use Supertest with injected fakes: validation, cookie issuance, visitor isolation, idempotent save/remove, malformed JSON, request ids, readiness.
- **Repository tests** run against real Postgres when `DATABASE_URL` or `TEST_DATABASE_URL` is set, and cover the unique constraint, snapshot preservation, and removal.
- **Client tests** cover fractional stars/ARIA, count formatting, heart state, and cover fallbacks.
- **E2E** boots the real API with a fixture Google server, so it never depends on network access or quota.

## Deployment

The image is self-contained:

```bash
docker build -t shelf .
docker run -d --name shelf -p 127.0.0.1:3100:3000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/shelf \
  -e NODE_ENV=production \
  -e TRUST_PROXY=true \
  -e CLIENT_ORIGIN=https://your.domain \
  -e CLIENT_DIST=/app/client \
  -e MIGRATIONS_DIR=/app/migrations \
  shelf
```

Put it behind a TLS-terminating reverse proxy and keep the app port bound to `127.0.0.1`. The production host serves the app and API on the canonical origin; `travelio-api.andriosirait.com` is an API-only vhost on the same container (its root redirects to the app). With nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name travelio.example.com;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Required production env: `NODE_ENV=production`, `TRUST_PROXY=true`, `CLIENT_ORIGIN=https://<domain>`, `CLIENT_DIST=/app/client`, `MIGRATIONS_DIR=/app/migrations`, and a reachable `DATABASE_URL`. The container applies migrations on boot and fails fast if the database never becomes reachable.

Operational endpoints: `GET /api/health` (liveness) and `GET /api/ready` (database readiness, used by the Docker healthcheck).

## Design decisions

A few choices a reviewer may want the reasoning for:

- **PostgreSQL instead of MongoDB.** The brief suggests Mongo as an example; the wishlist only needs one table, and PostgreSQL gives a unique `(visitor_id, volume_id)` constraint and check constraints that make duplicate saves and bad ratings impossible at the database level.
- **Anonymous cookie instead of a global wishlist.** A single shared list would be simpler but would make two reviewers see each other's books. The cookie keeps the "no accounts" requirement while behaving correctly per browser.
- **Snapshot, not reference.** Book metadata is copied into `wishlist_items`. If Google rate-limits or drops a volume, the saved shelf still renders.
- **No ORM.** Two tables and four queries; SQL is easier to review than generated accessors.
- **Readiness is separate from liveness.** A brief database blip should not make Docker restart an otherwise healthy process.
- **Stars are custom.** `rater-js` is an interactive rating widget; this app needs a read-only fractional display with a precise accessible label and no extra dependency.

Trade-offs and out-of-scope items are listed in [`spec/PLAN.md`](spec/PLAN.md).

## Project structure

```
client/                 React SPA (Vite)
  src/components/       BookCard, StarRating, ResultBand, ui primitives
  src/hooks/            useBooks, useWishlist
  src/pages/            SearchPage, WishlistPage, NotFoundPage
server/                 Express API
  src/routes/           books, wishlist, health
  src/services/         googleBooks (cache, retry, normalise)
  src/repositories/     wishlistRepository
  migrations/           SQL migrations
  tests/                Vitest + Supertest + Postgres integration
e2e/                    Playwright + fixture Google server
spec/                   Brief-derived plan, API contract, design notes
```

## Known limitations

- Unkeyed Google Books traffic is quota-limited per IP, and the shared anonymous quota can already be exhausted. Add `GOOGLE_BOOKS_API_KEY` for real traffic. The 5-minute cache, rate limit and labelled fallback catalog are mitigations, not a substitute.
- Wishlists are per browser. Clearing cookies or switching devices loses them, by design.
- The in-process search cache is per instance. Horizontal scaling would need a shared cache.
- Google's `totalItems` is approximate, so the count in the result band is an estimate, and load-more stops on the first short page.
