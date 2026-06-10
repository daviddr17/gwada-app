-- Beschäftigungsverhältnisse pro Restaurant (konfigurierbar wie Bestand-Stammdaten)

create table public.restaurant_staff_employment_types (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  legacy_key text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_employment_types_name_len check (
    char_length(name) between 1 and 120
  )
);

create unique index restaurant_staff_employment_types_restaurant_legacy_key_idx
  on public.restaurant_staff_employment_types (restaurant_id, legacy_key)
  where legacy_key is not null;

create index restaurant_staff_employment_types_restaurant_sort_idx
  on public.restaurant_staff_employment_types (restaurant_id, sort_order, name);

create trigger restaurant_staff_employment_types_set_updated_at
  before update on public.restaurant_staff_employment_types
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_employment_types enable row level security;

create policy restaurant_staff_employment_types_staff_all
  on public.restaurant_staff_employment_types for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_staff_employment_types is
  'Konfigurierbare Beschäftigungsverhältnisse für Mitarbeiterverträge.';

create or replace function public.seed_restaurant_default_employment_types(
  p_restaurant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.restaurant_staff_employment_types
    where restaurant_id = p_restaurant_id
  ) then
    return;
  end if;

  insert into public.restaurant_staff_employment_types (
    restaurant_id,
    name,
    legacy_key,
    sort_order
  )
  values
    (p_restaurant_id, 'Vollzeit', 'full_time', 0),
    (p_restaurant_id, 'Teilzeit', 'part_time', 1),
    (p_restaurant_id, 'Minijob', 'mini_job', 2),
    (p_restaurant_id, 'Befristet', 'fixed_term', 3),
    (p_restaurant_id, 'Praktikum', 'internship', 4),
    (p_restaurant_id, 'Werkstudent', 'student', 5),
    (p_restaurant_id, 'Sonstiges', 'other', 6);
end;
$$;

revoke all on function public.seed_restaurant_default_employment_types(uuid) from public;
grant execute on function public.seed_restaurant_default_employment_types(uuid) to authenticated, service_role;

select public.seed_restaurant_default_employment_types(r.id)
from public.restaurants r;

alter table public.restaurant_staff_contracts
  add column if not exists employment_type_id uuid references public.restaurant_staff_employment_types (id) on delete set null;

update public.restaurant_staff_contracts c
set employment_type_id = et.id
from public.restaurant_staff_employment_types et
where c.employment_type is not null
  and et.restaurant_id = c.restaurant_id
  and et.legacy_key = c.employment_type::text
  and c.employment_type_id is null;

alter table public.restaurant_staff_contracts
  drop column if exists employment_type;

drop type if exists public.staff_employment_type;

comment on column public.restaurant_staff_contracts.employment_type_id is
  'Art des Beschäftigungsverhältnisses (Restaurant-Stammdaten).';
