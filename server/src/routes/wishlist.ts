import { Router } from "express";
import { AppError } from "../lib/errors";
import { formatIssues } from "../lib/validation";
import { volumeIdParamSchema, wishlistInputSchema } from "../schemas/wishlist";
import type { WishlistRepository } from "../repositories/wishlistRepository";

export function createWishlistRouter(repository: WishlistRepository): Router {
  const router = Router();

  router.get("/wishlist", async (_request, response) => {
    const items = await repository.list(response.locals.visitorId);
    response.json({ items });
  });

  router.post("/wishlist", async (request, response) => {
    const parsed = wishlistInputSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid wishlist payload",
        { details: formatIssues(parsed.error) },
      );
    }

    const result = await repository.add(
      response.locals.visitorId,
      parsed.data,
    );

    response.status(result.created ? 201 : 200).json({ item: result.item });
  });

  router.delete("/wishlist/:volumeId", async (request, response) => {
    const parsed = volumeIdParamSchema.safeParse(request.params);

    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid volume id",
        { details: formatIssues(parsed.error) },
      );
    }

    await repository.remove(response.locals.visitorId, parsed.data.volumeId);
    response.status(204).end();
  });

  return router;
}
