-- Einladung ablehnen: neuer Status + RPC für eingeloggte Nutzer.

alter type public.staff_invite_status add value if not exists 'declined';

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

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.decline_staff_invite_by_id(uuid) from public;
grant execute on function public.decline_staff_invite_by_id(uuid) to authenticated, service_role;

create or replace function public.explain_staff_invite_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_row record;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('status', 'invalid');
  end if;

  v_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  select i.id, i.status, i.expires_at
  into v_row
  from public.restaurant_staff_invites i
  where i.token_hash = v_hash
  order by i.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_row.status = 'accepted' then
    return jsonb_build_object('status', 'accepted');
  end if;

  if v_row.status = 'declined' then
    return jsonb_build_object('status', 'declined');
  end if;

  if v_row.status = 'revoked' then
    return jsonb_build_object('status', 'revoked');
  end if;

  if v_row.expires_at <= timezone('utc', now()) then
    return jsonb_build_object('status', 'expired');
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object('status', 'invalid');
  end if;

  return jsonb_build_object('status', 'pending');
end;
$$;
