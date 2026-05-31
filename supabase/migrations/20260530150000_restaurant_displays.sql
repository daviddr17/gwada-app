-- Restaurant-Displays (Tablets): Geräte-Kopplung, Mitarbeiter-PIN, Sessions.

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.display_module as enum (
    'time',
    'reservations',
    'recipes',
    'kds'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.restaurant_displays (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  allowed_modules public.display_module[] not null default '{}',
  auto_lock_seconds integer not null default 60,
  device_secret_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_displays_name_len check (char_length(name) between 1 and 80),
  constraint restaurant_displays_auto_lock check (auto_lock_seconds between 15 and 3600)
);

create index if not exists restaurant_displays_restaurant_idx
  on public.restaurant_displays (restaurant_id, is_active);

drop trigger if exists restaurant_displays_set_updated_at on public.restaurant_displays;
create trigger restaurant_displays_set_updated_at
  before update on public.restaurant_displays
  for each row execute function public.set_updated_at();

comment on table public.restaurant_displays is
  'Gekoppelte Tablets/Displays pro Restaurant (Geräte-Token nach QR-Kopplung).';

create table if not exists public.restaurant_display_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  display_id uuid not null references public.restaurant_displays (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_display_pairing_codes_code_len check (char_length(code) = 8)
);

create unique index if not exists restaurant_display_pairing_codes_code_idx
  on public.restaurant_display_pairing_codes (code);

create index if not exists restaurant_display_pairing_codes_expires_idx
  on public.restaurant_display_pairing_codes (expires_at);

alter table public.restaurant_staff
  add column if not exists display_pin_hash text,
  add column if not exists display_pin_set_at timestamptz;

comment on column public.restaurant_staff.display_pin_hash is
  'bcrypt-Hash der 4-stelligen Display-PIN (nur Tablet-Login, kein Dashboard).';

create table if not exists public.restaurant_display_sessions (
  id uuid primary key default gen_random_uuid(),
  display_id uuid not null references public.restaurant_displays (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  session_token_hash text not null,
  started_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz
);

create unique index if not exists restaurant_display_sessions_open_display_idx
  on public.restaurant_display_sessions (display_id)
  where ended_at is null;

create index if not exists restaurant_display_sessions_staff_idx
  on public.restaurant_display_sessions (staff_id, started_at desc);

alter table public.restaurant_displays enable row level security;
alter table public.restaurant_display_pairing_codes enable row level security;
alter table public.restaurant_display_sessions enable row level security;

drop policy if exists restaurant_displays_staff_select on public.restaurant_displays;
create policy restaurant_displays_staff_select
  on public.restaurant_displays for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists restaurant_displays_staff_write on public.restaurant_displays;
create policy restaurant_displays_staff_write
  on public.restaurant_displays for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'display.manage')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'display.manage')
  );

drop policy if exists restaurant_display_pairing_codes_staff_all on public.restaurant_display_pairing_codes;
create policy restaurant_display_pairing_codes_staff_all
  on public.restaurant_display_pairing_codes for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_displays d
      where d.id = display_id
        and public.auth_has_restaurant_permission(d.restaurant_id, 'display.manage')
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_displays d
      where d.id = display_id
        and public.auth_has_restaurant_permission(d.restaurant_id, 'display.manage')
    )
  );

drop policy if exists restaurant_display_sessions_staff_select on public.restaurant_display_sessions;
create policy restaurant_display_sessions_staff_select
  on public.restaurant_display_sessions for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Display-Berechtigungen in Positionen
-- ---------------------------------------------------------------------------

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, perm.key
from public.restaurant_positions rp
cross join (
  values
    ('display.manage'),
    ('display.time'),
    ('display.reservations'),
    ('display.recipes'),
    ('display.kds'),
    ('display.module_switch')
) as perm(key)
where rp.slug in ('owner', 'manager')
on conflict do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, perm.key
from public.restaurant_positions rp
cross join (
  values
    ('display.time'),
    ('display.module_switch')
) as perm(key)
where rp.slug in ('host', 'server', 'other')
on conflict do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, perm.key
from public.restaurant_positions rp
cross join (
  values
    ('display.recipes'),
    ('display.kds')
) as perm(key)
where rp.slug = 'kitchen'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

create or replace function public.staff_display_permission_keys(p_staff_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct rpp.permission_key
  from public.restaurant_staff rs
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = rs.restaurant_position_id
  where rs.id = p_staff_id
    and rs.is_active
    and rs.restaurant_position_id is not null
  union
  select unnest(array[
    'display.time',
    'display.reservations',
    'display.recipes',
    'display.kds',
    'display.module_switch'
  ]::text[])
  where exists (
    select 1
    from public.restaurant_staff rs
    inner join public.restaurant_positions rp on rp.id = rs.restaurant_position_id
    where rs.id = p_staff_id
      and rs.is_active
      and rp.slug = 'owner'
  );
$$;

revoke all on function public.staff_display_permission_keys(uuid) from public;
grant execute on function public.staff_display_permission_keys(uuid) to authenticated, service_role;

create or replace function public.verify_restaurant_staff_display_pin(
  p_restaurant_id uuid,
  p_staff_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return false;
  end if;

  select display_pin_hash
    into v_hash
  from public.restaurant_staff
  where id = p_staff_id
    and restaurant_id = p_restaurant_id
    and is_active
  limit 1;

  if v_hash is null or trim(v_hash) = '' then
    return false;
  end if;

  return extensions.crypt(p_pin, v_hash) = v_hash;
end;
$$;

comment on function public.verify_restaurant_staff_display_pin is
  'Prüft 4-stellige Display-PIN für einen Mitarbeiter im Restaurant.';

revoke all on function public.verify_restaurant_staff_display_pin(uuid, uuid, text) from public;
grant execute on function public.verify_restaurant_staff_display_pin(uuid, uuid, text) to service_role;

create or replace function public.set_restaurant_staff_display_pin(
  p_staff_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_other record;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN muss 4-stellig sein';
  end if;

  select restaurant_id into v_restaurant_id
  from public.restaurant_staff
  where id = p_staff_id;

  if v_restaurant_id is null then
    return false;
  end if;

  for v_other in
    select id, display_pin_hash
    from public.restaurant_staff
    where restaurant_id = v_restaurant_id
      and id <> p_staff_id
      and is_active
      and display_pin_hash is not null
  loop
    if extensions.crypt(p_pin, v_other.display_pin_hash) = v_other.display_pin_hash then
      raise exception 'Diese PIN wird bereits von einem anderen Mitarbeiter verwendet';
    end if;
  end loop;

  update public.restaurant_staff
  set
    display_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
    display_pin_set_at = timezone('utc', now())
  where id = p_staff_id;

  return true;
end;
$$;

comment on function public.set_restaurant_staff_display_pin is
  'Setzt gehashte 4-stellige Display-PIN; eindeutig pro Restaurant.';

revoke all on function public.set_restaurant_staff_display_pin(uuid, text) from public;
grant execute on function public.set_restaurant_staff_display_pin(uuid, text) to service_role;

create or replace function public.clear_restaurant_staff_display_pin(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.restaurant_staff
  set display_pin_hash = null, display_pin_set_at = null
  where id = p_staff_id;
end;
$$;

revoke all on function public.clear_restaurant_staff_display_pin(uuid) from public;
grant execute on function public.clear_restaurant_staff_display_pin(uuid) to service_role;

-- Owner-Permissions-Array aktualisieren
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
    'display.reservations',
    'display.recipes',
    'display.kds',
    'display.module_switch'
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
