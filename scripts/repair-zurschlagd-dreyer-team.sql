-- Idempotent: Petra + Daniel Dreyer bei zurschlagd ins Team.
-- Fall A: profile_id gesetzt, aber keine restaurant_employees-Zeile.
-- Fall B: profile_id fehlt — Auth-Nutzer per E-Mail/Telefon zuordnen und verknüpfen.

create or replace function public._repair_zurschlagd_staff_team_row(
  p_staff_id uuid,
  p_profile_id uuid,
  p_position_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
  v_emp_id uuid;
begin
  select *
  into v_staff
  from public.restaurant_staff
  where id = p_staff_id;

  if not found or p_profile_id is null or p_position_id is null then
    return null;
  end if;

  select re.id
  into v_emp_id
  from public.restaurant_employees re
  where re.restaurant_id = v_staff.restaurant_id
    and re.profile_id = p_profile_id
  limit 1;

  if v_emp_id is not null then
    update public.restaurant_employees
    set
      staff_id = v_staff.id,
      position_id = p_position_id,
      is_active = true
    where id = v_emp_id;
  else
    insert into public.restaurant_employees (
      restaurant_id,
      profile_id,
      staff_id,
      position_id,
      role,
      is_active
    )
    select
      v_staff.restaurant_id,
      p_profile_id,
      v_staff.id,
      p_position_id,
      case
        when rp.slug in (
          'owner', 'manager', 'host', 'server', 'kitchen', 'other'
        ) then rp.slug::public.employee_role
        else 'other'::public.employee_role
      end,
      true
    from public.restaurant_positions rp
    where rp.id = p_position_id
    returning id into v_emp_id;
  end if;

  if v_emp_id is null then
    return null;
  end if;

  update public.restaurant_staff
  set
    profile_id = p_profile_id,
    employee_id = v_emp_id,
    restaurant_position_id = p_position_id
  where id = v_staff.id;

  insert into public.profiles (id, given_name, family_name, locale)
  values (
    p_profile_id,
    v_staff.given_name,
    v_staff.family_name,
    'de-DE'
  )
  on conflict (id) do update
  set
    given_name = coalesce(public.profiles.given_name, excluded.given_name),
    family_name = coalesce(public.profiles.family_name, excluded.family_name),
    updated_at = timezone('utc', now());

  update public.profiles
  set
    active_restaurant_id = coalesce(active_restaurant_id, v_staff.restaurant_id),
    updated_at = timezone('utc', now())
  where id = p_profile_id
    and active_restaurant_id is null;

  update public.restaurant_staff_invites
  set
    status = 'accepted',
    accepted_at = coalesce(accepted_at, timezone('utc', now())),
    accepted_by = coalesce(accepted_by, p_profile_id)
  where staff_id = v_staff.id
    and status = 'pending';

  return v_emp_id;
end;
$$;

do $$
declare
  v_rid uuid;
  v_repaired int := 0;
  v_row record;
  v_profile_id uuid;
  v_emp_id uuid;
  v_position_id uuid;
  v_staff_phone text;
  v_staff_email text;
begin
  select id into v_rid
  from public.restaurants
  where slug = 'zurschlagd'
  limit 1;

  if v_rid is null then
    raise notice 'repair-zurschlagd: restaurant zurschlagd nicht gefunden';
    return;
  end if;

  for v_row in
    select
      rs.id as staff_id,
      rs.restaurant_id,
      rs.profile_id,
      rs.email,
      rs.phone,
      rs.given_name,
      rs.family_name,
      coalesce(
        rs.restaurant_position_id,
        (
          select rp.id
          from public.restaurant_positions rp
          where rp.restaurant_id = rs.restaurant_id
            and rp.slug = 'other'
          limit 1
        )
      ) as position_id
    from public.restaurant_staff rs
    where rs.restaurant_id = v_rid
      and (
        (rs.given_name ilike 'Petra' and rs.family_name ilike 'Dreyer')
        or (rs.given_name ilike 'Daniel' and rs.family_name ilike 'Dreyer')
      )
      and not exists (
        select 1
        from public.restaurant_employees re
        where re.restaurant_id = rs.restaurant_id
          and (
            (rs.profile_id is not null and re.profile_id = rs.profile_id)
            or re.staff_id = rs.id
          )
          and re.is_active = true
      )
  loop
    v_position_id := v_row.position_id;
    v_profile_id := v_row.profile_id;
    v_staff_email := lower(trim(coalesce(v_row.email, '')));
    v_staff_phone := public.normalize_phone_digits(v_row.phone);

    if v_profile_id is null then
      if v_staff_email <> '' then
        select u.id
        into v_profile_id
        from auth.users u
        where lower(trim(coalesce(u.email, ''))) = v_staff_email
        order by u.created_at desc
        limit 1;
      end if;

      if v_profile_id is null and v_staff_phone is not null then
        select u.id
        into v_profile_id
        from auth.users u
        where public.normalize_phone_digits(u.phone) = v_staff_phone
        order by u.created_at desc
        limit 1;
      end if;

      if v_profile_id is null and v_staff_phone is not null then
        select p.id
        into v_profile_id
        from public.profiles p
        where public.normalize_phone_digits(p.phone) = v_staff_phone
        order by p.created_at desc
        limit 1;
      end if;

      if v_profile_id is null and v_staff_email <> '' then
        select p.id
        into v_profile_id
        from public.profiles p
        inner join auth.users u on u.id = p.id
        where lower(trim(coalesce(u.email, ''))) = v_staff_email
        order by p.created_at desc
        limit 1;
      end if;
    end if;

    if v_profile_id is null then
      raise notice 'repair-zurschlagd: kein Auth-Nutzer für % % (staff %, email %, phone %)',
        v_row.given_name,
        v_row.family_name,
        v_row.staff_id,
        coalesce(v_row.email, '—'),
        coalesce(v_row.phone, '—');
      continue;
    end if;

    if v_position_id is null then
      raise notice 'repair-zurschlagd: keine Position für % % (staff %)',
        v_row.given_name, v_row.family_name, v_row.staff_id;
      continue;
    end if;

    v_emp_id := public._repair_zurschlagd_staff_team_row(
      v_row.staff_id,
      v_profile_id,
      v_position_id
    );

    if v_emp_id is null then
      raise notice 'repair-zurschlagd: Verknüpfung fehlgeschlagen für % %',
        v_row.given_name, v_row.family_name;
      continue;
    end if;

    v_repaired := v_repaired + 1;
    raise notice 'repair-zurschlagd: % % repariert (staff %, profile %, employee %)',
      v_row.given_name, v_row.family_name, v_row.staff_id, v_profile_id, v_emp_id;
  end loop;

  raise notice 'repair-zurschlagd: % Mitarbeiter repariert', v_repaired;
end $$;

drop function if exists public._repair_zurschlagd_staff_team_row(uuid, uuid, uuid);
