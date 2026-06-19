-- News Stories: Gwada Story-Rings (permanent) + gecachte Meta-Stories (Facebook/Instagram)

-- ---------------------------------------------------------------------------
-- Gwada Story-Rings (analog Galerie-Highlights)
-- ---------------------------------------------------------------------------
create table if not exists public.gwada_news_story_rings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null,
  cover_storage_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gwada_news_story_rings_title_len check (char_length(title) between 1 and 120)
);

create index if not exists gwada_news_story_rings_restaurant_sort_idx
  on public.gwada_news_story_rings (restaurant_id, sort_order);

create trigger gwada_news_story_rings_set_updated_at
  before update on public.gwada_news_story_rings
  for each row execute function public.set_updated_at();

alter table public.gwada_news_story_rings enable row level security;

create policy gwada_news_story_rings_staff_select
  on public.gwada_news_story_rings for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy gwada_news_story_rings_staff_write
  on public.gwada_news_story_rings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'));

create table if not exists public.gwada_news_story_ring_items (
  ring_id uuid not null references public.gwada_news_story_rings (id) on delete cascade,
  post_id uuid not null references public.gwada_news_posts (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (ring_id, post_id)
);

create index if not exists gwada_news_story_ring_items_post_idx
  on public.gwada_news_story_ring_items (post_id);

alter table public.gwada_news_story_ring_items enable row level security;

create policy gwada_news_story_ring_items_staff_select
  on public.gwada_news_story_ring_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.gwada_news_story_rings r
      where r.id = ring_id
        and public.auth_is_restaurant_staff(r.restaurant_id)
    )
  );

create policy gwada_news_story_ring_items_staff_write
  on public.gwada_news_story_ring_items for all
  to authenticated
  using (
    exists (
      select 1
      from public.gwada_news_story_rings r
      where r.id = ring_id
        and public.auth_has_restaurant_permission(r.restaurant_id, 'news.manage')
    )
  )
  with check (
    exists (
      select 1
      from public.gwada_news_story_rings r
      where r.id = ring_id
        and public.auth_has_restaurant_permission(r.restaurant_id, 'news.manage')
    )
  );

-- ---------------------------------------------------------------------------
-- Meta Stories Cache (Facebook / Instagram — DB-first reads)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_news_stories_sync (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null
    check (platform in ('facebook', 'instagram')),
  synced_at timestamptz,
  last_error text,
  item_count integer not null default 0
    check (item_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, platform)
);

create trigger restaurant_news_stories_sync_set_updated_at
  before update on public.restaurant_news_stories_sync
  for each row execute function public.set_updated_at();

alter table public.restaurant_news_stories_sync enable row level security;

create policy restaurant_news_stories_sync_staff_select
  on public.restaurant_news_stories_sync for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create table if not exists public.restaurant_news_stories_cache (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null
    check (platform in ('facebook', 'instagram')),
  external_id text not null,
  story jsonb not null,
  published_at timestamptz,
  expires_at timestamptz,
  fetched_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_news_stories_cache_story_is_object
    check (jsonb_typeof(story) = 'object'),
  unique (restaurant_id, platform, external_id)
);

create index if not exists restaurant_news_stories_cache_restaurant_platform_idx
  on public.restaurant_news_stories_cache (restaurant_id, platform, published_at desc nulls last);

alter table public.restaurant_news_stories_cache enable row level security;

create policy restaurant_news_stories_cache_staff_select
  on public.restaurant_news_stories_cache for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));
