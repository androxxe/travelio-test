import { Router } from "express";
import type { Pool } from "../db/pool";

export function createHealthRouter(pool: Pool): Router {
  const router = Router();

  // Liveness: the process is up. Used by orchestrators that should not
  // restart the container just because Postgres is briefly unavailable.
  router.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // Readiness: the process can serve traffic, which requires the database.
  router.get("/ready", async (_request, response) => {
    try {
      await pool.query("select 1");
      response.json({ status: "ready", db: "up" });
    } catch {
      response.status(503).json({ status: "not_ready", db: "down" });
    }
  });

  return router;
}
