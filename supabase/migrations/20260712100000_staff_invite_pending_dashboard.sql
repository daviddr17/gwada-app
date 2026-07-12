-- Offene Mitarbeiter-Einladungen für eingeloggte Nutzer (Dashboard-Banner)
-- sowie Reparatur unvollständiger Team-Verknüpfungen (profile_id ohne restaurant_employees).

create or replace function public.normalize_phone_digits(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '')
    where length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 8;
$$;

create or replace function public.auth_user_invite_contact_matches_staff(
  p_user_id uuid,
  p_staff_email text,
  p_staff_phone text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_auth_email text;
  v_auth_phone text;
  v_profile_phone text;
  v_staff_email text;
  v_staff_phone text;
begin
  if p_user_id is null then
    return false;
  end if;

  select lower(trim(u.email)), public.normalize_phone_digits(u.phone)
  into v_auth_email, v_auth_phone
  from auth.users u
  where u.id = p_user_id;

  select public.normalize_phone_digits(p.phone)
  into v_profile_phone
  from public.profiles p
  where p.id = p_user_id;

  v_staff_email := lower(trim(coalesce(p_staff_email, '')));
  v_staff_phone := public.normalize_phone_digits(p_staff_phone);

  if v_auth_email <> '' and v_staff_email <> '' and v_auth_email = v_staff_email then
    return true;
  end if;

  if v_staff_phone is not null then
    if v_auth_phone is not null and v_auth_phone = v_staff_phone then
      return true;
    end if;
    if v_profile_phone is not null and v_profile_phone = v_staff_phone then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke all on function public.auth_user_invite_contact_matches_staff(uuid, text, text) from public;
grant execute on function public.auth_user_invite_contact_matches_staff(uuid, text, text) to authenticated, service_role;

create or replace function public.list_auth_user_pending_staff_invites()
returns table (
  invite_id uuid,
  restaurant_id uuid,
  staff_id uuid,
  restaurant_name text,
  staff_given_name text,
  staff_family_name text,
  position_name text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return;
  end if;

  return query
  select
    i.id,
    i.restaurant_id,
    i.staff_id,
    r.name,
    s.given_name,
    s.family_name,
    rp.name,
    i.expires_at
  from public.restaurant_staff_invites i
  inner join public.restaurant_staff s on s.id = i.staff_id
  inner join public.restaurants r on r.id = i.restaurant_id
  inner join public.restaurant_positions rp on rp.id = i.restaurant_position_id
  where i.status = 'pending'
    and i.expires_at > timezone('utc', now())
    and s.profile_id is null
    and public.auth_user_invite_contact_matches_staff(v_uid, s.email, s.phone)
  order by i.created_at desc;
end;
$$;

revoke all on function public.list_auth_user_pending_staff_invites() from public;
grant execute on function public.list_auth_user_pending_staff_invites() to authenticated, service_role;

create or replace function public.list_auth_user_incomplete_staff_memberships()
returns table (
  staff_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  staff_given_name text,
  staff_family_name text,
  position_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return;
  end if;

  return query
  select
    s.id,
    s.restaurant_id,
    r.name,
    s.given_name,
    s.family_name,
    coalesce(rp.name, '—')
  from public.restaurant_staff s
  inner join public.restaurants r on r.id = s.restaurant_id
  left join public.restaurant_positions rp on rp.id = s.restaurant_position_id
  where s.profile_id = v_uid
    and not exists (
      select 1
      from public.restaurant_employees re
      where re.restaurant_id = s.restaurant_id
        and re.profile_id = v_uid
        and re.is_active = true
    )
  order by s.created_at desc;
end;
$$;

revoke all on function public.list_auth_user_incomplete_staff_memberships() from public;
grant execute on function public.list_auth_user_incomplete_staff_memberships() to authenticated, service_role;

create or replace function public.accept_staff_invite_by_id(
  p_invite_id uuid,
  p_given_name text default null,
  p_family_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_invite record;
  v_token text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_invite_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_invite');
  end if;

  select
    i.id,
    i.invite_token,
    i.status,
    i.expires_at,
    s.email,
    s.phone,
    s.profile_id
  into v_invite
  from public.restaurant_staff_invites i
  inner join public.restaurant_staff s on s.id = i.staff_id
  where i.id = p_invite_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invite_not_found');
  end if;

  if v_invite.status <> 'pending' or v_invite.expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'error', 'invite_not_found');
  end if;

  if v_invite.profile_id is not null and v_invite.profile_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'staff_already_linked');
  end if;

  if not public.auth_user_invite_contact_matches_staff(v_uid, v_invite.email, v_invite.phone) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_token := trim(coalesce(v_invite.invite_token, ''));
  if length(v_token) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invite_token_missing');
  end if;

  return public.accept_staff_invite(v_token, v_uid, p_given_name, p_family_name);
end;
$$;

revoke all on function public.accept_staff_invite_by_id(uuid, text, text) from public;
grant execute on function public.accept_staff_invite_by_id(uuid, text, text) to authenticated, service_role;

create or replace function public.repair_auth_user_staff_team_membership(
  p_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_staff record;
  v_position_id uuid;
  v_emp_id uuid;
  v_repaired int := 0;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  for v_staff in
    select s.*
    from public.restaurant_staff s
    where s.profile_id = v_uid
      and (p_staff_id is null or s.id = p_staff_id)
      and not exists (
        select 1
        from public.restaurant_employees re
        where re.restaurant_id = s.restaurant_id
          and re.profile_id = v_uid
          and re.is_active = true
      )
  loop
    select coalesce(
      (
        select rp.id
        from public.restaurant_positions rp
        where rp.restaurant_id = v_staff.restaurant_id
          and rp.id = v_staff.restaurant_position_id
        limit 1
      ),
      (
        select rp.id
        from public.restaurant_positions rp
        where rp.restaurant_id = v_staff.restaurant_id
          and rp.slug = 'other'
        limit 1
      )
    )
    into v_position_id;

    if v_position_id is null then
      continue;
    end if;

    select re.id
    into v_emp_id
    from public.restaurant_employees re
    where re.restaurant_id = v_staff.restaurant_id
      and re.profile_id = v_uid
    limit 1;

    if v_emp_id is not null then
      update public.restaurant_employees
      set
        staff_id = v_staff.id,
        position_id = v_position_id,
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
        v_uid,
        v_staff.id,
        v_position_id,
        case
          when rp.slug in (
            'owner', 'manager', 'host', 'server', 'kitchen', 'other'
          ) then rp.slug::public.employee_role
          else 'other'::public.employee_role
        end,
        true
      from public.restaurant_positions rp
      where rp.id = v_position_id
      returning id into v_emp_id;
    end if;

    if v_emp_id is null then
      continue;
    end if;

    update public.restaurant_staff
    set
      employee_id = v_emp_id,
      restaurant_position_id = v_position_id
    where id = v_staff.id;

    update public.profiles
    set
      active_restaurant_id = coalesce(active_restaurant_id, v_staff.restaurant_id),
      updated_at = timezone('utc', now())
    where id = v_uid
      and active_restaurant_id is null;

    v_repaired := v_repaired + 1;
  end loop;

  if v_repaired = 0 then
    return jsonb_build_object('ok', false, 'error', 'nothing_to_repair');
  end if;

  return jsonb_build_object('ok', true, 'repaired', v_repaired);
end;
$$;

revoke all on function public.repair_auth_user_staff_team_membership(uuid) from public;
grant execute on function public.repair_auth_user_staff_team_membership(uuid) to authenticated, service_role;
