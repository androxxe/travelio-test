import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

let clientDist: string;

function buildApp() {
  return createApp({
    pool: { query: async () => ({ rows: [] }) } as unknown as Pool,
    googleBooks: { search: async () => Promise.reject(new Error("not used")) },
    wishlist,
    config: {
      isProduction: false,
      clientOrigin: "http://localhost:5173",
      clientDist,
      rateLimitMax: 1_000,
      trustProxy: false,
    },
  });
}

beforeAll(async () => {
  clientDist = await mkdtemp(join(tmpdir(), "shelf-client-"));
  await writeFile(join(clientDist, "index.html"), "<h1>app shell</h1>");
});

afterAll(async () => {
  await rm(clientDist, { recursive: true, force: true });
});

describe("SPA fallback", () => {
  it("serves the shell for client routes", async () => {
    const response = await request(buildApp()).get("/wishlist");
    expect(response.status).toBe(200);
    expect(response.text).toContain("app shell");
  });

  it("answers HEAD for the shell", async () => {
    const response = await request(buildApp()).head("/");
    expect(response.status).toBe(200);
  });

  it("does not turn dotted probes into a 200 shell", async () => {
    const envProbe = await request(buildApp()).get("/.env");
    expect(envProbe.status).toBe(404);

    const sourceProbe = await request(buildApp()).get("/server.mjs");
    expect(sourceProbe.status).toBe(404);
  });
});
