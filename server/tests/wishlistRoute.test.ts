import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Pool } from "../src/db/pool";
import type { WishlistInput, WishlistItem } from "../src/domain";
import type { WishlistRepository } from "../src/repositories/wishlistRepository";

function createMemoryRepository(): WishlistRepository {
  const buckets = new Map<string, Map<string, WishlistItem>>();

  return {
    async list(visitorId) {
      return [...(buckets.get(visitorId)?.values() ?? [])];
    },
    async add(visitorId, input: WishlistInput) {
      const bucket = buckets.get(visitorId) ?? new Map<string, WishlistItem>();
      buckets.set(visitorId, bucket);

      const existing = bucket.get(input.volumeId);
      if (existing) {
        return { item: existing, created: false };
      }

      const item: WishlistItem = {
        ...input,
        addedAt: new Date().toISOString(),
      };
      bucket.set(input.volumeId, item);
      return { item, created: true };
    },
    async remove(visitorId, volumeId) {
      return buckets.get(visitorId)?.delete(volumeId) ?? false;
    },
  };
}

function buildApp() {
  return createApp({
    pool: {} as Pool,
    googleBooks: { search: vi.fn() },
    wishlist: createMemoryRepository(),
    config: {
      isProduction: false,
      clientOrigin: "http://localhost:5173",
      clientDist: null,
      rateLimitMax: 1_000,
      trustProxy: false,
    },
  });
}

const payload = {
  volumeId: "zyTCAlFPjgYC",
  title: "Dune",
  authors: ["Frank Herbert"],
  thumbnail: "https://books.google.com/cover.jpg",
  averageRating: 4.3,
  ratingsCount: 1200,
};

describe("wishlist API", () => {
  it("issues an httpOnly visitor cookie on first contact", async () => {
    const response = await request(buildApp()).get("/api/wishlist");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });

    const cookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("tv_visitor=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("saves, lists and removes a book for the same visitor", async () => {
    const agent = request.agent(buildApp());

    const created = await agent.post("/api/wishlist").send(payload);
    expect(created.status).toBe(201);
    expect(created.body.item).toMatchObject({
      volumeId: payload.volumeId,
      title: "Dune",
    });

    const duplicate = await agent.post("/api/wishlist").send(payload);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.item.volumeId).toBe(payload.volumeId);

    const list = await agent.get("/api/wishlist");
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].title).toBe("Dune");

    const removed = await agent.delete(`/api/wishlist/${payload.volumeId}`);
    expect(removed.status).toBe(204);

    const afterRemove = await agent.get("/api/wishlist");
    expect(afterRemove.body.items).toEqual([]);
  });

  it("keeps wishlists isolated per visitor", async () => {
    const app = buildApp();
    const first = request.agent(app);
    const second = request.agent(app);

    await first.post("/api/wishlist").send(payload);

    const firstList = await first.get("/api/wishlist");
    const secondList = await second.get("/api/wishlist");

    expect(firstList.body.items).toHaveLength(1);
    expect(secondList.body.items).toEqual([]);
  });

  it("validates the payload", async () => {
    const agent = request.agent(buildApp());

    const missingTitle = await agent
      .post("/api/wishlist")
      .send({ volumeId: "x" });
    expect(missingTitle.status).toBe(400);
    expect(missingTitle.body.error.code).toBe("VALIDATION_ERROR");

    const badThumbnail = await agent
      .post("/api/wishlist")
      .send({ ...payload, thumbnail: "not-a-url" });
    expect(badThumbnail.status).toBe(400);

    const scriptScheme = await agent
      .post("/api/wishlist")
      .send({ ...payload, thumbnail: "javascript:alert(1)" });
    expect(scriptScheme.status).toBe(400);

    const controlCharacters = await agent
      .post("/api/wishlist")
      .send({ ...payload, title: "Dune\u0000" });
    expect(controlCharacters.status).toBe(400);
  });

  it("rejects malformed JSON with a 400", async () => {
    const response = await request(buildApp())
      .post("/api/wishlist")
      .set("content-type", "application/json")
      .send('{"volumeId":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
