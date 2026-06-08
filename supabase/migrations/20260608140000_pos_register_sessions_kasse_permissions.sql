-- Kassensitzungen (Anfangs-/Endbestand) + Berechtigungen pos.kasse.*

create table public.pos_register_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  opening_cash_cents bigint not null default 0 check (opening_cash_cents >= 0),
  closing_cash_cents bigint check (closing_cash_cents is null or closing_cash_cents >= 0),
  expected_cash_cents bigint check (expected_cash_cents is null or expected_cash_cents >= 0),
  cash_difference_cents bigint,
  opened_by_profile_id uuid references public.profiles (id) on delete set null,
  closed_by_profile_id uuid references public.profiles (id) on delete set null,
  z_nr integer,
  cash_point_closing_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index pos_register_sessions_one_open_per_restaurant_idx
  on public.pos_register_sessions (restaurant_id)
  where closed_at is null;

create index pos_register_sessions_restaurant_closed_idx
  on public.pos_register_sessions (restaurant_id, closed_at desc nulls first);

create trigger pos_register_sessions_set_updated_at
  before update on public.pos_register_sessions
  for each row execute function public.set_updated_at();

alter table public.pos_register_sessions enable row level security;

create policy pos_register_sessions_staff_select
  on public.pos_register_sessions for select
  using (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_register_sessions is
  'Kassensitzung pro Restaurant: Anfangs-/Endbestand, Z-Bon-Referenz.';

alter table public.pos_restaurant_fiscal_config
  add column if not exists current_register_session_id uuid
    references public.pos_register_sessions (id) on delete set null;

comment on column public.pos_restaurant_fiscal_config.current_register_session_id is
  'Aktive Kassensitzung; register_opened_at bleibt Denormalisierung.';

-- Berechtigungen für Kasse (Inhaber + Manager)
insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, perm.key
from public.restaurant_positions rp
cross join (
  values
    ('pos.kasse.manage'),
    ('pos.kasse.export')
) as perm(key)
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create or replace function public.auth_user_restaurant_permission_keys(p_restaurant_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct rpp.permission_key
  from public.restaurant_employees re
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = re.position_id
  where re.restaurant_id = p_restaurant_id
    and re.profile_id = (select auth.uid())
    and re.is_active
    and re.position_id is not null
  union
  select unnest(array[
    'roles.manage',
    'team.manage',
    'integrations.whatsapp',
    'integrations.email',
    'integrations.facebook',
    'integrations.instagram',
    'integrations.google_business',
    'settings.restaurant',
    'settings.opening_hours',
    'settings.branding',
    'settings.dashboard',
    'documents.notes.edit',
    'display.manage',
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.inventory',
    'display.kds',
    'display.module_switch',
    'pos.kasse.manage',
    'pos.kasse.export'
  ]::text[])
  where exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  );
$$;
