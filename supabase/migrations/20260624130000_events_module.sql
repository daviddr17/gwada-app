-- Events-Modul: Gwada-Events, Plattform-Publikationen, externer Cache

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'events.manage'
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
    'news.manage',
    'gallery.read',
    'gallery.create',
    'gallery.update',
    'gallery.delete',
    'events.manage'
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

create table if not exists public.restaurant_events_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  whatsapp_channel_ids jsonb not null default '[]'::jsonb,
  default_embed_view text not null default 'list'
    check (default_embed_view in ('grid', 'list')),
  embed_max_items integer not null default 24
    check (embed_max_items between 1 and 100),
  embed_platforms jsonb not null default '["gwada","facebook","google_business"]'::jsonb,
  embed_show_all_filter boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_events_settings_whatsapp_channel_ids_is_array
    check (jsonb_typeof(whatsapp_channel_ids) = 'array'),
  constraint restaurant_events_settings_embed_platforms_is_array
    check (jsonb_typeof(embed_platforms) = 'array')
);

create trigger restaurant_events_settings_set_updated_at
  before update on public.restaurant_events_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_events_settings enable row level security;

create policy restaurant_events_settings_staff_select
  on public.restaurant_events_settings for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_events_settings_staff_write
  on public.restaurant_events_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'));

create table if not exists public.gwada_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz,
  ticket_url text,
  location text,
  cover_storage_path text,
  cover_mime_type text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'cancelled', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gwada_events_title_len check (char_length(title) between 1 and 200),
  constraint gwada_events_end_after_start check (end_at is null or end_at >= start_at)
);

create index if not exists gwada_events_restaurant_start_idx
  on public.gwada_events (restaurant_id, start_at desc);

create index if not exists gwada_events_restaurant_published_idx
  on public.gwada_events (restaurant_id, published_at desc nulls last);

create trigger gwada_events_set_updated_at
  before update on public.gwada_events
  for each row execute function public.set_updated_at();

alter table public.gwada_events enable row level security;

create policy gwada_events_staff_select
  on public.gwada_events for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy gwada_events_staff_write
  on public.gwada_events for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'));

create table if not exists public.gwada_event_publications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gwada_events (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null
    check (platform in ('gwada', 'facebook', 'google_business', 'instagram', 'whatsapp_channel')),
  external_id text,
  external_url text,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'published', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  last_error text,
  platform_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gwada_event_publications_platform_config_is_object
    check (jsonb_typeof(platform_config) = 'object')
);

create unique index if not exists gwada_event_publications_event_platform_uidx
  on public.gwada_event_publications (event_id, platform);

create index if not exists gwada_event_publications_restaurant_platform_idx
  on public.gwada_event_publications (restaurant_id, platform, published_at desc nulls last);

create trigger gwada_event_publications_set_updated_at
  before update on public.gwada_event_publications
  for each row execute function public.set_updated_at();

alter table public.gwada_event_publications enable row level security;

create policy gwada_event_publications_staff_select
  on public.gwada_event_publications for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy gwada_event_publications_staff_write
  on public.gwada_event_publications for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'));

create table if not exists public.restaurant_events_platform_sync (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null check (platform in ('facebook', 'google_business')),
  synced_at timestamptz,
  last_error text,
  item_count integer not null default 0,
  primary key (restaurant_id, platform)
);

alter table public.restaurant_events_platform_sync enable row level security;

create policy restaurant_events_platform_sync_staff_select
  on public.restaurant_events_platform_sync for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create table if not exists public.restaurant_events_platform_cache (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null check (platform in ('facebook', 'google_business')),
  external_id text not null,
  item jsonb not null,
  start_at timestamptz,
  fetched_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, platform, external_id)
);

create index if not exists restaurant_events_platform_cache_restaurant_platform_idx
  on public.restaurant_events_platform_cache (restaurant_id, platform, start_at desc nulls last);

alter table public.restaurant_events_platform_cache enable row level security;

create policy restaurant_events_platform_cache_staff_select
  on public.restaurant_events_platform_cache for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.restaurant_events_platform_sync;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'events-media',
  'events-media',
  false,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy events_media_storage_select_staff
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'events-media'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'events.manage'
    )
  );

create policy events_media_storage_insert_staff
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'events-media'
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'events.manage'
    )
  );

create policy events_media_storage_delete_staff
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'events-media'
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'events.manage'
    )
  );
