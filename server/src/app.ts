import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { Pool } from "./db/pool";
import { AppError } from "./lib/errors";
import type { Logger } from "./lib/logger";
import { createVisitorMiddleware } from "./middleware/visitor";
import type { WishlistRepository } from "./repositories/wishlistRepository";
import { createBooksRouter } from "./routes/books";
import { createHealthRouter } from "./routes/health";
import { createWishlistRouter } from "./routes/wishlist";
import type { GoogleBooksClient } from "./services/googleBooks";

export interface AppDependencies {
  pool: Pool;
  googleBooks: GoogleBooksClient;
  wishlist: WishlistRepository;
  config: {
    isProduction: boolean;
    clientOrigin: string;
    clientDist: string | null;
    rateLimitMax: number;
    trustProxy: boolean;
  };
  logger?: Logger;
}

export function createApp({
  pool,
  googleBooks,
  wishlist,
  config,
  logger,
}: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");

  const requestIdMiddleware: RequestHandler = (request, response, next) => {
    const incoming = request.header("x-request-id");
    const requestId =
      incoming && /^[A-Za-z0-9._-]{8,64}$/.test(incoming)
        ? incoming
        : randomUUID();

    response.locals.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    next();
  };

  app.use(requestIdMiddleware);

  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              // Covers are served from Google's regional book domains, so the
              // exact hostname varies by country.
              imgSrc: ["'self'", "data:", "https:"],
              fontSrc: ["'self'", "data:"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      hsts: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin: config.clientOrigin,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  if (logger) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (_request, response) => response.locals.requestId,
        autoLogging: {
          ignore: (request) => request.url === "/api/health",
        },
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            'res.headers["set-cookie"]',
          ],
          censor: "[redacted]",
        },
      }),
    );
  }

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.rateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => {
      response.setHeader("Retry-After", "60");
      response.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again shortly.",
          requestId: response.locals.requestId,
        },
      });
    },
  });

  // Wishlist responses are scoped to a visitor cookie and must never be
  // stored by a shared cache.
  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use("/api", createHealthRouter(pool));
  app.use("/api", apiLimiter, createVisitorMiddleware());
  app.use("/api", createBooksRouter(googleBooks));
  app.use("/api", createWishlistRouter(wishlist));

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "API route not found",
        requestId: response.locals.requestId,
      },
    });
  });

  if (config.clientDist) {
    const clientDist = resolve(config.clientDist);
    const indexHtml = resolve(clientDist, "index.html");

    if (existsSync(indexHtml)) {
      app.use(
        express.static(clientDist, {
          index: false,
          maxAge: "1h",
          setHeaders: (response, path) => {
            if (path.includes(`${resolve(clientDist, "assets")}/`)) {
              response.setHeader(
                "Cache-Control",
                "public, max-age=31536000, immutable",
              );
            }
          },
        }),
      );

      app.use((request, response, next) => {
        if (request.method !== "GET" || request.path.startsWith("/api")) {
          next();
          return;
        }
        response.sendFile(indexHtml);
      });
    }
  }

  const errorHandler: ErrorRequestHandler = (
    error,
    request,
    response,
    _next,
  ) => {
    if (response.headersSent) {
      return;
    }

    const requestId = response.locals.requestId;
    const errorBody = (code: string, message: string, details?: unknown) => ({
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
        ...(requestId ? { requestId } : {}),
      },
    });

    if (error instanceof AppError) {
      if (error.retryAfterSeconds) {
        response.setHeader("Retry-After", String(error.retryAfterSeconds));
      }
      response
        .status(error.status)
        .json(errorBody(error.code, error.message, error.details));
      return;
    }

    const bodyError = error as { type?: string };

    if (bodyError?.type === "entity.parse.failed") {
      response
        .status(400)
        .json(errorBody("VALIDATION_ERROR", "Request body is not valid JSON"));
      return;
    }

    if (bodyError?.type === "entity.too.large") {
      response
        .status(413)
        .json(errorBody("VALIDATION_ERROR", "Request body is too large"));
      return;
    }

    logger?.error(
      {
        err: error,
        requestId,
        method: request.method,
        path: request.path,
      },
      "unhandled request error",
    );

    response
      .status(500)
      .json(errorBody("INTERNAL_ERROR", "Something went wrong."));
  };

  app.use(errorHandler);

  return app;
}
