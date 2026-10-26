import pg from "pg";
import { delay } from "../lib/delay";
import type { Logger } from "../lib/logger";

const { Pool } = pg;

export type Pool = pg.Pool;

export function createPool(connectionString: string): pg.Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    application_name: "shelf-api",
  });
}

interface WaitOptions {
  attempts?: number;
  delayMs?: number;
  logger?: Logger;
}

/**
 * Compose starts the app before Postgres finishes its first boot, so retry
 * instead of crashing the container.
 */
export async function waitForDatabase(
  pool: pg.Pool,
  { attempts = 15, delayMs = 1_000, logger }: WaitOptions = {},
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      logger?.warn({ attempt, attempts }, "database not ready, retrying");
      await delay(delayMs);
    }
  }
}
