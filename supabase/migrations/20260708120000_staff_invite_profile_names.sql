-- Staff-Einladung: Profilnamen zuverlässig setzen (Signup-Session, RLS, Trigger-Race).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_given text;
  v_family text;
  v_display text;
begin
  v_given := nullif(trim(coalesce(new.raw_user_meta_data ->> 'given_name', '')), '');
  v_family := nullif(trim(coalesce(new.raw_user_meta_data ->> 'family_name', '')), '');
  v_display := nullif(trim(concat_ws(' ', v_given, v_family)), '');

  if v_display is null then
    v_display := coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    );
  end if;

  insert into public.profiles (id, display_name, given_name, family_name)
  values (new.id, v_display, v_given, v_family);

  return new;
end;
$$;

create or replace function public.sync_profile_names_for_user(
  p_user_id uuid,
  p_given_name text,
  p_family_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_given text;
  v_family text;
begin
  if p_user_id is null then
    return;
  end if;

  v_given := nullif(trim(coalesce(p_given_name, '')), '');
  v_family := nullif(trim(coalesce(p_family_name, '')), '');

  if v_given is null or v_family is null then
    return;
  end if;

  insert into public.profiles (id, given_name, family_name, display_name)
  values (
    p_user_id,
    v_given,
    v_family,
    trim(concat_ws(' ', v_given, v_family))
  )
  on conflict (id) do update
  set
    given_name = excluded.given_name,
    family_name = excluded.family_name,
    display_name = excluded.display_name;
end;
$$;

create or replace function public.sync_own_profile_names(
  p_given_name text,
  p_family_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  perform public.sync_profile_names_for_user(v_uid, p_given_name, p_family_name);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.sync_profile_names_for_user(uuid, text, text) from public;
grant execute on function public.sync_profile_names_for_user(uuid, text, text) to service_role;

revoke all on function public.sync_own_profile_names(text, text) from public;
grant execute on function public.sync_own_profile_names(text, text) to authenticated, service_role;

drop function if exists public.accept_staff_invite(text, uuid);

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

  select re.id, re.staff_id, re.is_active
  into v_emp_id, v_emp_staff_id, v_emp_active
  from public.restaurant_employees re
  where re.restaurant_id = v_invite.restaurant_id
    and re.profile_id = v_uid
  limit 1;

  if v_emp_id is not null and v_emp_active then
    if v_staff.profile_id = v_uid then
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
      position_id = v_invite.restaurant_position_id,
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
      v_invite.restaurant_position_id,
      case
        when rp.slug in (
          'owner', 'manager', 'host', 'server', 'kitchen', 'other'
        ) then rp.slug::public.employee_role
        else 'other'::public.employee_role
      end,
      true
    from public.restaurant_positions rp
    where rp.id = v_invite.restaurant_position_id
    returning id into v_emp_id;
  end if;

  update public.restaurant_staff
  set
    profile_id = v_uid,
    employee_id = v_emp_id
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
  where rp.id = v_invite.restaurant_position_id;

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
