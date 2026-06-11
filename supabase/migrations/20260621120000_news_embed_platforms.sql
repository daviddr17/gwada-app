-- Per-platform toggles for public news embed (empty object = all platforms enabled).

alter table public.restaurant_news_settings
  add column if not exists embed_platforms jsonb not null default '{}'::jsonb;
