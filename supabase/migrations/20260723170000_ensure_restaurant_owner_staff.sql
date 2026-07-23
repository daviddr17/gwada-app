-- Inhaber (restaurant_employees.role = owner) auch als restaurant_staff anlegen,
-- damit sie in Mitarbeiterliste und Schichtplan erscheinen und zuordenbar sind.

create or replace function public.ensure_restaurant_owner_staff(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_position_id uuid;
  v_emp record;
  v_staff_id uuid;
  v_given text;
  v_family text;
  v_display text;
  v_email text;
  v_phone text;
begin
  if p_restaurant_id is null then
    return;
  end if;

  select rp.id
  into v_owner_position_id
  from public.restaurant_positions rp
  where rp.restaurant_id = p_restaurant_id
    and rp.slug = 'owner'
  limit 1;

  -- Position fehlt (Seed noch nicht gelaufen): minimal anlegen
  if v_owner_position_id is null then
    insert into public.restaurant_positions (
      restaurant_id, name, slug, is_system, sort_order, color
    ) values (
      p_restaurant_id,
      'Inhaber',
      'owner',
      true,
      10,
      public.restaurant_position_palette_color('owner')
    )
    on conflict (restaurant_id, slug) do update
      set name = excluded.name
    returning id into v_owner_position_id;

    if v_owner_position_id is null then
      select rp.id
      into v_owner_position_id
      from public.restaurant_positions rp
      where rp.restaurant_id = p_restaurant_id
        and rp.slug = 'owner'
      limit 1;
    end if;
  end if;

  if v_owner_position_id is null then
    return;
  end if;

  for v_emp in
    select re.id as employee_id, re.profile_id, re.staff_id, re.is_active
    from public.restaurant_employees re
    where re.restaurant_id = p_restaurant_id
      and re.role = 'owner'
      and re.is_active = true
  loop
    v_staff_id := null;

    if v_emp.staff_id is not null then
      select s.id
      into v_staff_id
      from public.restaurant_staff s
      where s.id = v_emp.staff_id
        and s.restaurant_id = p_restaurant_id
      limit 1;
    end if;

    if v_staff_id is null and v_emp.profile_id is not null then
      select s.id
      into v_staff_id
      from public.restaurant_staff s
      where s.restaurant_id = p_restaurant_id
        and s.profile_id = v_emp.profile_id
        and (s.employee_id is null or s.employee_id = v_emp.employee_id)
        and not exists (
          select 1
          from public.restaurant_employees re2
          where re2.staff_id = s.id
            and re2.id <> v_emp.employee_id
        )
      order by s.created_at asc
      limit 1;
    end if;

    select
      nullif(trim(coalesce(p.given_name, '')), ''),
      nullif(trim(coalesce(p.family_name, '')), ''),
      nullif(trim(coalesce(p.display_name, '')), ''),
      nullif(trim(coalesce(p.phone, '')), ''),
      nullif(trim(coalesce(p.notification_email, u.email, '')), '')
    into v_given, v_family, v_display, v_phone, v_email
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.id = v_emp.profile_id;

    if v_given is null and v_display is not null then
      v_given := split_part(v_display, ' ', 1);
      if v_family is null and position(' ' in v_display) > 0 then
        v_family := nullif(trim(substr(v_display, position(' ' in v_display) + 1)), '');
      end if;
    end if;

    if v_given is null then
      v_given := coalesce(
        nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
        'Inhaber'
      );
    end if;

    -- Pflichtfeld; „—“ wenn kein Nachname bekannt (Rolle zeigt „Inhaber“)
    if v_family is null then
      v_family := '—';
    end if;

    if v_staff_id is null then
      insert into public.restaurant_staff (
        restaurant_id,
        profile_id,
        employee_id,
        restaurant_position_id,
        given_name,
        family_name,
        email,
        phone,
        is_active
      ) values (
        p_restaurant_id,
        v_emp.profile_id,
        v_emp.employee_id,
        v_owner_position_id,
        v_given,
        v_family,
        v_email,
        v_phone,
        true
      )
      returning id into v_staff_id;
    else
      update public.restaurant_staff
      set
        profile_id = coalesce(profile_id, v_emp.profile_id),
        employee_id = coalesce(employee_id, v_emp.employee_id),
        restaurant_position_id = coalesce(restaurant_position_id, v_owner_position_id),
        is_active = true,
        email = coalesce(nullif(trim(email), ''), v_email),
        phone = coalesce(nullif(trim(phone), ''), v_phone),
        given_name = case
          when nullif(trim(given_name), '') is null then v_given
          else given_name
        end,
        family_name = case
          when nullif(trim(family_name), '') is null then v_family
          else family_name
        end
      where id = v_staff_id;
    end if;

    update public.restaurant_employees
    set
      staff_id = v_staff_id,
      position_id = coalesce(position_id, v_owner_position_id)
    where id = v_emp.employee_id
      and (
        staff_id is distinct from v_staff_id
        or position_id is null
      );
  end loop;
end;
$$;

comment on function public.ensure_restaurant_owner_staff(uuid) is
  'Leger aktive Inhaber als restaurant_staff an und verknüpft employee ↔ staff (Schichtplan/Mitarbeiterliste).';

revoke all on function public.ensure_restaurant_owner_staff(uuid) from public;
grant execute on function public.ensure_restaurant_owner_staff(uuid) to authenticated;
grant execute on function public.ensure_restaurant_owner_staff(uuid) to service_role;

-- Seed: nach Positionen auch Inhaber-Mitarbeiter anlegen
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

  perform public.ensure_restaurant_owner_staff(p_restaurant_id);
end;
$$;

-- Bestehende Restaurants: nur Owner-Staff nachziehen (kein volles Seed → keine Rechte-Löschung)
do $$
declare
  r record;
begin
  for r in
    select distinct restaurant_id
    from public.restaurant_employees
    where role = 'owner'
      and is_active = true
  loop
    perform public.ensure_restaurant_owner_staff(r.restaurant_id);
  end loop;
end;
$$;
