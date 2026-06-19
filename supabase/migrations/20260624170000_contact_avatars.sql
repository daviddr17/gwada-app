-- Kontakt- und WhatsApp-Thread-Profilbilder (Inbox-Chat-Header).

alter table public.contacts
  add column if not exists avatar_storage_path text;

comment on column public.contacts.avatar_storage_path is
  'Profilbild im Bucket restaurant-contact-avatars (Upload oder WhatsApp-Sync).';

create table if not exists public.restaurant_whatsapp_chat_avatars (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  chat_id text not null,
  avatar_storage_path text not null,
  synced_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, chat_id)
);

comment on table public.restaurant_whatsapp_chat_avatars is
  'WAHA-Profilbilder für unverknüpfte WhatsApp-Chats (Pseudo-Threads).';

alter table public.restaurant_whatsapp_chat_avatars enable row level security;

drop policy if exists restaurant_whatsapp_chat_avatars_staff_all
  on public.restaurant_whatsapp_chat_avatars;
create policy restaurant_whatsapp_chat_avatars_staff_all
  on public.restaurant_whatsapp_chat_avatars for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-contact-avatars',
  'restaurant-contact-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists restaurant_contact_avatars_storage_select
  on storage.objects;
create policy restaurant_contact_avatars_storage_select
  on storage.objects for select
  using (
    bucket_id = 'restaurant-contact-avatars'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists restaurant_contact_avatars_storage_insert
  on storage.objects;
create policy restaurant_contact_avatars_storage_insert
  on storage.objects for insert
  with check (
    bucket_id = 'restaurant-contact-avatars'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists restaurant_contact_avatars_storage_update
  on storage.objects;
create policy restaurant_contact_avatars_storage_update
  on storage.objects for update
  using (
    bucket_id = 'restaurant-contact-avatars'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

drop policy if exists restaurant_contact_avatars_storage_delete
  on storage.objects;
create policy restaurant_contact_avatars_storage_delete
  on storage.objects for delete
  using (
    bucket_id = 'restaurant-contact-avatars'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );
