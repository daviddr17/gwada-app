-- 6-stellige Gast-PIN je Reservierung (Nummer + PIN für späteren Gast-Zugang ohne Login).

create extension if not exists pgcrypto with schema extensions;

alter table public.reservations
  add column if not exists guest_pin char(6);

comment on column public.reservations.guest_pin is
  'Klartext-PIN für Restaurant-Team (Versand an Gäste). Verifikation später per guest_pin_hash.';
comment on column public.reservations.guest_pin_hash is
  'bcrypt-Hash der guest_pin (extensions.crypt) für öffentliche Gast-Verifikation.';

-- Bestehende Zeilen: zufällige PIN + Hash
do $$
declare
  r record;
  pin text;
  tries int;
begin
  for r in
    select id, restaurant_id
    from public.reservations
    where guest_pin is null
  loop
    tries := 0;
    loop
      tries := tries + 1;
      if tries > 80 then
        raise exception 'guest_pin backfill: keine freie PIN für restaurant %', r.restaurant_id;
      end if;
      pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
      exit when not exists (
        select 1
        from public.reservations x
        where x.restaurant_id = r.restaurant_id
          and x.guest_pin = pin
          and x.id <> r.id
      );
    end loop;
    update public.reservations
    set
      guest_pin = pin,
      guest_pin_hash = extensions.crypt(pin, extensions.gen_salt('bf'))
    where id = r.id;
  end loop;
end;
$$;

alter table public.reservations
  alter column guest_pin set not null;

alter table public.reservations
  add constraint reservations_guest_pin_format
    check (guest_pin ~ '^[0-9]{6}$');

alter table public.reservations
  add constraint reservations_restaurant_guest_pin_uniq
    unique (restaurant_id, guest_pin);

create or replace function public.reservations_assign_guest_pin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pin text;
  tries int := 0;
begin
  if new.guest_pin is not null and new.guest_pin ~ '^[0-9]{6}$' then
    if new.guest_pin_hash is null or trim(new.guest_pin_hash) = '' then
      new.guest_pin_hash := extensions.crypt(new.guest_pin, extensions.gen_salt('bf'));
    end if;
    return new;
  end if;

  loop
    tries := tries + 1;
    if tries > 80 then
      raise exception 'Keine freie Gast-PIN für Restaurant %', new.restaurant_id;
    end if;
    pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1
      from public.reservations x
      where x.restaurant_id = new.restaurant_id
        and x.guest_pin = pin
    );
  end loop;

  new.guest_pin := pin;
  new.guest_pin_hash := extensions.crypt(pin, extensions.gen_salt('bf'));
  return new;
end;
$$;

drop trigger if exists reservations_assign_guest_pin on public.reservations;

create trigger reservations_assign_guest_pin
  before insert on public.reservations
  for each row
  execute function public.reservations_assign_guest_pin();

-- Öffentliche Gast-Verifikation (spätere Gast-Seite; nur mit service_role oder security definer RPC)
create or replace function public.verify_reservation_guest_pin(
  p_restaurant_id uuid,
  p_reservation_number integer,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_hash text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return null;
  end if;
  select id, guest_pin_hash
    into v_id, v_hash
  from public.reservations
  where restaurant_id = p_restaurant_id
    and reservation_number = p_reservation_number
  limit 1;
  if v_id is null or v_hash is null then
    return null;
  end if;
  if extensions.crypt(p_pin, v_hash) = v_hash then
    return v_id;
  end if;
  return null;
end;
$$;

comment on function public.verify_reservation_guest_pin is
  'Prüft Reservierungsnummer + 6-stellige PIN; gibt reservation.id zurück oder null.';

revoke all on function public.verify_reservation_guest_pin from public;
grant execute on function public.verify_reservation_guest_pin to authenticated;
