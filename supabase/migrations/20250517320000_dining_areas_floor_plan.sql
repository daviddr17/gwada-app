-- Bereiche (Areas), Tischplan-Koordinaten, Reservierungs-Einstellungen, optionale Verweildauer pro Reservierung.
-- dining_tables: label entfällt zugunsten von area_id, table_number, table_name (optional), Plan-Position.

-- ---------------------------------------------------------------------------
-- Bereiche
-- ---------------------------------------------------------------------------
create table public.dining_areas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index dining_areas_restaurant_name_lower_idx
  on public.dining_areas (restaurant_id, lower(name));

create trigger dining_areas_set_updated_at
  before update on public.dining_areas
  for each row execute function public.set_updated_at();

alter table public.dining_areas enable row level security;

create policy "dining_areas_staff_all"
  on public.dining_areas for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Reservierungs-Einstellungen pro Restaurant
-- ---------------------------------------------------------------------------
create table public.restaurant_reservation_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  default_dwell_minutes integer not null default 120
    check (default_dwell_minutes >= 15 and default_dwell_minutes <= 1440),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger restaurant_reservation_settings_set_updated_at
  before update on public.restaurant_reservation_settings
  for each row execute function public.set_updated_at();

alter table public.restaurant_reservation_settings enable row level security;

create policy "restaurant_reservation_settings_staff_all"
  on public.restaurant_reservation_settings for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- dining_tables erweitern / label entfernen
-- ---------------------------------------------------------------------------
alter table public.dining_tables
  add column if not exists area_id uuid references public.dining_areas (id) on delete restrict,
  add column if not exists table_number integer,
  add column if not exists table_name text,
  add column if not exists plan_x_pct numeric(7, 4) not null default 12
    check (plan_x_pct >= 0 and plan_x_pct <= 100),
  add column if not exists plan_y_pct numeric(7, 4) not null default 12
    check (plan_y_pct >= 0 and plan_y_pct <= 100);

insert into public.dining_areas (restaurant_id, name, sort_order)
select distinct dt.restaurant_id, 'Innenraum', 0
from public.dining_tables dt
where not exists (
    select 1 from public.dining_areas a
    where a.restaurant_id = dt.restaurant_id
  );

update public.dining_tables dt
set
  area_id = coalesce(
    dt.area_id,
    (
      select a.id
      from public.dining_areas a
      where a.restaurant_id = dt.restaurant_id
      order by a.sort_order asc, a.created_at asc
      limit 1
    )
  ),
  table_number = coalesce(dt.table_number, sq.rn),
  table_name = coalesce(dt.table_name, null)
from (
  select
    id,
    row_number() over (
      partition by restaurant_id
      order by sort_order nulls last, created_at asc, id asc
    ) as rn
  from public.dining_tables
) sq
where dt.id = sq.id;

alter table public.dining_tables
  alter column area_id set not null,
  alter column table_number set not null;

alter table public.dining_tables
  drop constraint if exists dining_tables_restaurant_id_label_key;

alter table public.dining_tables
  add constraint dining_tables_restaurant_area_number_key
    unique (restaurant_id, area_id, table_number);

alter table public.dining_tables
  drop column if exists label;

comment on column public.dining_tables.table_name is
  'Optionaler Tischname; leer → Anzeige nur table_number.';
comment on column public.dining_tables.plan_x_pct is
  'Horizontale Position auf dem Tischplan (0–100 %).';
comment on column public.dining_tables.plan_y_pct is
  'Vertikale Position auf dem Tischplan (0–100 %).';

-- ---------------------------------------------------------------------------
-- Reservierungen: optionale Verweildauer (Minuten)
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists dwell_minutes integer
    check (dwell_minutes is null or (dwell_minutes >= 15 and dwell_minutes <= 1440));

comment on column public.reservations.dwell_minutes is
  'Optional: Verweildauer in Minuten; sonst restaurant_reservation_settings.default_dwell_minutes.';
