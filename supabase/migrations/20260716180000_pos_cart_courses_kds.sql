-- POS: Gänge, Ohne-Zutaten/Modifier, KDS-Geräte

-- Gang am Bon-Posten
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'pos_order_course'
  ) then
    create type public.pos_order_course as enum (
      'starter',
      'main',
      'dessert',
      'side',
      'drink',
      'other'
    );
  end if;
end $$;

alter table public.pos_order_lines
  add column if not exists course public.pos_order_course not null default 'other';

alter table public.pos_order_lines
  add column if not exists ohne_ingredient_ids text[] not null default '{}';

-- [{ "type":"ohne"|"option"|"text", "label":"…", "ingredientId"?:…, "optionChoiceId"?:…, "priceDeltaCents"?:… }]
alter table public.pos_order_lines
  add column if not exists modifiers jsonb not null default '[]'::jsonb;

comment on column public.pos_order_lines.course is 'Gang: Vorspeise/Hauptgang/Dessert/…';
comment on column public.pos_order_lines.ohne_ingredient_ids is 'Rezept-Zutaten-IDs die weggelassen werden';
comment on column public.pos_order_lines.modifiers is 'Anzeige-Modifier (ohne …, Optionen, Hinweise)';

-- KDS-Geräte (lokaler Abruf über Hub-IP; Cloud speichert Zuordnung/Filter)
create table if not exists public.pos_kds_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  -- Optionaler Geräte-Token (Klartext nur bei Pairing; speichern als Hash)
  token_hash text null,
  -- Filter: leere Arrays = alle
  menu_category_ids uuid[] not null default '{}',
  courses public.pos_order_course[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pos_kds_devices_restaurant_sort_idx
  on public.pos_kds_devices (restaurant_id, sort_order, name);

create trigger pos_kds_devices_set_updated_at
  before update on public.pos_kds_devices
  for each row execute function public.set_updated_at();

alter table public.pos_kds_devices enable row level security;

drop policy if exists "pos_kds_devices_access" on public.pos_kds_devices;
create policy "pos_kds_devices_access"
  on public.pos_kds_devices for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));
