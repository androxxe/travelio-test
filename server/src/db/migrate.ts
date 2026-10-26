import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "./pool";
import type { Logger } from "../lib/logger";

/**
 * Tiny forward-only migration runner. Each file is applied inside a
 * transaction and recorded in schema_migrations, so booting twice is safe.
 */
export async function runMigrations(
  pool: Pool,
  directory: string,
  logger?: Logger,
): Promise<string[]> {
  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const entries = await readdir(directory);
  const files = entries.filter((file) => file.endsWith(".sql")).sort();
  const applied: string[] = [];

  for (const file of files) {
    const existing = await pool.query(
      "select 1 from schema_migrations where name = $1",
      [file],
    );
    if (existing.rowCount) {
      continue;
    }

    const sql = await readFile(join(directory, file), "utf8");
    const client = await pool.connect();

    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [
        file,
      ]);
      await client.query("commit");
      applied.push(file);
      logger?.info({ migration: file }, "migration applied");
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migration ${file} failed`, { cause: error });
    } finally {
      client.release();
    }
  }

  return applied;
}
