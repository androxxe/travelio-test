import { loadConfig } from "../config";
import { createLogger } from "../lib/logger";
import { runMigrations } from "./migrate";
import { createPool, waitForDatabase } from "./pool";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const pool = createPool(config.databaseUrl);

try {
  await waitForDatabase(pool, { logger });
  const applied = await runMigrations(pool, config.migrationsDir, logger);
  logger.info(
    { applied },
    applied.length > 0 ? "migrations complete" : "database already up to date",
  );
} catch (error) {
  logger.error({ err: error }, "migration run failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
