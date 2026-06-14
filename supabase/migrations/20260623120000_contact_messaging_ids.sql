-- Messenger/Instagram Sender-IDs pro Kontakt (PSID / IGSID), getrennt pro Plattform.

create table if not exists public.contact_messaging_ids (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  platform text not null,
  external_sender_id text not null,
  label text,
  is_primary boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint contact_messaging_ids_platform_check check (
    platform in ('facebook', 'instagram')
  ),
  constraint contact_messaging_ids_sender_len check (
    char_length(external_sender_id) between 1 and 128
  )
);

create unique index if not exists contact_messaging_ids_restaurant_platform_sender_idx
  on public.contact_messaging_ids (restaurant_id, platform, external_sender_id);

create unique index if not exists contact_messaging_ids_contact_platform_idx
  on public.contact_messaging_ids (contact_id, platform);

create index if not exists contact_messaging_ids_contact_id_idx
  on public.contact_messaging_ids (contact_id);

alter table public.contact_messaging_ids enable row level security;

drop policy if exists "contact_messaging_ids_staff_all" on public.contact_messaging_ids;
create policy "contact_messaging_ids_staff_all"
  on public.contact_messaging_ids for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));
