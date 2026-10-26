import { Router } from "express";
import { AppError } from "../lib/errors";
import { formatIssues } from "../lib/validation";
import { booksQuerySchema } from "../schemas/books";
import type { GoogleBooksClient } from "../services/googleBooks";

export function createBooksRouter(googleBooks: GoogleBooksClient): Router {
  const router = Router();

  router.get("/books", async (request, response) => {
    const parsed = booksQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid search parameters",
        { details: formatIssues(parsed.error) },
      );
    }

    if ((parsed.data.page - 1) * parsed.data.limit >= 1000) {
      throw new AppError(400, "VALIDATION_ERROR", "Page is out of range", {
        details: [
          {
            path: "page",
            message: "Google Books exposes at most the first 1,000 results",
          },
        ],
      });
    }

    const result = await googleBooks.search(parsed.data);
    response.json(result);  });

  return router;
}
