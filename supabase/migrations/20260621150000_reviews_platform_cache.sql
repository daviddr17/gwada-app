-- Gecachte externe Bewertungen pro Restaurant und Plattform (schnelle Reads, Hintergrund-Sync)

create table if not exists public.restaurant_reviews_platform_sync (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null
    check (platform in ('google', 'facebook')),
  synced_at timestamptz,
  last_error text,
  item_count integer not null default 0
    check (item_count >= 0),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, platform)
);

create trigger restaurant_reviews_platform_sync_set_updated_at
  before update on public.restaurant_reviews_platform_sync
  for each row execute function public.set_updated_at();

alter table public.restaurant_reviews_platform_sync enable row level security;

create policy restaurant_reviews_platform_sync_staff_select
  on public.restaurant_reviews_platform_sync for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create table if not exists public.restaurant_reviews_platform_cache (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null
    check (platform in ('google', 'facebook')),
  external_id text not null,
  item jsonb not null,
  created_at timestamptz,
  fetched_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_reviews_platform_cache_item_is_object
    check (jsonb_typeof(item) = 'object'),
  unique (restaurant_id, platform, external_id)
);

create index if not exists restaurant_reviews_platform_cache_restaurant_platform_idx
  on public.restaurant_reviews_platform_cache (restaurant_id, platform, created_at desc nulls last);

alter table public.restaurant_reviews_platform_cache enable row level security;

create policy restaurant_reviews_platform_cache_staff_select
  on public.restaurant_reviews_platform_cache for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));
