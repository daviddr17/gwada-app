-- Anfrage-Pakete (Buffet / Getränke / Extra) für den Veranstaltungs-Kalkulator.

create table if not exists public.event_packages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind text not null
    check (kind in ('buffet', 'drinks', 'extra')),
  name text not null,
  description text not null default '',
  price_per_person numeric(12, 2) not null
    check (price_per_person >= 0 and price_per_person <= 9999.99),
  tax_rate_percent numeric(5, 2) not null default 19
    check (tax_rate_percent >= 0 and tax_rate_percent <= 100),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_packages_name_len check (char_length(trim(name)) between 1 and 120),
  constraint event_packages_description_len check (char_length(description) <= 500)
);

comment on table public.event_packages is
  'Pro-Person-Pakete für Veranstaltungs-Anfragen (Buffet, Getränke, Extra). Öffentlich nur active; Angebot entsteht serverseitig als Gwada-Entwurf.';

create index if not exists event_packages_restaurant_kind_idx
  on public.event_packages (restaurant_id, kind, sort_order, name);

create index if not exists event_packages_restaurant_active_idx
  on public.event_packages (restaurant_id)
  where active;

create trigger event_packages_set_updated_at
  before update on public.event_packages
  for each row execute function public.set_updated_at();

alter table public.event_packages enable row level security;

create policy event_packages_staff_select
  on public.event_packages for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy event_packages_staff_write
  on public.event_packages for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'));
