# Implementation plan

Source brief: `spec/Travelio Test.pdf` (kept out of git; it contains the recruiter's email).

## What the brief asks for

| # | Requirement | Implementation | Proof |
|---|---|---|---|
| 1 | Search books by user keyword | `SearchHero` → `GET /api/books` | `e2e/search.spec.ts` |
| 2 | Data from `googleapis.com/books/v1/volumes?q=` | `server/src/services/googleBooks.ts` | `server/tests/googleBooks.test.ts` |
| 3.1 | Show title | `BookCard` heading | `BookCard.test.tsx` |
| 3.2 | Show thumbnail / preview | `BookCard` cover + placeholder fallback | `BookCard.test.tsx` |
| 3.3 | Show author | `BookCard` metadata row | `BookCard.test.tsx` |
| 3.4 | Show rating as stars | `StarRating` (fractional, read-only) | `StarRating.test.tsx` |
| 4 | Wishlist persisted in a DB, no accounts | `wishlist_items` + anonymous cookie | route + repository tests, e2e reload |
| — | Any stack except PHP | React + Express + PostgreSQL | `package.json` |
| +1 | Runs with Docker | multi-stage image + compose | CI `docker` job, local smoke |
| +2 | No errors during the demo | typed boundaries, error envelope, healthchecks, tests | `pnpm test`, Playwright, `/api/ready` |
| +3 | Attractive UI | `spec/DESIGN.md` | screenshots at 390/768/1440 |

## Architecture

```
Browser ── /api/* ──▶ Express 5 ──▶ WishlistRepository ──▶ PostgreSQL
   │                     │
   │                     └── GoogleBooksClient ──▶ googleapis.com/books/v1/volumes
   └── static assets (client/dist) served by the same Express process in production
```

One container plus one database. Vite proxies `/api` to `localhost:3000` in development; in production Express serves `client/dist` with a SPA fallback. No second deploy target, no CDN dependency.

Layers: route → repository → SQL. No service layer for the wishlist because every operation is a single query; adding one would be ceremony. The Google integration does own a service because it has caching, retries and normalisation.

## Decisions

| Decision | Why | Rejected |
|---|---|---|
| React + Express split | The brief allows Node/React; a separate API makes the contract testable with Supertest and keeps the browser free of Google's quota/key | Next.js full-stack (less separation), PHP (excluded) |
| PostgreSQL | Durable relational store, trivial in compose, strong constraints (`unique`, `check`) | MongoDB (brief suggests it, but PostgreSQL gives stronger invariants here), SQLite (not demo-safe under a container restart) |
| Raw `pg` + SQL migrations | Two tables, no ORM indirection, the schema is reviewable in one file | Prisma/Drizzle (codegen and migration tooling for no gain at this size) |
| Anonymous httpOnly cookie | Wishlists are per-browser without a login screen | Global shared wishlist (surprising for reviewers), localStorage (brief requires DB) |
| Snapshot book fields on save | Wishlist still renders if Google rate-limits or removes a volume | Store IDs and refetch (fails exactly when the demo is under load) |
| Custom `StarRating` | Fractional fill, accessible label, no dependency; `rater-js` is an interactive widget | `rater-js` |
| Search results cached 5 minutes | Protects the unkeyed Google quota during a demo | No cache (every keystroke burns quota) |
| Readiness split from liveness | A short DB outage should not make Docker restart a healthy app | Single `/health` that checks the DB |
| Idempotent `POST`/`DELETE` | Double click or retry cannot create duplicates or error | `409` on duplicate (worse UX, more client code) |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Google quota (`429`) without an API key | `GOOGLE_BOOKS_API_KEY` env, 5-min cache, server-side 60 req/min limit, explicit 429 message with `Retry-After`, plus a clearly-labelled fallback catalog (`source: fallback`, banner and `Demo` badges, page 1 only) so the demo never dead-ends |
| Many books have no `averageRating` | `null` is preserved end to end; UI shows "No ratings yet" instead of fake zero stars |
| Thumbnails are `http://` or 404 | Upgrade to `https://`, `referrerPolicy=no-referrer`, placeholder cover on error |
| Google `totalItems` is approximate | `hasNextPage` requires a full page; load-more stops on a short page |
| Cookie not `Secure` behind nginx | `TRUST_PROXY=true` in production so `req.secure` follows `X-Forwarded-Proto` |
| Container starts before Postgres | boot retry loop + compose healthcheck |
| Losing the browser cookie loses the wishlist | Documented in the UI footer and README; no accounts by design |

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test                 # server unit/route tests + client component tests
docker compose up -d db
pnpm test:e2e         # Playwright, mocked Google upstream
docker compose up -d --build
curl -fsS http://localhost:3000/api/ready
```

Integration tests run against a real Postgres when `TEST_DATABASE_URL` is set, and skip otherwise. They never fall back to `DATABASE_URL`, so `pnpm test` cannot write to a shared database.

## Out of scope

Accounts and sync across devices, book detail pages, reviews, sorting/filtering beyond Google's relevance order, dark mode. The API is shaped so a detail page can be added without changing the search contract.
