-- Verknüpfung Gwada-Kontakt ↔ Lexware Office Kontakt

create table if not exists public.contact_lexoffice_links (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  lexoffice_contact_id uuid not null,
  lexoffice_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_lexoffice_links_restaurant_contact_unique unique (restaurant_id, contact_id),
  constraint contact_lexoffice_links_restaurant_lexoffice_unique unique (restaurant_id, lexoffice_contact_id)
);

create index if not exists contact_lexoffice_links_restaurant_idx
  on public.contact_lexoffice_links (restaurant_id);

alter table public.contact_lexoffice_links enable row level security;

create policy contact_lexoffice_links_select_staff
  on public.contact_lexoffice_links for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy contact_lexoffice_links_write_staff
  on public.contact_lexoffice_links for all
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create trigger contact_lexoffice_links_set_updated_at
  before update on public.contact_lexoffice_links
  for each row execute function public.set_updated_at();
