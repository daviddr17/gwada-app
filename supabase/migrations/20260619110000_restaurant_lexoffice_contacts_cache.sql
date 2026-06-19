-- Lexoffice-Kontaktliste pro Restaurant (Listen/Unified Contacts — kein Live-API beim Load).

create table if not exists public.restaurant_lexoffice_contacts_cache (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  contacts jsonb not null default '[]'::jsonb,
  contact_count integer not null default 0,
  synced_at timestamptz not null default timezone('utc', now()),
  sync_error text,
  constraint restaurant_lexoffice_contacts_cache_contacts_is_array
    check (jsonb_typeof(contacts) = 'array')
);

comment on table public.restaurant_lexoffice_contacts_cache is
  'Lexoffice /v1/contacts — serverseitiger Cache, Refresh per Connect/Cron/stale-while-revalidate.';

alter table public.restaurant_lexoffice_contacts_cache enable row level security;

create policy restaurant_lexoffice_contacts_cache_staff_select
  on public.restaurant_lexoffice_contacts_cache for select
  using (public.auth_is_restaurant_staff(restaurant_id));
