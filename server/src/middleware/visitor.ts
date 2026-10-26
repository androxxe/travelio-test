import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const VISITOR_COOKIE = "tv_visitor";
export const VISITOR_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The app has no accounts. A long-lived httpOnly cookie identifies a browser
 * so the wishlist is per-visitor without a login screen.
 */
export function createVisitorMiddleware(): RequestHandler {
  return (request, response, next) => {
    const existing = request.cookies?.[VISITOR_COOKIE];

    if (typeof existing === "string" && UUID_PATTERN.test(existing)) {
      response.locals.visitorId = existing;
      next();
      return;
    }

    const visitorId = randomUUID();
    response.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.secure,
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE_MS,
    });
    response.locals.visitorId = visitorId;
    next();
  };
}
