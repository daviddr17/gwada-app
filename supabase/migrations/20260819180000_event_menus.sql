-- Vorgeschlagene Veranstaltungs-Menüs (Gänge, Gerichte, Optionen) für den Anfrage-Kalkulator.

create table if not exists public.event_menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  description text not null default '',
  price_per_person numeric(12, 2) not null
    check (price_per_person >= 0 and price_per_person <= 9999.99),
  kids_price_per_person numeric(12, 2)
    check (
      kids_price_per_person is null
      or (kids_price_per_person >= 0 and kids_price_per_person <= 9999.99)
    ),
  tax_rate_percent numeric(5, 2) not null default 19
    check (tax_rate_percent >= 0 and tax_rate_percent <= 100),
  min_party_size integer not null default 1
    check (min_party_size >= 1 and min_party_size <= 200),
  max_party_size integer
    check (
      max_party_size is null
      or (max_party_size >= 1 and max_party_size <= 200)
    ),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_menus_name_len check (char_length(trim(name)) between 1 and 120),
  constraint event_menus_description_len check (char_length(description) <= 800),
  constraint event_menus_party_range check (
    max_party_size is null or max_party_size >= min_party_size
  )
);

comment on table public.event_menus is
  'Vorgeschlagene Menüs für Veranstaltungs-Anfragen. Gäste wählen Gänge/Gerichte; Angebot entsteht serverseitig als Gwada-Entwurf.';

create index if not exists event_menus_restaurant_active_idx
  on public.event_menus (restaurant_id, sort_order, name)
  where active;

create index if not exists event_menus_restaurant_idx
  on public.event_menus (restaurant_id, sort_order, name);

create trigger event_menus_set_updated_at
  before update on public.event_menus
  for each row execute function public.set_updated_at();

create table if not exists public.event_menu_courses (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.event_menus (id) on delete cascade,
  name text not null,
  selection_mode text not null default 'split'
    check (selection_mode in ('fixed', 'split')),
  required boolean not null default true,
  sort_order integer not null default 0,
  constraint event_menu_courses_name_len check (char_length(trim(name)) between 1 and 80)
);

comment on table public.event_menu_courses is
  'Gänge eines Veranstaltungs-Menüs. fixed = für alle inklusive; split = Personen auf Gerichte verteilen.';

create index if not exists event_menu_courses_menu_idx
  on public.event_menu_courses (menu_id, sort_order);

create table if not exists public.event_menu_course_options (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.event_menu_courses (id) on delete cascade,
  name text not null,
  description text not null default '',
  extra_price_per_person numeric(12, 2) not null default 0
    check (extra_price_per_person >= 0 and extra_price_per_person <= 9999.99),
  diets text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  constraint event_menu_course_options_name_len check (char_length(trim(name)) between 1 and 120),
  constraint event_menu_course_options_description_len check (char_length(description) <= 400),
  constraint event_menu_course_options_diets_ok check (
    diets <@ array[
      'vegetarian',
      'vegan',
      'gluten_free',
      'lactose_free',
      'no_pork',
      'kids'
    ]::text[]
  )
);

comment on table public.event_menu_course_options is
  'Gericht-Optionen eines Gangs (inkl. Aufpreis und Diät-Kennzeichnung).';

create index if not exists event_menu_course_options_course_idx
  on public.event_menu_course_options (course_id, sort_order);

create table if not exists public.event_menu_addons (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.event_menus (id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null
    check (price >= 0 and price <= 9999.99),
  billing text not null default 'per_person'
    check (billing in ('per_person', 'flat')),
  exclude_kids boolean not null default false,
  sort_order integer not null default 0,
  constraint event_menu_addons_name_len check (char_length(trim(name)) between 1 and 120),
  constraint event_menu_addons_description_len check (char_length(description) <= 400)
);

comment on table public.event_menu_addons is
  'Optionale Aufpreise zum Menü (Weinbegleitung, Käse, Raum …). per_person oder Pauschale.';

create index if not exists event_menu_addons_menu_idx
  on public.event_menu_addons (menu_id, sort_order);

alter table public.event_menus enable row level security;
alter table public.event_menu_courses enable row level security;
alter table public.event_menu_course_options enable row level security;
alter table public.event_menu_addons enable row level security;

create policy event_menus_staff_select
  on public.event_menus for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy event_menus_staff_write
  on public.event_menus for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'events.manage'));

create policy event_menu_courses_staff_select
  on public.event_menu_courses for select
  to authenticated
  using (
    exists (
      select 1 from public.event_menus m
      where m.id = event_menu_courses.menu_id
        and public.auth_is_restaurant_staff(m.restaurant_id)
    )
  );

create policy event_menu_courses_staff_write
  on public.event_menu_courses for all
  to authenticated
  using (
    exists (
      select 1 from public.event_menus m
      where m.id = event_menu_courses.menu_id
        and public.auth_has_restaurant_permission(m.restaurant_id, 'events.manage')
    )
  )
  with check (
    exists (
      select 1 from public.event_menus m
      where m.id = event_menu_courses.menu_id
        and public.auth_has_restaurant_permission(m.restaurant_id, 'events.manage')
    )
  );

create policy event_menu_course_options_staff_select
  on public.event_menu_course_options for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_menu_courses c
      join public.event_menus m on m.id = c.menu_id
      where c.id = event_menu_course_options.course_id
        and public.auth_is_restaurant_staff(m.restaurant_id)
    )
  );

create policy event_menu_course_options_staff_write
  on public.event_menu_course_options for all
  to authenticated
  using (
    exists (
      select 1
      from public.event_menu_courses c
      join public.event_menus m on m.id = c.menu_id
      where c.id = event_menu_course_options.course_id
        and public.auth_has_restaurant_permission(m.restaurant_id, 'events.manage')
    )
  )
  with check (
    exists (
      select 1
      from public.event_menu_courses c
      join public.event_menus m on m.id = c.menu_id
      where c.id = event_menu_course_options.course_id
        and public.auth_has_restaurant_permission(m.restaurant_id, 'events.manage')
    )
  );

create policy event_menu_addons_staff_select
  on public.event_menu_addons for select
  to authenticated
  using (
    exists (
      select 1 from public.event_menus m
      where m.id = event_menu_addons.menu_id
        and public.auth_is_restaurant_staff(m.restaurant_id)
    )
  );

create policy event_menu_addons_staff_write
  on public.event_menu_addons for all
  to authenticated
  using (
    exists (
      select 1 from public.event_menus m
      where m.id = event_menu_addons.menu_id
        and public.auth_has_restaurant_permission(m.restaurant_id, 'events.manage')
    )
  )
  with check (
    exists (
      select 1 from public.event_menus m
      where m.id = event_menu_addons.menu_id
        and public.auth_has_restaurant_permission(m.restaurant_id, 'events.manage')
    )
  );
