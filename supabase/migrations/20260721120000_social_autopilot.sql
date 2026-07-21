-- Social Autopilot MVP: Brand Kit, Post-Vorschläge, Foto-Aufgaben

create table if not exists public.restaurant_social_brand_kit (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  enabled boolean not null default true,
  image_strategy text not null default 'mix'
    check (image_strategy in ('own_first', 'mix', 'ai_strong')),
  never_ai_food boolean not null default true,
  tone text not null default 'warm'
    check (tone in ('casual', 'warm', 'fine', 'modern')),
  style_preset text not null default 'warm_gastro'
    check (style_preset in ('modern_plain', 'warm_gastro', 'dark_fine')),
  voice_notes text not null default '',
  do_not text not null default '',
  hashtags text[] not null default '{}'::text[],
  cta text not null default '',
  weekly_post_target integer not null default 3
    check (weekly_post_target between 1 and 7),
  gold_captions text[] not null default '{}'::text[],
  hero_assets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(hero_assets) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurant_social_brand_kit_set_updated_at
  before update on public.restaurant_social_brand_kit
  for each row execute function public.set_updated_at();

alter table public.restaurant_social_brand_kit enable row level security;

create policy restaurant_social_brand_kit_staff_select
  on public.restaurant_social_brand_kit for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_social_brand_kit_staff_write
  on public.restaurant_social_brand_kit for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'settings.branding')
    or public.auth_has_restaurant_permission(restaurant_id, 'news.manage')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'settings.branding')
    or public.auth_has_restaurant_permission(restaurant_id, 'news.manage')
  );

create table if not exists public.social_post_suggestions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'skipped', 'expired', 'needs_asset')),
  slot_kind text not null
    check (slot_kind in ('holiday', 'menu_dish', 'event', 'brand', 'ambient')),
  template_id text not null
    check (template_id in ('food_hero', 'brand_card', 'quote')),
  planned_at timestamptz not null,
  title text,
  caption text not null default '',
  platforms text[] not null default array['facebook', 'instagram']::text[],
  source_json jsonb not null default '{}'::jsonb,
  asset_json jsonb not null default '{}'::jsonb,
  news_post_id uuid references public.gwada_news_posts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists social_post_suggestions_restaurant_status_planned_idx
  on public.social_post_suggestions (restaurant_id, status, planned_at);

create index if not exists social_post_suggestions_restaurant_pending_idx
  on public.social_post_suggestions (restaurant_id, planned_at)
  where status in ('pending', 'needs_asset');

create trigger social_post_suggestions_set_updated_at
  before update on public.social_post_suggestions
  for each row execute function public.set_updated_at();

alter table public.social_post_suggestions enable row level security;

create policy social_post_suggestions_staff_select
  on public.social_post_suggestions for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy social_post_suggestions_staff_write
  on public.social_post_suggestions for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'));

create table if not exists public.social_media_tasks (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind text not null
    check (kind in ('upload_photos', 'mark_heroes')),
  status text not null default 'open'
    check (status in ('open', 'done', 'dismissed')),
  title text not null,
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index if not exists social_media_tasks_restaurant_open_idx
  on public.social_media_tasks (restaurant_id, created_at desc)
  where status = 'open';

alter table public.social_media_tasks enable row level security;

create policy social_media_tasks_staff_select
  on public.social_media_tasks for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy social_media_tasks_staff_write
  on public.social_media_tasks for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'news.manage')
    or public.auth_has_restaurant_permission(restaurant_id, 'settings.branding')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'news.manage')
    or public.auth_has_restaurant_permission(restaurant_id, 'settings.branding')
  );
