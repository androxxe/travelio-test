-- Wishlist rows are scoped by an anonymous visitor cookie, so no user table is
-- needed. Book fields are snapshotted at save time so the wishlist keeps
-- rendering even when Google Books later rate-limits or drops a volume.
create table if not exists wishlist_items (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  volume_id text not null,
  title text not null,
  authors text[] not null default '{}',
  thumbnail_url text,
  average_rating numeric(2, 1),
  ratings_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint wishlist_items_visitor_volume_unique unique (visitor_id, volume_id),
  constraint wishlist_items_rating_range check (
    average_rating is null or (average_rating >= 0 and average_rating <= 5)
  ),
  constraint wishlist_items_ratings_count_positive check (ratings_count >= 0)
);

create index if not exists wishlist_items_visitor_created_idx
  on wishlist_items (visitor_id, created_at desc);
