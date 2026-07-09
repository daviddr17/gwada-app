-- Team-Liste liest restaurant_employees. accept_staff_invite konnte die Einladung
-- als angenommen markieren, ohne Employee-Zeile (0-row INSERT bei fehlender Position)
-- oder ohne staff.employee_id zu setzen — Mitarbeiter zeigt dann profile_id, Team nicht.

create or replace function public.accept_staff_invite(
  p_token text,
  p_profile_id uuid default null,
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
  v_staff record;
  v_emp_id uuid;
  v_emp_staff_id uuid;
  v_emp_active boolean;
  v_token_hash text;
  v_actor_given text;
  v_actor_family text;
  v_position_name text;
  v_position_id uuid;
begin
  v_uid := coalesce(p_profile_id, (select auth.uid()));
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  perform public.sync_profile_names_for_user(v_uid, p_given_name, p_family_name);

  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  select i.*
  into v_invite
  from public.restaurant_staff_invites i
  where i.token_hash = v_token_hash
    and i.status = 'pending'
    and i.expires_at > timezone('utc', now())
  for update of i;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invite_not_found');
  end if;

  select * into v_staff from public.restaurant_staff where id = v_invite.staff_id;

  if v_staff.profile_id is not null and v_staff.profile_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'staff_already_linked');
  end if;

  select rp.id
  into v_position_id
  from public.restaurant_positions rp
  where rp.restaurant_id = v_invite.restaurant_id
    and rp.id in (
      v_invite.restaurant_position_id,
      v_staff.restaurant_position_id
    )
  order by case rp.id
    when v_invite.restaurant_position_id then 0
    when v_staff.restaurant_position_id then 1
    else 2
  end
  limit 1;

  if v_position_id is null then
    select rp.id
    into v_position_id
    from public.restaurant_positions rp
    where rp.restaurant_id = v_invite.restaurant_id
      and rp.slug = 'other'
    limit 1;
  end if;

  if v_position_id is null then
    return jsonb_build_object('ok', false, 'error', 'position_not_found');
  end if;

  select re.id, re.staff_id, re.is_active
  into v_emp_id, v_emp_staff_id, v_emp_active
  from public.restaurant_employees re
  where re.restaurant_id = v_invite.restaurant_id
    and re.profile_id = v_uid
  limit 1;

  if v_emp_id is not null and v_emp_active then
    if v_staff.profile_id = v_uid then
      update public.restaurant_employees
      set
        staff_id = v_invite.staff_id,
        position_id = v_position_id,
        is_active = true
      where id = v_emp_id;

      update public.restaurant_staff
      set
        profile_id = v_uid,
        employee_id = v_emp_id,
        restaurant_position_id = v_position_id
      where id = v_invite.staff_id;

      update public.restaurant_staff_invites
      set
        status = 'accepted',
        accepted_at = timezone('utc', now()),
        accepted_by = v_uid
      where id = v_invite.id;

      return jsonb_build_object(
        'ok', true,
        'already_member', true,
        'restaurant_id', v_invite.restaurant_id,
        'staff_id', v_invite.staff_id
      );
    end if;

    if v_emp_staff_id is not null and v_emp_staff_id <> v_invite.staff_id then
      return jsonb_build_object('ok', false, 'error', 'already_member');
    end if;
  end if;

  if v_emp_id is not null then
    update public.restaurant_employees
    set
      staff_id = v_invite.staff_id,
      position_id = v_position_id,
      role = (
        select case
          when rp.slug in (
            'owner', 'manager', 'host', 'server', 'kitchen', 'other'
          ) then rp.slug::public.employee_role
          else 'other'::public.employee_role
        end
        from public.restaurant_positions rp
        where rp.id = v_position_id
      ),
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
      v_invite.restaurant_id,
      v_uid,
      v_invite.staff_id,
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
    return jsonb_build_object('ok', false, 'error', 'employee_create_failed');
  end if;

  update public.restaurant_staff
  set
    profile_id = v_uid,
    employee_id = v_emp_id,
    restaurant_position_id = v_position_id
  where id = v_invite.staff_id;

  update public.restaurant_staff_invites
  set
    status = 'accepted',
    accepted_at = timezone('utc', now()),
    accepted_by = v_uid
  where id = v_invite.id;

  select p.given_name, p.family_name
  into v_actor_given, v_actor_family
  from public.profiles p
  where p.id = v_uid;

  select rp.name
  into v_position_name
  from public.restaurant_positions rp
  where rp.id = v_position_id;

  insert into public.restaurant_staff_log_entries (
    restaurant_id,
    staff_id,
    actor_user_id,
    action,
    details
  )
  values (
    v_invite.restaurant_id,
    v_invite.staff_id,
    v_uid,
    'invite_accepted',
    jsonb_build_object(
      'summary',
      coalesce(
        'Einladung angenommen'
          || case
            when v_position_name is not null and length(trim(v_position_name)) > 0
              then ' · App-Rolle: ' || trim(v_position_name)
            else ''
          end,
        'Einladung angenommen'
      ),
      'actorGivenName', coalesce(v_actor_given, ''),
      'actorFamilyName', coalesce(v_actor_family, ''),
      'changes', '[]'::jsonb
    )
  );

  return jsonb_build_object(
    'ok', true,
    'restaurant_id', v_invite.restaurant_id,
    'staff_id', v_invite.staff_id
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.accept_staff_invite(text, uuid, text, text) from public;
grant execute on function public.accept_staff_invite(text, uuid, text, text) to authenticated, service_role;

-- Bestehende Verknüpfungen reparieren (z. B. Daniel Dreyer: profile_id gesetzt, Team leer).
with resolved as (
  select
    rs.id as staff_id,
    rs.restaurant_id,
    rs.profile_id,
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
  where rs.profile_id is not null
),
missing as (
  select r.*
  from resolved r
  where r.position_id is not null
    and not exists (
      select 1
      from public.restaurant_employees re
      where re.restaurant_id = r.restaurant_id
        and re.profile_id = r.profile_id
    )
)
insert into public.restaurant_employees (
  restaurant_id,
  profile_id,
  staff_id,
  position_id,
  role,
  is_active
)
select
  m.restaurant_id,
  m.profile_id,
  m.staff_id,
  m.position_id,
  case
    when rp.slug in (
      'owner', 'manager', 'host', 'server', 'kitchen', 'other'
    ) then rp.slug::public.employee_role
    else 'other'::public.employee_role
  end,
  true
from missing m
inner join public.restaurant_positions rp on rp.id = m.position_id;

update public.restaurant_employees re
set staff_id = rs.id
from public.restaurant_staff rs
where rs.restaurant_id = re.restaurant_id
  and rs.profile_id = re.profile_id
  and re.staff_id is null;

update public.restaurant_staff rs
set employee_id = re.id
from public.restaurant_employees re
where re.restaurant_id = rs.restaurant_id
  and re.profile_id = rs.profile_id
  and rs.employee_id is distinct from re.id;
