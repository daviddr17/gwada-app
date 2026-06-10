-- Farbe je Restaurant-Position (Listen, Team-Dropdown, Schichtplan-Bezug).

alter table public.restaurant_positions
  add column if not exists color text not null default '#64748b';

comment on column public.restaurant_positions.color is
  'Hex-Farbe (#RRGGBB) für UI-Balken und Dropdowns.';

create or replace function public.restaurant_position_palette_color(p_key text)
returns text
language sql
immutable
as $$
  select (array[
    '#e11d48', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
    '#14b8a6', '#84cc16', '#f43f5e', '#0ea5e9'
  ])[1 + (abs(hashtext(coalesce(p_key, ''))) % 12)];
$$;

update public.restaurant_positions
set color = public.restaurant_position_palette_color(id::text)
where color = '#64748b';

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

  insert into public.restaurant_positions (restaurant_id, name, slug, is_system, sort_order, color)
  values
    (p_restaurant_id, 'Inhaber', 'owner', true, 10, public.restaurant_position_palette_color('owner')),
    (p_restaurant_id, 'Manager', 'manager', true, 20, public.restaurant_position_palette_color('manager')),
    (p_restaurant_id, 'Gastgeber', 'host', true, 30, public.restaurant_position_palette_color('host')),
    (p_restaurant_id, 'Service', 'server', true, 40, public.restaurant_position_palette_color('server')),
    (p_restaurant_id, 'Küche', 'kitchen', true, 50, public.restaurant_position_palette_color('kitchen')),
    (p_restaurant_id, 'Sonstiges', 'other', true, 60, public.restaurant_position_palette_color('other'))
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
    'integrations.facebook',
    'settings.restaurant', 'settings.opening_hours', 'settings.branding', 'settings.dashboard',
    'documents.notes.edit'
  ] loop
    insert into public.restaurant_position_permissions (position_id, permission_key)
    values (v_owner_id, perm)
    on conflict do nothing;
  end loop;

  foreach perm in array array[
    'roles.manage', 'team.manage', 'integrations.whatsapp', 'integrations.email',
    'integrations.facebook',
    'settings.restaurant', 'settings.opening_hours', 'settings.branding', 'settings.dashboard',
    'documents.notes.edit'
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
