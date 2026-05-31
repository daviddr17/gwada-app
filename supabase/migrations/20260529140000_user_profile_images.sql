-- User profile images (avatar + cover) on public.profiles

alter table public.profiles
  add column if not exists avatar_storage_path text,
  add column if not exists cover_storage_path text;

comment on column public.profiles.avatar_storage_path is
  'Storage path in user-profile-images bucket (round profile photo).';
comment on column public.profiles.cover_storage_path is
  'Storage path in user-profile-images bucket (cover/title image).';

-- ---------------------------------------------------------------------------
-- User profile image storage (private bucket, own-user RLS)
-- Paths: {userId}/avatar.{ext} | {userId}/cover.{ext}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-profile-images',
  'user-profile-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists user_profile_images_select on storage.objects;
create policy user_profile_images_select
  on storage.objects for select
  using (
    bucket_id = 'user-profile-images'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

drop policy if exists user_profile_images_insert on storage.objects;
create policy user_profile_images_insert
  on storage.objects for insert
  with check (
    bucket_id = 'user-profile-images'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

drop policy if exists user_profile_images_update on storage.objects;
create policy user_profile_images_update
  on storage.objects for update
  using (
    bucket_id = 'user-profile-images'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

drop policy if exists user_profile_images_delete on storage.objects;
create policy user_profile_images_delete
  on storage.objects for delete
  using (
    bucket_id = 'user-profile-images'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );
