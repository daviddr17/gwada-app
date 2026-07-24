-- Offline-PIN für gekoppelte POS-Geräte: SHA-256-Verifier neben bcrypt.

alter table public.restaurant_staff
  add column if not exists display_pin_offline_hash text;

comment on column public.restaurant_staff.display_pin_offline_hash is
  'SHA-256 hex von pin||NUL||restaurant_id||NUL||gwada-pos-offline-v1 — nur für POS-Offline-Login auf gekoppelten Geräten.';

create or replace function public.pos_display_pin_offline_hash(
  p_pin text,
  p_restaurant_id uuid
)
returns text
language sql
immutable
as $$
  select encode(
    extensions.digest(
      convert_to(
        p_pin || chr(0) || p_restaurant_id::text || chr(0) || 'gwada-pos-offline-v1',
        'utf8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public.pos_display_pin_offline_hash(text, uuid) from public;
grant execute on function public.pos_display_pin_offline_hash(text, uuid) to service_role;

create or replace function public.set_restaurant_staff_display_pin(
  p_staff_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_other record;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN muss 4-stellig sein';
  end if;

  select restaurant_id into v_restaurant_id
  from public.restaurant_staff
  where id = p_staff_id;

  if v_restaurant_id is null then
    return false;
  end if;

  for v_other in
    select id, display_pin_hash
    from public.restaurant_staff
    where restaurant_id = v_restaurant_id
      and id <> p_staff_id
      and is_active
      and display_pin_hash is not null
  loop
    if extensions.crypt(p_pin, v_other.display_pin_hash) = v_other.display_pin_hash then
      raise exception 'Diese PIN wird bereits von einem anderen Mitarbeiter verwendet';
    end if;
  end loop;

  update public.restaurant_staff
  set
    display_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
    display_pin_offline_hash = public.pos_display_pin_offline_hash(p_pin, v_restaurant_id),
    display_pin_set_at = timezone('utc', now())
  where id = p_staff_id;

  return true;
end;
$$;

create or replace function public.clear_restaurant_staff_display_pin(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.restaurant_staff
  set
    display_pin_hash = null,
    display_pin_offline_hash = null,
    display_pin_set_at = null
  where id = p_staff_id;
end;
$$;
