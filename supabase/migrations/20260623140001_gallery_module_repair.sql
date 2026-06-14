-- Reparatur: 20260623120000 schlug auf Live fehl (Funktion vor Tabelle), Version aber registriert.
-- Wendet den fehlenden Galerie-Schema-Stand idempotent an.

-- ---------------------------------------------------------------------------
-- Workspace-Speicher (3 GB gesamt)
-- ---------------------------------------------------------------------------
create or replace function public.restaurant_workspace_quota_bytes()
returns bigint
language sql
immutable
as $$
  select 3221225472::bigint;
$$;

-- ---------------------------------------------------------------------------
-- Einstellungen
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_gallery_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  embed_max_items integer not null default 48
    check (embed_max_items between 1 and 200),
  embed_platforms jsonb not null default '["gwada","facebook","instagram","google_business"]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_gallery_settings_embed_platforms_is_array
    check (jsonb_typeof(embed_platforms) = 'array')
);

drop trigger if exists restaurant_gallery_settings_set_updated_at on public.restaurant_gallery_settings;
create trigger restaurant_gallery_settings_set_updated_at
  before update on public.restaurant_gallery_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_gallery_settings enable row level security;

drop policy if exists restaurant_gallery_settings_staff_select on public.restaurant_gallery_settings;
create policy restaurant_gallery_settings_staff_select
  on public.restaurant_gallery_settings for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'gallery.read')
  );

drop policy if exists restaurant_gallery_settings_staff_write on public.restaurant_gallery_settings;
create policy restaurant_gallery_settings_staff_write
  on public.restaurant_gallery_settings for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'gallery.update')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'gallery.update')
  );

-- ---------------------------------------------------------------------------
-- Gwada-Galerie-Bilder
-- ---------------------------------------------------------------------------
create table if not exists public.gwada_gallery_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text,
  caption text,
  category text,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width integer,
  height integer,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gwada_gallery_items_size_positive check (size_bytes > 0),
  constraint gwada_gallery_items_storage_path_len check (char_length(storage_path) between 1 and 512)
);

create unique index if not exists gwada_gallery_items_storage_path_idx
  on public.gwada_gallery_items (storage_path);

create index if not exists gwada_gallery_items_restaurant_created_idx
  on public.gwada_gallery_items (restaurant_id, created_at desc);

create index if not exists gwada_gallery_items_restaurant_category_idx
  on public.gwada_gallery_items (restaurant_id, category);

create or replace function public.restaurant_gallery_used_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(size_bytes), 0)::bigint
  from public.gwada_gallery_items
  where restaurant_id = p_restaurant_id;
$$;

create or replace function public.restaurant_news_media_used_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sum((elem->>'sizeBytes')::bigint)
      from public.gwada_news_posts p,
        lateral jsonb_array_elements(p.media) as elem
      where p.restaurant_id = p_restaurant_id
        and (elem->>'sizeBytes') ~ '^[0-9]+$'
    ),
    0
  )::bigint;
$$;

create or replace function public.restaurant_accounting_storage_used_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(coalesce(size_bytes, 0)), 0)::bigint
  from public.accounting_vouchers
  where restaurant_id = p_restaurant_id
    and storage_path is not null;
$$;

create or replace function public.restaurant_workspace_used_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    public.restaurant_documents_used_bytes(p_restaurant_id)
    + public.restaurant_gallery_used_bytes(p_restaurant_id)
    + public.restaurant_news_media_used_bytes(p_restaurant_id)
    + public.restaurant_accounting_storage_used_bytes(p_restaurant_id);
$$;

create or replace function public.restaurant_workspace_storage_breakdown(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'documentsBytes', public.restaurant_documents_used_bytes(p_restaurant_id),
    'galleryBytes', public.restaurant_gallery_used_bytes(p_restaurant_id),
    'newsBytes', public.restaurant_news_media_used_bytes(p_restaurant_id),
    'accountingBytes', public.restaurant_accounting_storage_used_bytes(p_restaurant_id),
    'totalBytes', public.restaurant_workspace_used_bytes(p_restaurant_id),
    'quotaBytes', public.restaurant_workspace_quota_bytes()
  );
$$;

grant execute on function public.restaurant_gallery_used_bytes(uuid) to authenticated;
grant execute on function public.restaurant_workspace_used_bytes(uuid) to authenticated;
grant execute on function public.restaurant_workspace_storage_breakdown(uuid) to authenticated;

create or replace function public.restaurant_documents_quota_bytes()
returns bigint
language sql
immutable
as $$
  select public.restaurant_workspace_quota_bytes();
$$;

create or replace function public.restaurant_documents_enforce_quota()
returns trigger
language plpgsql
as $$
declare
  used bigint;
  quota bigint;
begin
  quota := public.restaurant_workspace_quota_bytes();
  select public.restaurant_workspace_used_bytes(new.restaurant_id) into used;
  if used + new.size_bytes > quota then
    raise exception 'storage_quota_exceeded'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.gwada_gallery_items_enforce_quota()
returns trigger
language plpgsql
as $$
declare
  used bigint;
  quota bigint;
begin
  quota := public.restaurant_workspace_quota_bytes();
  select public.restaurant_workspace_used_bytes(new.restaurant_id) into used;
  if used + new.size_bytes > quota then
    raise exception 'storage_quota_exceeded'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists gwada_gallery_items_set_updated_at on public.gwada_gallery_items;
create trigger gwada_gallery_items_set_updated_at
  before update on public.gwada_gallery_items
  for each row execute function public.set_updated_at();

drop trigger if exists gwada_gallery_items_quota_before_insert on public.gwada_gallery_items;
create trigger gwada_gallery_items_quota_before_insert
  before insert on public.gwada_gallery_items
  for each row execute function public.gwada_gallery_items_enforce_quota();

alter table public.gwada_gallery_items enable row level security;

drop policy if exists gwada_gallery_items_staff_select on public.gwada_gallery_items;
create policy gwada_gallery_items_staff_select
  on public.gwada_gallery_items for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'gallery.read')
  );

drop policy if exists gwada_gallery_items_staff_insert on public.gwada_gallery_items;
create policy gwada_gallery_items_staff_insert
  on public.gwada_gallery_items for insert
  to authenticated
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'gallery.create')
  );

drop policy if exists gwada_gallery_items_staff_update on public.gwada_gallery_items;
create policy gwada_gallery_items_staff_update
  on public.gwada_gallery_items for update
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'gallery.update')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'gallery.update')
  );

drop policy if exists gwada_gallery_items_staff_delete on public.gwada_gallery_items;
create policy gwada_gallery_items_staff_delete
  on public.gwada_gallery_items for delete
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'gallery.delete')
  );

-- ---------------------------------------------------------------------------
-- Gwada-Highlights
-- ---------------------------------------------------------------------------
create table if not exists public.gwada_gallery_highlights (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null,
  cover_storage_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gwada_gallery_highlights_title_len check (char_length(title) between 1 and 120)
);

create index if not exists gwada_gallery_highlights_restaurant_sort_idx
  on public.gwada_gallery_highlights (restaurant_id, sort_order);

drop trigger if exists gwada_gallery_highlights_set_updated_at on public.gwada_gallery_highlights;
create trigger gwada_gallery_highlights_set_updated_at
  before update on public.gwada_gallery_highlights
  for each row execute function public.set_updated_at();

alter table public.gwada_gallery_highlights enable row level security;

drop policy if exists gwada_gallery_highlights_staff_select on public.gwada_gallery_highlights;
create policy gwada_gallery_highlights_staff_select
  on public.gwada_gallery_highlights for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'gallery.read')
  );

drop policy if exists gwada_gallery_highlights_staff_write on public.gwada_gallery_highlights;
create policy gwada_gallery_highlights_staff_write
  on public.gwada_gallery_highlights for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'gallery.update')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'gallery.update')
  );

create table if not exists public.gwada_gallery_highlight_items (
  highlight_id uuid not null references public.gwada_gallery_highlights (id) on delete cascade,
  item_id uuid not null references public.gwada_gallery_items (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (highlight_id, item_id)
);

create index if not exists gwada_gallery_highlight_items_item_idx
  on public.gwada_gallery_highlight_items (item_id);

alter table public.gwada_gallery_highlight_items enable row level security;

drop policy if exists gwada_gallery_highlight_items_staff_select on public.gwada_gallery_highlight_items;
create policy gwada_gallery_highlight_items_staff_select
  on public.gwada_gallery_highlight_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.gwada_gallery_highlights h
      where h.id = highlight_id
        and public.auth_is_restaurant_staff(h.restaurant_id)
        and public.auth_has_restaurant_permission(h.restaurant_id, 'gallery.read')
    )
  );

drop policy if exists gwada_gallery_highlight_items_staff_write on public.gwada_gallery_highlight_items;
create policy gwada_gallery_highlight_items_staff_write
  on public.gwada_gallery_highlight_items for all
  to authenticated
  using (
    exists (
      select 1
      from public.gwada_gallery_highlights h
      where h.id = highlight_id
        and public.auth_has_restaurant_permission(h.restaurant_id, 'gallery.update')
    )
  )
  with check (
    exists (
      select 1
      from public.gwada_gallery_highlights h
      where h.id = highlight_id
        and public.auth_has_restaurant_permission(h.restaurant_id, 'gallery.update')
    )
  );

-- ---------------------------------------------------------------------------
-- Plattform-Cache
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_gallery_platform_sync (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'google_business')),
  synced_at timestamptz,
  last_error text,
  item_count integer not null default 0,
  primary key (restaurant_id, platform)
);

alter table public.restaurant_gallery_platform_sync enable row level security;

drop policy if exists restaurant_gallery_platform_sync_staff_select on public.restaurant_gallery_platform_sync;
create policy restaurant_gallery_platform_sync_staff_select
  on public.restaurant_gallery_platform_sync for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'gallery.read')
  );

create table if not exists public.restaurant_gallery_platform_cache (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'google_business')),
  external_id text not null,
  item jsonb not null,
  category text,
  created_at timestamptz,
  unique (restaurant_id, platform, external_id)
);

create index if not exists restaurant_gallery_platform_cache_restaurant_platform_idx
  on public.restaurant_gallery_platform_cache (restaurant_id, platform, created_at desc nulls last);

create index if not exists restaurant_gallery_platform_cache_category_idx
  on public.restaurant_gallery_platform_cache (restaurant_id, platform, category);

alter table public.restaurant_gallery_platform_cache enable row level security;

drop policy if exists restaurant_gallery_platform_cache_staff_select on public.restaurant_gallery_platform_cache;
create policy restaurant_gallery_platform_cache_staff_select
  on public.restaurant_gallery_platform_cache for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'gallery.read')
  );

-- ---------------------------------------------------------------------------
-- Storage bucket gallery-media
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-media',
  'gallery-media',
  false,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gallery_media_storage_select_staff on storage.objects;
create policy gallery_media_storage_select_staff
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gallery-media'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'gallery.read'
    )
  );

drop policy if exists gallery_media_storage_insert_staff on storage.objects;
create policy gallery_media_storage_insert_staff
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gallery-media'
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'gallery.create'
    )
  );

drop policy if exists gallery_media_storage_delete_staff on storage.objects;
create policy gallery_media_storage_delete_staff
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gallery-media'
    and public.auth_has_restaurant_permission(
      public.storage_restaurant_id_from_object_path(name),
      'gallery.delete'
    )
  );
