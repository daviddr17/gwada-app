-- Pin genau ein Highlight pro Feed-Modul (Gwada-Zeile oder Platform-Cache-Zeile).

alter table public.gwada_news_posts
  add column if not exists is_pinned boolean not null default false;

alter table public.restaurant_news_platform_cache
  add column if not exists is_pinned boolean not null default false;

alter table public.gwada_events
  add column if not exists is_pinned boolean not null default false;

alter table public.restaurant_events_platform_cache
  add column if not exists is_pinned boolean not null default false;

alter table public.gwada_gallery_items
  add column if not exists is_pinned boolean not null default false;

alter table public.restaurant_gallery_platform_cache
  add column if not exists is_pinned boolean not null default false;

alter table public.gwada_reviews
  add column if not exists is_pinned boolean not null default false;

alter table public.restaurant_reviews_platform_cache
  add column if not exists is_pinned boolean not null default false;

create index if not exists gwada_news_posts_restaurant_pinned_idx
  on public.gwada_news_posts (restaurant_id)
  where is_pinned;

create index if not exists restaurant_news_platform_cache_restaurant_pinned_idx
  on public.restaurant_news_platform_cache (restaurant_id)
  where is_pinned;

create index if not exists gwada_events_restaurant_pinned_idx
  on public.gwada_events (restaurant_id)
  where is_pinned;

create index if not exists restaurant_events_platform_cache_restaurant_pinned_idx
  on public.restaurant_events_platform_cache (restaurant_id)
  where is_pinned;

create index if not exists gwada_gallery_items_restaurant_pinned_idx
  on public.gwada_gallery_items (restaurant_id)
  where is_pinned;

create index if not exists restaurant_gallery_platform_cache_restaurant_pinned_idx
  on public.restaurant_gallery_platform_cache (restaurant_id)
  where is_pinned;

create index if not exists gwada_reviews_restaurant_pinned_idx
  on public.gwada_reviews (restaurant_id)
  where is_pinned;

create index if not exists restaurant_reviews_platform_cache_restaurant_pinned_idx
  on public.restaurant_reviews_platform_cache (restaurant_id)
  where is_pinned;
