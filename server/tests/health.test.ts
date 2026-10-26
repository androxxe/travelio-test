import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Pool } from "../src/db/pool";
import type { WishlistRepository } from "../src/repositories/wishlistRepository";

const wishlist: WishlistRepository = {
  list: async () => [],
  add: async () => {
    throw new Error("not used");
  },
  remove: async () => false,
};

function buildApp(query: () => Promise<unknown>) {
  return createApp({
    pool: { query } as unknown as Pool,
    googleBooks: { search: vi.fn() },
    wishlist,
    config: {
      isProduction: false,
      clientOrigin: "http://localhost:5173",
      clientDist: null,
      rateLimitMax: 1_000,
      trustProxy: false,
    },
  });
}

describe("operational endpoints", () => {
  it("reports liveness without touching the database", async () => {
    const query = vi.fn(async () => ({ rows: [] }));

    const response = await request(buildApp(query)).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(query).not.toHaveBeenCalled();
  });

  it("reports readiness only when the database answers", async () => {
    const ready = await request(
      buildApp(async () => ({ rows: [{ "?column?": 1 }] })),
    ).get("/api/ready");
    expect(ready.status).toBe(200);
    expect(ready.body).toMatchObject({ status: "ready", db: "up" });

    const notReady = await request(
      buildApp(async () => {
        throw new Error("connection refused");
      }),
    ).get("/api/ready");
    expect(notReady.status).toBe(503);
    expect(notReady.body).toMatchObject({ status: "not_ready", db: "down" });
  });

  it("tags every response with a request id", async () => {
    const generated = await request(buildApp(async () => ({ rows: [] }))).get(
      "/api/health",
    );
    expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await request(buildApp(async () => ({ rows: [] })))
      .get("/api/health")
      .set("x-request-id", "client-supplied-1234");
    expect(echoed.headers["x-request-id"]).toBe("client-supplied-1234");
  });

  it("keeps API responses out of shared caches and includes the request id on errors", async () => {
    const response = await request(buildApp(async () => ({ rows: [] }))).get(
      "/api/unknown",
    );

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
  });
});
