import type { AddWishlistResult, WishlistInput, WishlistItem } from "../domain";
import type { Pool } from "../db/pool";

interface WishlistRow {
  volume_id: string;
  title: string;
  authors: string[];
  thumbnail_url: string | null;
  average_rating: string | null;
  ratings_count: number;
  created_at: Date;
}

export interface WishlistRepository {
  list(visitorId: string): Promise<WishlistItem[]>;
  add(visitorId: string, input: WishlistInput): Promise<AddWishlistResult>;
  remove(visitorId: string, volumeId: string): Promise<boolean>;
}

const COLUMNS = `
  volume_id, title, authors, thumbnail_url, average_rating, ratings_count, created_at
`;

function mapRow(row: WishlistRow): WishlistItem {
  return {
    volumeId: row.volume_id,
    title: row.title,
    authors: row.authors,
    thumbnail: row.thumbnail_url,
    averageRating:
      row.average_rating === null ? null : Number(row.average_rating),
    ratingsCount: row.ratings_count,
    addedAt: row.created_at.toISOString(),
  };
}

export function createWishlistRepository(pool: Pool): WishlistRepository {
  return {
    async list(visitorId) {
      const result = await pool.query<WishlistRow>(
        `select ${COLUMNS}
         from wishlist_items
         where visitor_id = $1
         order by created_at desc, id desc
         limit 500`,
        [visitorId],
      );
      return result.rows.map(mapRow);
    },

    async add(visitorId, input) {
      const inserted = await pool.query<WishlistRow>(
        `insert into wishlist_items (
           visitor_id, volume_id, title, authors, thumbnail_url, average_rating, ratings_count
         )
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (visitor_id, volume_id) do nothing
         returning ${COLUMNS}`,
        [
          visitorId,
          input.volumeId,
          input.title,
          input.authors,
          input.thumbnail,
          input.averageRating,
          input.ratingsCount,
        ],
      );

      const row = inserted.rows[0];
      if (row) {
        return { item: mapRow(row), created: true };
      }

      // Idempotent save: the item already existed, return the stored snapshot.
      const existing = await pool.query<WishlistRow>(
        `select ${COLUMNS}
         from wishlist_items
         where visitor_id = $1 and volume_id = $2`,
        [visitorId, input.volumeId],
      );

      const existingRow = existing.rows[0];
      if (!existingRow) {
        throw new Error("Wishlist item vanished between insert and select");
      }

      return { item: mapRow(existingRow), created: false };
    },

    async remove(visitorId, volumeId) {
      const result = await pool.query(
        "delete from wishlist_items where visitor_id = $1 and volume_id = $2",
        [visitorId, volumeId],
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}
