-- Fehlende 6-stellige Gast-PINs vergeben (idempotent, lokal oder Live per db query).
-- Voraussetzung: Migration 20250519020000_reservations_guest_pin.sql (pgcrypto)

do $$
declare
  r record;
  pin text;
  tries int;
  updated int := 0;
begin
  for r in
    select id, restaurant_id
    from public.reservations
    where guest_pin is null
       or guest_pin !~ '^[0-9]{6}$'
       or guest_pin_hash is null
       or trim(guest_pin_hash) = ''
  loop
    tries := 0;
    loop
      tries := tries + 1;
      if tries > 80 then
        raise exception 'backfill: keine freie PIN für restaurant %', r.restaurant_id;
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
    updated := updated + 1;
  end loop;
  raise notice 'backfill-reservation-guest-pins: % Zeile(n) aktualisiert', updated;
end;
$$;
