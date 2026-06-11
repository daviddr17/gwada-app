-- News-Modul: Gwada-Posts, Plattform-Publikationen, Medien-Storage

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'news.manage'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create or replace function public.auth_user_restaurant_permission_keys(p_restaurant_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct rpp.permission_key
  from public.restaurant_employees re
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = re.position_id
  where re.restaurant_id = p_restaurant_id
    and re.profile_id = (select auth.uid())
    and re.is_active
    and re.position_id is not null
  union
  select unnest(array[
    'roles.manage',
    'team.manage',
    'integrations.whatsapp',
    'integrations.email',
    'integrations.facebook',
    'integrations.instagram',
    'integrations.google_business',
    'integrations.lexoffice',
    'settings.restaurant',
    'settings.opening_hours',
    'settings.branding',
    'settings.dashboard',
    'documents.notes.edit',
    'display.manage',
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.inventory',
    'display.kds',
    'display.module_switch',
    'pos.kasse.manage',
    'pos.kasse.export',
    'accounting.manage',
    'news.manage'
  ]::text[])
  where exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  );
$$;

create table if not exists public.restaurant_news_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  whatsapp_channel_id text,
  default_embed_view text not null default 'grid'
    check (default_embed_view in ('grid', 'list')),
  embed_max_items integer not null default 24
    check (embed_max_items between 1 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurant_news_settings_set_updated_at
  before update on public.restaurant_news_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_news_settings enable row level security;

create policy restaurant_news_settings_staff_select
  on public.restaurant_news_settings for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_news_settings_staff_write
  on public.restaurant_news_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'));

create table if not exists public.gwada_news_posts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text,
  body text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  media jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gwada_news_posts_media_is_array
    check (jsonb_typeof(media) = 'array')
);

create index if not exists gwada_news_posts_restaurant_published_idx
  on public.gwada_news_posts (restaurant_id, published_at desc nulls last);

create index if not exists gwada_news_posts_restaurant_scheduled_idx
  on public.gwada_news_posts (restaurant_id, scheduled_at)
  where status = 'scheduled';

create trigger gwada_news_posts_set_updated_at
  before update on public.gwada_news_posts
  for each row execute function public.set_updated_at();

alter table public.gwada_news_posts enable row level security;

create policy gwada_news_posts_staff_select
  on public.gwada_news_posts for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy gwada_news_posts_staff_write
  on public.gwada_news_posts for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'));

create table if not exists public.gwada_news_publications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.gwada_news_posts (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null
    check (platform in ('gwada', 'facebook', 'instagram', 'google_business', 'whatsapp_channel')),
  external_id text,
  external_url text,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'published', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  last_error text,
  insights jsonb not null default '{}'::jsonb,
  platform_config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gwada_news_publications_insights_is_object
    check (jsonb_typeof(insights) = 'object'),
  constraint gwada_news_publications_platform_config_is_object
    check (jsonb_typeof(platform_config) = 'object')
);

create unique index if not exists gwada_news_publications_post_platform_uidx
  on public.gwada_news_publications (post_id, platform);

create index if not exists gwada_news_publications_restaurant_platform_idx
  on public.gwada_news_publications (restaurant_id, platform, published_at desc nulls last);

create trigger gwada_news_publications_set_updated_at
  before update on public.gwada_news_publications
  for each row execute function public.set_updated_at();

alter table public.gwada_news_publications enable row level security;

create policy gwada_news_publications_staff_select
  on public.gwada_news_publications for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy gwada_news_publications_staff_write
  on public.gwada_news_publications for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'news.manage'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-media',
  'news-media',
  false,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy news_media_storage_select_staff
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'news-media'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );

create policy news_media_storage_insert_staff
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'news-media'
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'news.manage'
    )
  );

create policy news_media_storage_delete_staff
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'news-media'
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'news.manage'
    )
  );
