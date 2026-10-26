import { createApp } from "./app";
import { loadConfig } from "./config";
import { runMigrations } from "./db/migrate";
import { createPool, waitForDatabase } from "./db/pool";
import { createLogger } from "./lib/logger";
import { createWishlistRepository } from "./repositories/wishlistRepository";
import { createGoogleBooksClient } from "./services/googleBooks";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const pool = createPool(config.databaseUrl);

async function start(): Promise<void> {
  await waitForDatabase(pool, { logger });

  if (config.runMigrations) {
    await runMigrations(pool, config.migrationsDir, logger);
  }

  const googleBooks = createGoogleBooksClient({
    baseUrl: config.googleBooksBaseUrl,
    apiKey: config.googleBooksApiKey,
    logger,
    fallbackCatalog: config.fallbackCatalogEnabled,
  });
  const wishlist = createWishlistRepository(pool);

  const app = createApp({
    pool,
    googleBooks,
    wishlist,
    config,
    logger,
  });

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.nodeEnv },
      "shelf api listening",
    );
  });

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "shutting down");

    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await pool.end();
    process.exit(0);
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

try {
  await start();
} catch (error) {
  logger.fatal({ err: error }, "failed to start api");
  await pool.end().catch(() => undefined);
  process.exit(1);
}
