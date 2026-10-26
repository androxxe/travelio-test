export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  thumbnail: string | null;
  publishedDate: string | null;
  averageRating: number | null;
  ratingsCount: number;
  previewLink: string | null;
  categories: string[];
}

export interface BookSearchResult {
  query: string;
  page: number;
  limit: number;
  totalItems: number;
  hasNextPage: boolean;
  items: Book[];
  source: "google" | "fallback";
  notice: string | null;
}

export interface WishlistInput {
  volumeId: string;
  title: string;
  authors: string[];
  thumbnail: string | null;
  averageRating: number | null;
  ratingsCount: number;
}

export interface WishlistItem extends WishlistInput {
  addedAt: string;
}

export interface AddWishlistResult {
  item: WishlistItem;
  created: boolean;
}
