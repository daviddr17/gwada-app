-- Mandanten-Positionen mit feingranularen Berechtigungen (ersetzt schrittweise festes employee_role-Enum).

create table if not exists public.restaurant_positions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, slug)
);

create trigger restaurant_positions_set_updated_at
  before update on public.restaurant_positions
  for each row execute function public.set_updated_at();

create index if not exists restaurant_positions_restaurant_id_idx
  on public.restaurant_positions (restaurant_id, sort_order);

create table if not exists public.restaurant_position_permissions (
  position_id uuid not null references public.restaurant_positions (id) on delete cascade,
  permission_key text not null,
  primary key (position_id, permission_key)
);

alter table public.restaurant_employees
  add column if not exists position_id uuid references public.restaurant_positions (id) on delete set null;

create index if not exists restaurant_employees_position_id_idx
  on public.restaurant_employees (position_id);

comment on table public.restaurant_positions is
  'Restaurant-interne Rollen/Positionen (vom Manager anlegbar).';
comment on table public.restaurant_position_permissions is
  'Berechtigungen je Position (z. B. integrations.whatsapp).';

-- Standard-Positionen für ein Restaurant
create or replace function public.seed_restaurant_default_positions(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_manager_id uuid;
  v_host_id uuid;
  v_server_id uuid;
  v_kitchen_id uuid;
  v_other_id uuid;
  perm text;
begin
  if p_restaurant_id is null then
    return;
  end if;

  insert into public.restaurant_positions (restaurant_id, name, slug, is_system, sort_order)
  values
    (p_restaurant_id, 'Inhaber', 'owner', true, 10),
    (p_restaurant_id, 'Manager', 'manager', true, 20),
    (p_restaurant_id, 'Gastgeber', 'host', true, 30),
    (p_restaurant_id, 'Service', 'server', true, 40),
    (p_restaurant_id, 'Küche', 'kitchen', true, 50),
    (p_restaurant_id, 'Sonstiges', 'other', true, 60)
  on conflict (restaurant_id, slug) do update
    set name = excluded.name;

  select id into v_owner_id from public.restaurant_positions
    where restaurant_id = p_restaurant_id and slug = 'owner';
  select id into v_manager_id from public.restaurant_positions
    where restaurant_id = p_restaurant_id and slug = 'manager';
  select id into v_host_id from public.restaurant_positions
    where restaurant_id = p_restaurant_id and slug = 'host';
  select id into v_server_id from public.restaurant_positions
    where restaurant_id = p_restaurant_id and slug = 'server';
  select id into v_kitchen_id from public.restaurant_positions
    where restaurant_id = p_restaurant_id and slug = 'kitchen';
  select id into v_other_id from public.restaurant_positions
    where restaurant_id = p_restaurant_id and slug = 'other';

  -- Inhaber: alles
  foreach perm in array array[
    'roles.manage', 'team.manage', 'integrations.whatsapp',
    'settings.restaurant', 'settings.opening_hours', 'settings.branding', 'settings.dashboard'
  ] loop
    insert into public.restaurant_position_permissions (position_id, permission_key)
    values (v_owner_id, perm)
    on conflict do nothing;
  end loop;

  -- Manager: Verwaltung + Integrationen + Einstellungen
  foreach perm in array array[
    'roles.manage', 'team.manage', 'integrations.whatsapp',
    'settings.restaurant', 'settings.opening_hours', 'settings.branding', 'settings.dashboard'
  ] loop
    insert into public.restaurant_position_permissions (position_id, permission_key)
    values (v_manager_id, perm)
    on conflict do nothing;
  end loop;

  -- Übrige: keine Admin-Rechte (können per UI erweitert werden)
  delete from public.restaurant_position_permissions
  where position_id in (v_host_id, v_server_id, v_kitchen_id, v_other_id);

  -- Bestehende Mitarbeitende an Positionen koppeln
  update public.restaurant_employees re
  set position_id = rp.id
  from public.restaurant_positions rp
  where re.restaurant_id = p_restaurant_id
    and rp.restaurant_id = p_restaurant_id
    and rp.slug = re.role::text
    and re.position_id is distinct from rp.id;
end;
$$;

revoke all on function public.seed_restaurant_default_positions(uuid) from public;
grant execute on function public.seed_restaurant_default_positions(uuid) to authenticated, service_role;

-- Alle bestehenden Restaurants
do $$
declare
  r record;
begin
  for r in select id from public.restaurants loop
    perform public.seed_restaurant_default_positions(r.id);
  end loop;
end;
$$;

create or replace function public.auth_has_restaurant_permission(
  p_restaurant_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = p_permission
  )
  or exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
      and p_permission is not null
  );
$$;

comment on function public.auth_has_restaurant_permission(uuid, text) is
  'Prüft Berechtigung über zugewiesene Position; Inhaber-Position hat implizit alle Rechte.';

revoke all on function public.auth_has_restaurant_permission(uuid, text) from public;
grant execute on function public.auth_has_restaurant_permission(uuid, text) to authenticated, service_role;

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
    'roles.manage', 'team.manage', 'integrations.whatsapp',
    'settings.restaurant', 'settings.opening_hours', 'settings.branding', 'settings.dashboard'
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

revoke all on function public.auth_user_restaurant_permission_keys(uuid) from public;
grant execute on function public.auth_user_restaurant_permission_keys(uuid) to authenticated, service_role;

-- RLS
alter table public.restaurant_positions enable row level security;
alter table public.restaurant_position_permissions enable row level security;

create policy restaurant_positions_select_staff
  on public.restaurant_positions for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_positions_write_roles
  on public.restaurant_positions for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'roles.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'roles.manage'));

create policy restaurant_position_permissions_select_staff
  on public.restaurant_position_permissions for select
  to authenticated
  using (
    exists (
      select 1 from public.restaurant_positions rp
      where rp.id = position_id
        and public.auth_is_restaurant_staff(rp.restaurant_id)
    )
  );

create policy restaurant_position_permissions_write_roles
  on public.restaurant_position_permissions for all
  to authenticated
  using (
    exists (
      select 1 from public.restaurant_positions rp
      where rp.id = position_id
        and public.auth_has_restaurant_permission(rp.restaurant_id, 'roles.manage')
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_positions rp
      where rp.id = position_id
        and public.auth_has_restaurant_permission(rp.restaurant_id, 'roles.manage')
    )
  );

-- WhatsApp-Integration: Berechtigung statt nur owner/manager
drop policy if exists restaurant_integrations_write_managers on public.restaurant_integrations;

create policy restaurant_integrations_write_whatsapp
  on public.restaurant_integrations for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'integrations.whatsapp')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'integrations.whatsapp')
  );
