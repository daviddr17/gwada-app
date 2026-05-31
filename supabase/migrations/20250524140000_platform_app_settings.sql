-- Platform-wide app branding (name, logo, favicon) — Superadmin UI.

create table public.platform_app_settings (
  id text primary key check (id = 'default'),
  app_name text not null default 'gwada',
  logo_path text,
  favicon_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger platform_app_settings_set_updated_at
  before update on public.platform_app_settings
  for each row execute function public.set_updated_at();

alter table public.platform_app_settings enable row level security;

create policy platform_app_settings_select_public
  on public.platform_app_settings
  for select
  to anon, authenticated
  using (true);

create policy platform_app_settings_superadmin_update
  on public.platform_app_settings
  for update
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

insert into public.platform_app_settings (id)
values ('default')
on conflict (id) do nothing;

-- Public bucket for logo / favicon assets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-branding',
  'platform-branding',
  true,
  2097152,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy platform_branding_objects_select_public
  on storage.objects
  for select
  to public
  using (bucket_id = 'platform-branding');

create policy platform_branding_objects_insert_superadmin
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'platform-branding'
    and public.auth_is_superadmin()
  );

create policy platform_branding_objects_update_superadmin
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'platform-branding'
    and public.auth_is_superadmin()
  )
  with check (
    bucket_id = 'platform-branding'
    and public.auth_is_superadmin()
  );

create policy platform_branding_objects_delete_superadmin
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'platform-branding'
    and public.auth_is_superadmin()
  );
