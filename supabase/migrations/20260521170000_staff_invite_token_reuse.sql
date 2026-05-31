-- Einladung: Klartext-Token serverintern für Resend (Lookup weiter über token_hash)

alter table public.restaurant_staff_invites
  add column if not exists invite_token text;

comment on column public.restaurant_staff_invites.invite_token is
  'Nur serverintern (Service-Role) für erneutes Kopieren/Senden; öffentlicher Lookup über token_hash.';

-- Token trimmen wie bei accept_staff_invite / Node hashStaffInviteToken
create or replace function public.resolve_staff_invite_by_token(p_token text)
returns table (
  invite_id uuid,
  restaurant_id uuid,
  staff_id uuid,
  restaurant_name text,
  staff_given_name text,
  staff_family_name text,
  staff_email text,
  position_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.restaurant_id,
    i.staff_id,
    r.name,
    s.given_name,
    s.family_name,
    s.email,
    rp.name
  from public.restaurant_staff_invites i
  inner join public.restaurant_staff s on s.id = i.staff_id
  inner join public.restaurants r on r.id = i.restaurant_id
  inner join public.restaurant_positions rp on rp.id = i.restaurant_position_id
  where i.token_hash = encode(extensions.digest(trim(p_token), 'sha256'), 'hex')
    and i.status = 'pending'
    and i.expires_at > timezone('utc', now());
$$;

-- Status für UI (ungültig / widerrufen / abgelaufen)
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

revoke all on function public.explain_staff_invite_by_token(text) from public;
grant execute on function public.explain_staff_invite_by_token(text) to anon, authenticated, service_role;
