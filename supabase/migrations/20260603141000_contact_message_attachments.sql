-- Anhänge für Gwada-Kontaktnachrichten (WhatsApp/E-Mail nutzen Proxy-APIs).

create table public.contact_message_attachments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  message_id uuid not null references public.contact_messages (id) on delete cascade,
  kind text not null,
  file_name text not null,
  mime_type text not null,
  byte_size bigint,
  storage_path text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint contact_message_attachments_kind_check check (kind in ('image', 'file')),
  constraint contact_message_attachments_file_name_len check (char_length(file_name) <= 255),
  constraint contact_message_attachments_mime_len check (char_length(mime_type) <= 127)
);

create index contact_message_attachments_message_idx
  on public.contact_message_attachments (message_id);

create index contact_message_attachments_restaurant_idx
  on public.contact_message_attachments (restaurant_id);

alter table public.contact_message_attachments enable row level security;

create policy "contact_message_attachments_staff_all"
  on public.contact_message_attachments for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contact-message-attachments',
  'contact-message-attachments',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy contact_message_attachments_storage_select_staff
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contact-message-attachments'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );

create policy contact_message_attachments_storage_insert_staff
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'contact-message-attachments'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );

create policy contact_message_attachments_storage_delete_staff
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'contact-message-attachments'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );
