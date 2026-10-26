import { z } from "zod";

export const wishlistInputSchema = z.object({
  volumeId: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(500),
  authors: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .default([]),
  thumbnail: z
    .string()
    .url()
    .max(2_000)
    .nullish()
    .transform((value) => value ?? null),
  averageRating: z
    .number()
    .min(0)
    .max(5)
    .nullish()
    .transform((value) =>
      value === null || value === undefined
        ? null
        : Math.round(value * 10) / 10,
    ),
  ratingsCount: z.number().int().min(0).max(10_000_000).default(0),
});

export type WishlistInputBody = z.infer<typeof wishlistInputSchema>;

export const volumeIdParamSchema = z.object({
  volumeId: z.string().trim().min(1).max(64),
});
