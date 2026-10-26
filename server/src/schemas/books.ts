import { z } from "zod";

export const booksQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Search with at least 2 characters")
    .max(120, "Search is limited to 120 characters"),
  page: z.coerce.number().int().min(1).max(50).default(1),
  limit: z.coerce.number().int().min(1).max(40).default(20),
});

export type BooksQuery = z.infer<typeof booksQuerySchema>;
