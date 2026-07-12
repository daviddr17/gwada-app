-- Einladung angenommen/abgelehnt: Benachrichtigung an Versender (Glocke + Push)

alter table public.notification_events
  drop constraint if exists notification_events_module_check;

alter table public.notification_events
  add constraint notification_events_module_check
  check (
    module in (
      'messages',
      'reviews',
      'changelog',
      'reservations_pending',
      'reservations_change_request',
      'reservations_cancellation',
      'staff_shift_start',
      'staff_shift_end',
      'inventory_low_stock',
      'accounting_quotation',
      'accounting_invoice',
      'accounting_voucher',
      'staff_todo_completed',
      'staff_todo_deferred',
      'staff_contract_signed',
      'staff_display_time_request',
      'staff_invite_accepted',
      'staff_invite_declined'
    )
  );

create table if not exists public.restaurant_staff_invite_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  invite_id uuid not null,
  module text not null check (
    module in ('staff_invite_accepted', 'staff_invite_declined')
  ),
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id, invite_id, module)
);

create index if not exists restaurant_staff_invite_notification_dismissals_restaurant_idx
  on public.restaurant_staff_invite_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_staff_invite_notification_dismissals enable row level security;

create policy restaurant_staff_invite_notification_dismissals_rw_own
  on public.restaurant_staff_invite_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

create or replace function public.emit_staff_invite_response_notification(
  p_invite_id uuid,
  p_module text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_staff_name text;
  v_position_name text;
  v_actor_given text;
  v_actor_family text;
begin
  if p_module not in ('staff_invite_accepted', 'staff_invite_declined') then
    return;
  end if;

  select
    i.id,
    i.restaurant_id,
    i.staff_id,
    i.created_by,
    i.channel::text as channel,
    s.given_name,
    s.family_name,
    rp.name as position_name
  into v_invite
  from public.restaurant_staff_invites i
  inner join public.restaurant_staff s on s.id = i.staff_id
  inner join public.restaurant_positions rp on rp.id = i.restaurant_position_id
  where i.id = p_invite_id;

  if not found or v_invite.created_by is null then
    return;
  end if;

  if v_invite.created_by = p_actor_user_id then
    return;
  end if;

  v_staff_name := trim(coalesce(v_invite.given_name, '') || ' ' || coalesce(v_invite.family_name, ''));
  if v_staff_name = '' then
    v_staff_name := 'Mitarbeiter';
  end if;

  v_position_name := nullif(trim(v_invite.position_name), '');

  select p.given_name, p.family_name
  into v_actor_given, v_actor_family
  from public.profiles p
  where p.id = p_actor_user_id;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    v_invite.restaurant_id,
    p_module,
    p_invite_id::text,
    jsonb_build_object(
      'inviteId', p_invite_id,
      'staffId', v_invite.staff_id,
      'staffName', v_staff_name,
      'positionName', v_position_name,
      'channel', v_invite.channel,
      'targetProfileId', v_invite.created_by,
      'actorUserId', p_actor_user_id,
      'actorProfileId', p_actor_user_id,
      'actorGivenName', coalesce(v_actor_given, ''),
      'actorFamilyName', coalesce(v_actor_family, '')
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = p_module
      and e.reference_id = p_invite_id::text
      and e.restaurant_id = v_invite.restaurant_id
  );
end;
$$;

revoke all on function public.emit_staff_invite_response_notification(uuid, text, uuid) from public;
grant execute on function public.emit_staff_invite_response_notification(uuid, text, uuid) to authenticated, service_role;

-- Ausstehende Einladungen für Manager (Mitarbeiter-Modul)
create or replace function public.list_restaurant_pending_staff_invites(p_restaurant_id uuid)
returns table (
  invite_id uuid,
  staff_id uuid,
  staff_given_name text,
  staff_family_name text,
  staff_email text,
  staff_phone text,
  position_name text,
  channel text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_restaurant_id is null then
    return;
  end if;

  if not (
    public.auth_has_restaurant_permission(p_restaurant_id, 'staff.read')
    or public.auth_has_restaurant_permission(p_restaurant_id, 'staff.manage')
  ) then
    return;
  end if;

  return query
  select
    i.id,
    i.staff_id,
    s.given_name,
    s.family_name,
    s.email,
    s.phone,
    rp.name,
    i.channel::text,
    i.expires_at,
    i.created_at
  from public.restaurant_staff_invites i
  inner join public.restaurant_staff s on s.id = i.staff_id
  inner join public.restaurant_positions rp on rp.id = i.restaurant_position_id
  where i.restaurant_id = p_restaurant_id
    and i.status = 'pending'
    and i.expires_at > timezone('utc', now())
  order by i.created_at desc;
end;
$$;

revoke all on function public.list_restaurant_pending_staff_invites(uuid) from public;
grant execute on function public.list_restaurant_pending_staff_invites(uuid) to authenticated, service_role;

-- accept_staff_invite: Benachrichtigung nach Annahme
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

      perform public.log_staff_invite_accepted(
        v_invite.restaurant_id,
        v_invite.staff_id,
        v_uid,
        v_invite.restaurant_position_id
      );

      perform public.emit_staff_invite_response_notification(
        v_invite.id,
        'staff_invite_accepted',
        v_uid
      );

      return jsonb_build_object(
        'ok', true,
        'already_member', true,
        'restaurant_id', v_invite.restaurant_id,
        'staff_id', v_invite.staff_id,
        'invite_id', v_invite.id
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

  perform public.log_staff_invite_accepted(
    v_invite.restaurant_id,
    v_invite.staff_id,
    v_uid,
    v_invite.restaurant_position_id
  );

  perform public.emit_staff_invite_response_notification(
    v_invite.id,
    'staff_invite_accepted',
    v_uid
  );

  return jsonb_build_object(
    'ok', true,
    'restaurant_id', v_invite.restaurant_id,
    'staff_id', v_invite.staff_id,
    'invite_id', v_invite.id
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

-- decline_staff_invite_by_id: Benachrichtigung nach Ablehnung
create or replace function public.decline_staff_invite_by_id(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_invite record;
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

  update public.restaurant_staff_invites
  set status = 'declined'
  where id = p_invite_id
    and status = 'pending';

  perform public.emit_staff_invite_response_notification(
    p_invite_id,
    'staff_invite_declined',
    v_uid
  );

  return jsonb_build_object(
    'ok', true,
    'invite_id', p_invite_id,
    'restaurant_id', (
      select i.restaurant_id
      from public.restaurant_staff_invites i
      where i.id = p_invite_id
    )
  );
end;
$$;
