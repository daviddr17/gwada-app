-- Modul-Berechtigungen: CRUD-Schlüssel + auth_has_restaurant_permission mit Legacy-.manage

-- Bestehende *.manage-Grants → vier CRUD-Schlüssel (UI-Toggles)
insert into public.restaurant_position_permissions (position_id, permission_key)
select rpp.position_id, split_part(rpp.permission_key, '.', 1) || '.' || op.op
from public.restaurant_position_permissions rpp
cross join (
  values ('read'), ('create'), ('update'), ('delete')
) as op(op)
where rpp.permission_key in (
  'menu.manage',
  'inventory.manage',
  'reservations.manage',
  'contacts.manage',
  'news.manage',
  'events.manage',
  'reviews.manage',
  'documents.manage',
  'staff.manage',
  'accounting.manage'
)
on conflict do nothing;

create or replace function public.auth_has_restaurant_permission(
  p_restaurant_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_suffix text;
  v_module_prefixes text[] := array[
    'menu', 'inventory', 'reservations', 'contacts', 'news', 'events',
    'reviews', 'documents', 'staff', 'accounting'
  ];
begin
  if p_permission is null or p_permission = '' then
    return false;
  end if;

  -- Inhaber: alle Rechte
  if exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  ) then
    return true;
  end if;

  -- Direkter Treffer
  if exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = p_permission
  ) then
    return true;
  end if;

  v_prefix := split_part(p_permission, '.', 1);
  v_suffix := split_part(p_permission, '.', 2);

  if not (v_prefix = any (v_module_prefixes)) then
    return false;
  end if;

  -- Legacy .manage: mindestens ein CRUD-Recht reicht
  if v_suffix = 'manage' then
    return exists (
      select 1
      from public.restaurant_employees re
      inner join public.restaurant_position_permissions rpp
        on rpp.position_id = re.position_id
      where re.restaurant_id = p_restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.position_id is not null
        and (
          rpp.permission_key = p_permission
          or rpp.permission_key in (
            v_prefix || '.read',
            v_prefix || '.create',
            v_prefix || '.update',
            v_prefix || '.delete'
          )
        )
    );
  end if;

  -- .manage impliziert alle CRUD-Operationen
  if exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = v_prefix || '.manage'
  ) then
    return true;
  end if;

  -- Lesen implizit über Schreib-Rechte
  if v_suffix = 'read' then
    return exists (
      select 1
      from public.restaurant_employees re
      inner join public.restaurant_position_permissions rpp
        on rpp.position_id = re.position_id
      where re.restaurant_id = p_restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.position_id is not null
        and rpp.permission_key in (
          v_prefix || '.create',
          v_prefix || '.update',
          v_prefix || '.delete'
        )
    );
  end if;

  return false;
end;
$$;

comment on function public.auth_has_restaurant_permission(uuid, text) is
  'Position + Inhaber; Legacy .manage ↔ CRUD; Lesen implizit über Schreib-Rechte.';

-- Inhaber-Array: CRUD statt nur .manage für Modul-UI
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
    'integrations.lexoffice',
    'settings.restaurant',
    'settings.opening_hours',
    'settings.branding',
    'settings.dashboard',
    'menu.read', 'menu.create', 'menu.update', 'menu.delete',
    'inventory.read', 'inventory.create', 'inventory.update', 'inventory.delete',
    'reservations.read', 'reservations.create', 'reservations.update', 'reservations.delete',
    'contacts.read', 'contacts.create', 'contacts.update', 'contacts.delete',
    'news.read', 'news.create', 'news.update', 'news.delete',
    'events.read', 'events.create', 'events.update', 'events.delete',
    'reviews.read', 'reviews.create', 'reviews.update', 'reviews.delete',
    'gallery.read',
    'gallery.create',
    'gallery.update',
    'gallery.delete',
    'documents.read', 'documents.create', 'documents.update', 'documents.delete',
    'documents.notes.edit',
    'staff.read', 'staff.create', 'staff.update', 'staff.delete',
    'accounting.read', 'accounting.create', 'accounting.update', 'accounting.delete',
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
