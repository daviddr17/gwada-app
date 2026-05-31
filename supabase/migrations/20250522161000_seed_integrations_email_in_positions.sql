-- seed_restaurant_default_positions: integrations.email für neue Restaurants.

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

  foreach perm in array array[
    'roles.manage', 'team.manage', 'integrations.whatsapp', 'integrations.email',
    'settings.restaurant', 'settings.opening_hours', 'settings.branding', 'settings.dashboard'
  ] loop
    insert into public.restaurant_position_permissions (position_id, permission_key)
    values (v_owner_id, perm)
    on conflict do nothing;
  end loop;

  foreach perm in array array[
    'roles.manage', 'team.manage', 'integrations.whatsapp', 'integrations.email',
    'settings.restaurant', 'settings.opening_hours', 'settings.branding', 'settings.dashboard'
  ] loop
    insert into public.restaurant_position_permissions (position_id, permission_key)
    values (v_manager_id, perm)
    on conflict do nothing;
  end loop;

  delete from public.restaurant_position_permissions
  where position_id in (v_host_id, v_server_id, v_kitchen_id, v_other_id);

  update public.restaurant_employees re
  set position_id = rp.id
  from public.restaurant_positions rp
  where re.restaurant_id = p_restaurant_id
    and rp.restaurant_id = p_restaurant_id
    and rp.slug = re.role::text
    and re.position_id is distinct from rp.id;
end;
$$;
