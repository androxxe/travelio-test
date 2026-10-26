import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrate";
import { createPool, type Pool } from "../src/db/pool";
import type { WishlistInput } from "../src/domain";
import { createWishlistRepository } from "../src/repositories/wishlistRepository";

loadEnv({ path: [".env", "../.env"], quiet: true });

const databaseUrl = process.env.TEST_DATABASE_URL;
const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

const input: WishlistInput = {
  volumeId: "test-volume-1",
  title: "Dune",
  authors: ["Frank Herbert"],
  thumbnail: "https://books.google.com/cover.jpg",
  averageRating: 4.3,
  ratingsCount: 1200,
};

describe.skipIf(!databaseUrl)("wishlist repository (postgres)", () => {
  let pool: Pool;
  let repository: ReturnType<typeof createWishlistRepository>;
  const visitors: string[] = [];

  function visitorId(): string {
    const id = randomUUID();
    visitors.push(id);
    return id;
  }

  beforeAll(async () => {
    pool = createPool(databaseUrl as string);
    await runMigrations(pool, migrationsDir);
    repository = createWishlistRepository(pool);
  });

  afterAll(async () => {
    if (visitors.length > 0) {
      await pool.query(
        "delete from wishlist_items where visitor_id = any($1::uuid[])",
        [visitors],
      );
    }
    await pool.end();
  });

  it("is idempotent on duplicate saves and keeps the first snapshot", async () => {
    const visitor = visitorId();

    const first = await repository.add(visitor, input);
    expect(first.created).toBe(true);

    const duplicate = await repository.add(visitor, {
      ...input,
      title: "Dune Messiah",
    });

    expect(duplicate.created).toBe(false);
    expect(duplicate.item.title).toBe("Dune");
  });

  it("scopes rows per visitor and removes them", async () => {
    const firstVisitor = visitorId();
    const secondVisitor = visitorId();

    await repository.add(firstVisitor, input);

    expect(await repository.list(firstVisitor)).toHaveLength(1);
    expect(await repository.list(secondVisitor)).toHaveLength(0);

    expect(await repository.remove(firstVisitor, input.volumeId)).toBe(true);
    expect(await repository.remove(firstVisitor, input.volumeId)).toBe(false);
    expect(await repository.list(firstVisitor)).toHaveLength(0);
  });

  it("runs migrations idempotently", async () => {
    const applied = await runMigrations(pool, migrationsDir);
    expect(applied).toEqual([]);
  });
});
