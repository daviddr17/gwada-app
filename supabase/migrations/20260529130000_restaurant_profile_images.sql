-- Restaurant profile images (avatar + cover) on public.restaurants

alter table public.restaurants
  add column if not exists avatar_storage_path text,
  add column if not exists cover_storage_path text;

-- ---------------------------------------------------------------------------
-- Profile image storage (private bucket, staff-gated RLS)
-- Paths: {restaurantId}/avatar.{ext} | {restaurantId}/cover.{ext}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-profile-images',
  'restaurant-profile-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists restaurant_profile_images_select on storage.objects;
create policy restaurant_profile_images_select
  on storage.objects for select
  using (
    bucket_id = 'restaurant-profile-images'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists restaurant_profile_images_insert on storage.objects;
create policy restaurant_profile_images_insert
  on storage.objects for insert
  with check (
    bucket_id = 'restaurant-profile-images'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists restaurant_profile_images_update on storage.objects;
create policy restaurant_profile_images_update
  on storage.objects for update
  using (
    bucket_id = 'restaurant-profile-images'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists restaurant_profile_images_delete on storage.objects;
create policy restaurant_profile_images_delete
  on storage.objects for delete
  using (
    bucket_id = 'restaurant-profile-images'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );
